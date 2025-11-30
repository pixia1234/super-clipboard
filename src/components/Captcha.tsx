import { useEffect, useMemo, useRef, useState } from "react";

export type CaptchaProvider = "turnstile" | "recaptcha";

type Props = {
  provider: CaptchaProvider;
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  resetSignal?: number;
  onError?: (message: string) => void;
  labels?: {
    loading: string;
    error: string;
  };
};

type ScriptStatus = "idle" | "loading" | "ready" | "error";

const SCRIPT_URLS: Record<CaptchaProvider, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  recaptcha: "https://www.google.com/recaptcha/api.js?render=explicit"
};

const scriptCache: Partial<Record<CaptchaProvider, Promise<void>>> = {};

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          theme?: "auto" | "light" | "dark";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId?: string) => void;
    };
    grecaptcha?: {
      ready: (callback: () => void) => void;
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => number;
      reset: (opt_widget_id?: number) => void;
    };
  }
}

const loadScript = async (provider: CaptchaProvider): Promise<void> => {
  if (scriptCache[provider]) {
    return scriptCache[provider] as Promise<void>;
  }
  scriptCache[provider] = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-captcha-provider="${provider}"]`
    );
    if (existing && (provider === "turnstile" ? window.turnstile : window.grecaptcha)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URLS[provider];
    script.async = true;
    script.defer = true;
    script.dataset.captchaProvider = provider;
    script.onload = () => resolve();
    script.onerror = (event) => reject(event);
    document.head.appendChild(script);
  });
  return scriptCache[provider] as Promise<void>;
};

const Captcha = ({
  provider,
  siteKey,
  onTokenChange,
  resetSignal,
  onError,
  labels
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<ScriptStatus>("idle");

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const normalizedKey = useMemo(() => siteKey.trim(), [siteKey]);

  useEffect(() => {
    onTokenChangeRef.current?.(null);
  }, [provider, normalizedKey, resetSignal]);

  useEffect(() => {
    let disposed = false;
    const mount = async () => {
      if (!containerRef.current || !normalizedKey) {
        return;
      }
      try {
        setStatus("loading");
        await loadScript(provider);
        if (disposed || !containerRef.current) {
          return;
        }
        const target = containerRef.current;
        target.innerHTML = "";

        const handleError = () => {
          if (disposed) return;
          setStatus("error");
          onErrorRef.current?.(labels?.error ?? "验证码加载失败，请刷新后重试");
        };
        const handleExpired = () => {
          if (disposed) return;
          onTokenChangeRef.current?.(null);
        };
        const handleSuccess = (token: string) => {
          if (disposed) return;
          setStatus("ready");
          onTokenChangeRef.current?.(token);
        };

        if (provider === "turnstile") {
          if (!window.turnstile) {
            throw new Error("Turnstile not available");
          }
          widgetIdRef.current = window.turnstile.render(target, {
            sitekey: normalizedKey,
            theme: "auto",
            callback: handleSuccess,
            "expired-callback": handleExpired,
            "error-callback": handleError
          });
        } else {
          const recaptcha = window.grecaptcha;
          if (!recaptcha) {
            throw new Error("reCAPTCHA not available");
          }
          recaptcha.ready(() => {
            if (disposed || !containerRef.current) {
              return;
            }
            widgetIdRef.current = recaptcha.render(containerRef.current as HTMLElement, {
              sitekey: normalizedKey,
              callback: handleSuccess,
              "expired-callback": handleExpired,
              "error-callback": handleError
            });
            setStatus("ready");
          });
        }
      } catch (error) {
        if (!disposed) {
          setStatus("error");
          onErrorRef.current?.(labels?.error ?? "验证码加载失败，请刷新后重试");
          console.warn("captcha init failed", error);
        }
      }
    };
    void mount();

    return () => {
      disposed = true;
      if (provider === "turnstile" && widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current as string);
      }
      if (provider === "recaptcha" && widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current as number);
      }
    };
  }, [provider, normalizedKey, resetSignal]);

  if (!normalizedKey) {
    return null;
  }

  return (
    <div className={`captcha ${status === "loading" ? "captcha--loading" : ""}`}>
      <div ref={containerRef} />
      {status === "loading" ? (
        <span className="captcha__status">
          {labels?.loading ?? "加载验证码组件…"}
        </span>
      ) : null}
      {status === "error" ? (
        <span className="captcha__status captcha__status--error">
          {labels?.error ?? "验证码加载失败"}
        </span>
      ) : null}
    </div>
  );
};

export default Captcha;
