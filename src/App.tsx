import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  useClipboardStore,
  ClipType,
  RemoteClip
} from "./store/useClipboardStore";
import { readFromClipboard, writeToClipboard } from "./utils/clipboard";
import {
  generateAccessCode,
  generateToken,
  hoursToMilliseconds,
  formatBytes
} from "./utils/generators";
import {
  listRemoteClips,
  createRemoteClip,
  deleteRemoteClip,
  fetchRemoteClip,
  registerPersistentToken
} from "./utils/api";
import "./App.css";
import { useI18n } from "./i18n/I18nProvider";
import type { Locale } from "./i18n/locales";
import Captcha, { CaptchaProvider as CaptchaProviderType } from "./components/Captcha";

const buildRelativeAccessPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (typeof window === "undefined") {
    return `/${trimmed}`;
  }
  const target = new URL(`./${trimmed}`, window.location.href);
  return target.toString();
};

type ToastState = {
  kind: "success" | "error" | "info";
  message: string;
};

const SETTINGS_STORAGE_KEY = "super-clipboard::settings";
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 120;
const DEFAULT_EXPIRY_HOURS = 24;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const TOKEN_EXPIRY_MS = 720 * 60 * 60 * 1000; // 720 hours
const DEFAULT_MAX_DOWNLOADS = 10;
const MAX_DOWNLOADS_OPTIONS = [3, 5, 10, 20, 50, 100];
const SUPPORTED_CAPTCHA_PROVIDERS: readonly CaptchaProviderType[] = [
  "turnstile",
  "recaptcha"
] as const;

type DraftFile = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

const emptyToast: ToastState | null = null;

const App = () => {
  const {
    t,
    formatDateTime,
    formatDuration,
    formatRemaining,
    locale,
    setLocale,
    options
  } = useI18n();
  const {
    remoteClips,
    setRemoteClips,
    upsertRemoteClip,
    updateRemoteClip,
    removeRemoteClip: removeClipFromStore,
    settings,
    updateSettings
  } = useClipboardStore();

  const [type, setType] = useState<ClipType>("text");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<DraftFile | null>(null);
  const [expiresInHours, setExpiresInHours] = useState(DEFAULT_EXPIRY_HOURS);
  const [maxDownloads, setMaxDownloads] = useState(DEFAULT_MAX_DOWNLOADS);
  const [shortCode, setShortCode] = useState(() => generateAccessCode());
  const [accessMode, setAccessMode] = useState<"code" | "token">(
    () => (settings.persistentToken ? "token" : "code")
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingClip, setIsCreatingClip] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(emptyToast);
  const [isImportingClipboard, setIsImportingClipboard] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [settingsTokenDraft, setSettingsTokenDraft] = useState(
    settings.persistentToken
  );
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const captchaProvider = useMemo<CaptchaProviderType | null>(() => {
    const raw = (import.meta.env.VITE_CAPTCHA_PROVIDER ?? "").trim().toLowerCase();
    return SUPPORTED_CAPTCHA_PROVIDERS.find((item) => item === raw) ?? null;
  }, []);
  const captchaSiteKey = useMemo(
    () => (import.meta.env.VITE_CAPTCHA_SITE_KEY ?? "").trim(),
    []
  );
  const isCaptchaEnabled = Boolean(captchaProvider && captchaSiteKey);

  useEffect(() => {
    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Partial<{
          persistentToken: unknown;
          tokenUpdatedAt: unknown;
          tokenLastUsedAt: unknown;
          environmentId: unknown;
        }>;
        const sanitized = {
          persistentToken:
            typeof parsed.persistentToken === "string" ? parsed.persistentToken : "",
          tokenUpdatedAt:
            typeof parsed.tokenUpdatedAt === "number" ? parsed.tokenUpdatedAt : null,
          tokenLastUsedAt:
            typeof parsed.tokenLastUsedAt === "number" ? parsed.tokenLastUsedAt : null,
          environmentId:
            typeof parsed.environmentId === "string" && parsed.environmentId
              ? parsed.environmentId
              : crypto.randomUUID()
        };
        updateSettings(sanitized);
      }
    } catch (error) {
      console.warn("Failed to load environment settings:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteClips = async () => {
      if (!settings.environmentId) {
        return;
      }
      try {
        const clips = await listRemoteClips(settings.environmentId);
        if (!cancelled) {
          setRemoteClips(clips);
        }
      } catch (error) {
        console.warn(t("toast.loadFailed"), error);
        if (!cancelled) {
          setToast({ kind: "error", message: t("toast.loadFailed") });
        }
      }
    };

    loadRemoteClips();
    const timer = window.setInterval(loadRemoteClips, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setRemoteClips, settings.environmentId, t]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    setSettingsTokenDraft(settings.persistentToken);
  }, [settings.persistentToken]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(emptyToast), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!settings.persistentToken) {
      return;
    }
    const reference = settings.tokenLastUsedAt ?? settings.tokenUpdatedAt;
    if (!reference) {
      return;
    }
    if (now - reference >= TOKEN_EXPIRY_MS) {
      updateSettings({
        persistentToken: "",
        tokenUpdatedAt: null,
        tokenLastUsedAt: null,
      });
      setAccessMode("code");
      setSettingsTokenDraft("");
      setToast({
        kind: "info",
        message: t("toast.tokenExpired")
      });
    }
  }, [
    now,
    settings.persistentToken,
    settings.tokenLastUsedAt,
    settings.tokenUpdatedAt,
    updateSettings
  ]);

  useEffect(() => {
    if (!settings.persistentToken && accessMode === "token") {
      setAccessMode("code");
    }
  }, [settings.persistentToken, accessMode]);

  const hasActiveClips = useMemo(
    () =>
      remoteClips.some(
        (clip) => clip.expiresAt > now && clip.downloadCount < clip.maxDownloads
      ),
    [remoteClips, now]
  );

  const resetForm = () => {
    setTextContent("");
    setSelectedFile(null);
    setExpiresInHours(DEFAULT_EXPIRY_HOURS);
    setMaxDownloads(DEFAULT_MAX_DOWNLOADS);
    setShortCode(generateAccessCode());
    setType("text");
    if (!settings.persistentToken) {
      setAccessMode("code");
    }
  };

  const resetCaptcha = () => {
    setCaptchaToken("");
    setCaptchaError(null);
    setCaptchaResetKey((value) => value + 1);
  };

  const handleImportClipboard = async () => {
    setIsImportingClipboard(true);
    const fromSystem = await readFromClipboard();
    setIsImportingClipboard(false);
    if (!fromSystem) {
      setToast({
        kind: "error",
        message: t("toast.clipboardReadFailed")
      });
      return;
    }
    setType("text");
    setTextContent(fromSystem);
    setToast({
      kind: "success",
      message: t("toast.clipboardImported")
    });
  };

  const processFile = useCallback(
    async (
      file: File,
      options?: {
        fallbackName?: string;
      }
    ): Promise<boolean> => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setToast({
          kind: "error",
          message: t("toast.fileTooLarge")
        });
        setSelectedFile(null);
        return false;
      }

      const resolvedName =
        (file.name && file.name.trim()) || options?.fallbackName || "clipboard-upload";

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setSelectedFile({
          name: resolvedName,
          size: file.size,
          type: file.type,
          dataUrl
        });
        return true;
      } catch (error) {
        console.warn(t("toast.fileReadFailed"), error);
        setToast({
          kind: "error",
          message: t("toast.fileReadFailed")
        });
        setSelectedFile(null);
        return false;
      }
    },
    [t]
  );

  useEffect(() => {
    if (type !== "file") {
      return;
    }

    const handlePaste = async (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const items = clipboardData.items;
      if (!items || items.length === 0) {
        return;
      }

      const item = Array.from(items).find(
        (candidate) =>
          candidate.kind === "file" && candidate.type.startsWith("image/")
      );

      if (!item) {
        return;
      }

      const blob = item.getAsFile();
      if (!blob) {
        return;
      }

      event.preventDefault();

      const mimeType = blob.type || item.type || "image/png";
      const extensionCandidate = mimeType.split("/")[1]?.split(";")[0] ?? "";
      const safeExtension = extensionCandidate ? extensionCandidate : "png";
      const fallbackName = `pasted-image-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.${safeExtension}`;

      const file =
        blob instanceof File && blob.name
          ? blob
          : new File([blob], fallbackName, {
              type: mimeType,
              lastModified: Date.now()
            });

      const success = await processFile(file, { fallbackName });
      if (success) {
        setToast({
          kind: "success",
          message: t("toast.clipboardImageImported")
        });
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [processFile, t, type]);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const success = await processFile(file);
    if (!success) {
      event.target.value = "";
    }
  };

  const handleCreateRemoteClip = async () => {
    if (isCreatingClip) {
      return;
    }
    const trimmedText = textContent.trim();
    if (type === "text" && !trimmedText) {
      setToast({
        kind: "info",
        message: t("toast.textRequired")
      });
      return;
    }

    if (type === "file" && !selectedFile) {
      setToast({
        kind: "info",
        message: t("toast.fileRequired")
      });
      return;
    }

    if (
      Number.isNaN(expiresInHours) ||
      expiresInHours < MIN_EXPIRY_HOURS ||
      expiresInHours > MAX_EXPIRY_HOURS
    ) {
      setToast({
        kind: "info",
        message: t("toast.expiryInvalid")
      });
      return;
    }

    if (Number.isNaN(maxDownloads) || maxDownloads < 1 || maxDownloads > 500) {
      setToast({
        kind: "info",
        message: t("toast.downloadLimitInvalid")
      });
      return;
    }

    const nowTs = Date.now();
    const tokenValue = settings.persistentToken.trim();
    const usingToken = accessMode === "token";
    const activeShortCode = accessMode === "code" ? shortCode.trim() : "";

    if (usingToken) {
      if (!tokenValue) {
        setToast({
          kind: "info",
          message: t("toast.tokenRequired")
        });
        setAccessMode("code");
        return;
      }

      if (!settings.environmentId) {
        setToast({
          kind: "info",
          message: t("toast.tokenRequired")
        });
        setAccessMode("code");
        return;
      }

      const reference = settings.tokenLastUsedAt ?? settings.tokenUpdatedAt;
      if (reference && nowTs - reference >= TOKEN_EXPIRY_MS) {
        updateSettings({
          persistentToken: "",
          tokenUpdatedAt: null,
          tokenLastUsedAt: null,
        });
        setAccessMode("code");
        setSettingsTokenDraft("");
        setToast({
          kind: "info",
          message: t("toast.tokenExpired")
        });
        return;
      }

      if (tokenValue.length < 7) {
        setToast({
          kind: "info",
          message: t("toast.tokenTooShort")
        });
        return;
      }
    } else {
      if (!/^\d{5}$/.test(activeShortCode)) {
        setToast({
          kind: "info",
          message: t("toast.shortCodeInvalid")
        });
        return;
      }
    }

    if (isCaptchaEnabled && !captchaToken) {
      setToast({
        kind: "info",
        message: t("toast.captchaRequired")
      });
      return;
    }

    setIsCreatingClip(true);
    try {
      const created = await createRemoteClip({
        type,
        expiresAt: Date.now() + hoursToMilliseconds(expiresInHours),
        maxDownloads,
        environmentId: settings.environmentId,
        accessCode: accessMode === "code" ? activeShortCode : undefined,
        accessToken: usingToken ? tokenValue : undefined,
        captchaToken: isCaptchaEnabled ? captchaToken : undefined,
        captchaProvider: captchaProvider ?? undefined,
        payload:
          type === "text"
            ? { text: trimmedText }
            : { file: selectedFile ?? undefined }
      });

      upsertRemoteClip(created);
      setToast({
        kind: "success",
        message:
          type === "text"
            ? t("toast.createSuccess.text")
            : t("toast.createSuccess.file")
      });

      if (usingToken) {
        updateSettings({
          tokenLastUsedAt: nowTs
        });
      }

      if (accessMode === "code") {
        setShortCode(generateAccessCode());
      }
      resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.createFailed");
      setToast({ kind: "error", message });
    } finally {
      setIsCreatingClip(false);
      if (isCaptchaEnabled) {
        resetCaptcha();
      }
    }
  };

  const handleCopyAccess = async (
    value: string,
    target: "direct-link" | "token"
  ) => {
    const label =
      target === "direct-link"
        ? t("copy.target.directLink")
        : t("copy.target.token");
    if (!value) {
      setToast({
        kind: "error",
        message: t("toast.noAccessValue", { target: label })
      });
      return;
    }
    const ok = await writeToClipboard(value);
    setToast(
      ok
        ? { kind: "success", message: t("toast.copySuccess", { target: label }) }
        : { kind: "error", message: t("toast.copyFailed", { target: label }) }
    );
  };

  const refreshRemoteClip = async (clipId: string) => {
    try {
      const fresh = await fetchRemoteClip(clipId, settings.environmentId);
      updateRemoteClip(clipId, fresh);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.clipAutoDeleted");
      if (/未找到|不存在|过期|销毁/.test(message)) {
        removeClipFromStore(clipId);
        setToast({ kind: "info", message: t("toast.clipAutoDeleted") });
      } else {
        console.warn(t("toast.loadFailed"), error);
      }
    }
  };

  const handleDownloadFile = (clip: RemoteClip) => {
    const file = clip.payload.file;
    if (!file) {
      setToast({
        kind: "error",
        message: t("toast.fileMissing")
      });
      return;
    }

    const link = document.createElement("a");
    link.href = file.downloadUrl;
    link.rel = "noopener";
    link.target = "_blank";
    link.click();

    setToast({
      kind: "success",
      message: t("toast.fileDownloadStarted")
    });

    window.setTimeout(() => {
      void refreshRemoteClip(clip.id);
    }, 800);
  };

  const handleCopyRemoteText = async (clip: RemoteClip) => {
    const text = clip.payload.text ?? "";
    if (!text) {
      setToast({
        kind: "error",
        message: t("toast.clipEmpty")
      });
      return;
    }

    const ok = await writeToClipboard(text);
    setToast(
      ok
        ? {
            kind: "success",
            message: t("toast.copySuccess", { target: t("copy.target.text") })
          }
        : {
            kind: "error",
            message: t("toast.copyFailed", { target: t("copy.target.text") })
          }
    );
  };

  const handleRemoveRemoteClip = async (clipId: string) => {
    try {
      await deleteRemoteClip(clipId, settings.environmentId);
      removeClipFromStore(clipId);
      setToast({
        kind: "info",
        message: t("toast.clipDeleted")
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.removeFailed");
      setToast({ kind: "error", message });
    }
  };

  const handleOpenSettings = () => {
    setSettingsTokenDraft(settings.persistentToken);
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setSettingsTokenDraft(settings.persistentToken);
  };

  const handleGeneratePersistentToken = () => {
    setSettingsTokenDraft(generateToken(20));
  };

  const handleSaveSettings = async () => {
    const trimmedToken = settingsTokenDraft.trim();
    if (trimmedToken && trimmedToken.length < 7) {
      setToast({
        kind: "info",
        message: t("toast.tokenTooShort")
      });
      return;
    }

    if (!trimmedToken) {
      updateSettings({
        persistentToken: "",
        tokenUpdatedAt: null,
        tokenLastUsedAt: null,
      });
      setAccessMode("code");
      setSettingsTokenDraft("");
      setToast({
        kind: "success",
        message: t("toast.settingsSaved")
      });
      setIsSettingsOpen(false);
      return;
    }

    try {
      const registration = await registerPersistentToken(
        trimmedToken,
        settings.environmentId
      );
      updateSettings({
        persistentToken: trimmedToken,
        tokenUpdatedAt: registration.updatedAt,
        tokenLastUsedAt: registration.lastUsedAt ?? null,
        environmentId: registration.environmentId || settings.environmentId
      });
      setSettingsTokenDraft(trimmedToken);
      setToast({
        kind: "success",
        message: t("toast.settingsSaved")
      });
      setIsSettingsOpen(false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setToast({
        kind: "error",
        message: reason
          ? t("toast.tokenRegisterFailed", { reason })
          : t("toast.tokenRegisterFailedFallback")
      });
    }
  };

  const tokenReferenceTime = settings.tokenLastUsedAt ?? settings.tokenUpdatedAt;
  const tokenLastActivityLabel = settings.persistentToken
    ? settings.tokenLastUsedAt
      ? t("token.lastUsed", {
          timestamp: formatDateTime(settings.tokenLastUsedAt)
        })
      : settings.tokenUpdatedAt
      ? t("token.updatedAt", {
          timestamp: formatDateTime(settings.tokenUpdatedAt)
        })
      : null
    : null;
  const tokenExpiryNotice =
    settings.persistentToken && tokenReferenceTime
      ? t("token.expiryNotice", {
          duration: formatDuration(
            Math.max(0, TOKEN_EXPIRY_MS - (now - tokenReferenceTime))
          )
        })
      : null;

  const listSummary = remoteClips.length
    ? hasActiveClips
      ? t("list.summaryActive", { count: remoteClips.length })
      : t("list.summaryAllInactive")
    : t("list.summaryEmpty");

  const getClipTitle = (clip: RemoteClip): string => {
    if (clip.type === "text") {
      const text = (clip.payload.text ?? "").replace(/\s+/g, " ").trim();
      if (!text) {
        return t("list.clipType.text");
      }
      return text.length > 32 ? `${text.slice(0, 32)}…` : text;
    }
    return clip.payload.file?.name ?? t("list.clipType.file");
  };

  return (
    <div>
      <header className="hero">
        <div className="hero__top">
          <div className="hero__badge">Super Clipboard</div>
          <div className="hero__controls">
            <label className="sr-only" htmlFor="locale-select">
              {t("locale.switcherLabel")}
            </label>
            <select
              id="locale-select"
              className="language-switcher"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              aria-label={t("locale.switcherLabel")}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--ghost settings-trigger"
              onClick={handleOpenSettings}
              aria-label={t("hero.settings")}
              title={t("hero.settings")}
            >
              <span className="sr-only">{t("hero.settings")}</span>
              <svg
                className="settings-trigger__icon"
                viewBox="0 0 48 48"
                role="img"
                aria-hidden="true"
              >
                <path
                  d="M24 29C26.7614 29 29 26.7614 29 24C29 21.2386 26.7614 19 24 19C21.2386 19 19 21.2386 19 24C19 26.7614 21.2386 29 24 29Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.22182 18.2957C8.07786 19.1589 8 20.0678 8 21C8 21.9322 8.07786 22.8411 8.22182 23.7043L5.09131 26.4268C4.79584 26.679 4.73849 27.184 4.9641 27.5236L7.9641 32.0536C8.1897 32.3933 8.65243 32.5116 9.00876 32.3066L12.4196 30.3885C13.6503 31.3354 15.0182 32.084 16.4816 32.5875L17.0206 36.3415C17.0786 36.7426 17.4145 37.0412 17.807 37.0412H30.193C30.5855 37.0412 30.9214 36.7426 30.9794 36.3415L31.5184 32.5875C32.9818 32.084 34.3497 31.3354 35.5804 30.3885L38.9912 32.3066C39.3476 32.5116 39.8103 32.3933 40.0359 32.0536L43.0359 27.5236C43.2615 27.184 43.2042 26.679 42.9087 26.4268L39.7782 23.7043C39.9221 22.8411 40 21.9322 40 21C40 20.0678 39.9221 19.1589 39.7782 18.2957L42.9087 15.5732C43.2042 15.321 43.2615 14.816 43.0359 14.4764L40.0359 9.94643C39.8103 9.60672 39.3476 9.48843 38.9912 9.69343L35.5804 11.6115C34.3497 10.6646 32.9818 9.91602 31.5184 9.41253L30.9794 5.65846C30.9214 5.25735 30.5855 4.95874 30.193 4.95874H17.807C17.4145 4.95874 17.0786 5.25735 17.0206 5.65846L16.4816 9.41253C15.0182 9.91602 13.6503 10.6646 12.4196 11.6115L9.00876 9.69343C8.65243 9.48843 8.1897 9.60672 7.9641 9.94643L4.9641 14.4764C4.73849 14.816 4.79584 15.321 5.09131 15.5732L8.22182 18.2957Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <h1>{t("hero.title")}</h1>
        <p>{t("hero.subtitle")}</p>
      </header>

      <main className="container">
        <section className="card">
          <div className="card__header">
            <div>
              <h2>{t("create.title")}</h2>
              <p className="muted">{t("create.description")}</p>
            </div>
            <div className="card__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleImportClipboard}
                disabled={isImportingClipboard || type !== "text"}
                title={
                  type === "text"
                    ? t("tooltip.importClipboard")
                    : t("tooltip.switchToText")
                }
              >
                {isImportingClipboard
                  ? t("buttons.importingClipboard")
                  : t("buttons.importClipboard")}
              </button>
            </div>
          </div>

          <div className="remote-form">
            <div className="remote-form__split">
              <div className="stack">
                <div className="field field--horizontal">
                  <span className="field__label">{t("form.contentType")}</span>
                  <div className="pill-group">
                    <button
                      type="button"
                      className={`pill ${type === "text" ? "pill--active" : ""}`}
                      onClick={() => setType("text")}
                    >
                      {t("form.textType")}
                    </button>
                    <button
                      type="button"
                      className={`pill ${type === "file" ? "pill--active" : ""}`}
                      onClick={() => setType("file")}
                    >
                      {t("form.fileType")}
                    </button>
                  </div>
                </div>

                {type === "text" ? (
                  <label className="field">
                    <span className="field__label">{t("form.textLabel")}</span>
                    <textarea
                      value={textContent}
                      onChange={(event) => setTextContent(event.target.value)}
                      placeholder={t("form.textPlaceholder")}
                      rows={6}
                    />
                  </label>
                ) : (
                  <label className="field">
                    <span className="field__label">{t("form.fileLabel")}</span>
                    <input type="file" onChange={handleFileSelect} accept="*" />
                    {selectedFile ? (
                      <div className="file-preview">
                        <span className="file-preview__name">
                          {selectedFile.name}
                        </span>
                        <span className="file-preview__meta">
                          {formatBytes(selectedFile.size)} ·{" "}
                          {selectedFile.type || t("form.unknownType")}
                        </span>
                      </div>
                    ) : (
                      <p className="muted">{t("form.fileSupport")}</p>
                    )}
                  </label>
                )}
              </div>

              <div className="stack">
                <label className="field">
                  <span className="field__label">{t("form.expiryHoursLabel")}</span>
                  <input
                    type="number"
                    min={MIN_EXPIRY_HOURS}
                    max={MAX_EXPIRY_HOURS}
                    value={expiresInHours}
                    onChange={(event) => setExpiresInHours(Number(event.target.value))}
                  />
                  <span className="field__hint">
                    {t("form.expiryHint", {
                      min: MIN_EXPIRY_HOURS,
                      max: MAX_EXPIRY_HOURS
                    })}
                  </span>
                </label>

                <label className="field">
                  <span className="field__label">{t("form.maxDownloadsLabel")}</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={maxDownloads}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setMaxDownloads(
                        Number.isNaN(value) ? 0 : Math.round(value)
                      );
                    }}
                  />
                  <div className="field__options">
                    {MAX_DOWNLOADS_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="btn btn--tiny"
                        onClick={() => setMaxDownloads(option)}
                      >
                        {t("form.maxDownloadsOption", { value: option })}
                      </button>
                    ))}
                  </div>
                  <span className="field__hint">
                    {t("form.maxDownloadsHint", { value: DEFAULT_MAX_DOWNLOADS })}
                  </span>
                </label>

                <fieldset className="field field--group">
                  <legend className="field__label">{t("form.accessCredential")}</legend>
                  <label className="radio">
                    <input
                      type="radio"
                      name="access-mode"
                      value="code"
                      checked={accessMode === "code"}
                      onChange={() => setAccessMode("code")}
                    />
                    <div className="radio__content">
                      <span>{t("form.accessWithCode")}</span>
                      <div className="radio__inline">
                        <strong className="code">{shortCode}</strong>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => setShortCode(generateAccessCode())}
                          disabled={accessMode !== "code"}
                        >
                          {t("buttons.refresh")}
                        </button>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`radio ${settings.persistentToken ? "" : "radio--disabled"}`}
                  >
                    <input
                      type="radio"
                      name="access-mode"
                      value="token"
                      checked={accessMode === "token"}
                      onChange={() => setAccessMode("token")}
                      disabled={!settings.persistentToken}
                    />
                    <div className="radio__content">
                      <span>{t("form.accessWithToken")}</span>
                      {settings.persistentToken ? (
                        <span className="code code--inline">
                          {settings.persistentToken}
                        </span>
                      ) : (
                        <span className="muted small">{t("form.tokenMissing")}</span>
                      )}
                      {settings.persistentToken && tokenExpiryNotice ? (
                        <span className="settings-meta">{tokenExpiryNotice}</span>
                      ) : null}
                    </div>
                  </label>
                </fieldset>

                {isCaptchaEnabled ? (
                  <div className="field">
                    <span className="field__label">{t("form.captchaLabel")}</span>
                    <span className="field__hint">{t("form.captchaHint")}</span>
                    <div className="captcha-box">
                      <Captcha
                        provider={captchaProvider as CaptchaProviderType}
                        siteKey={captchaSiteKey}
                        onTokenChange={(token) => {
                          setCaptchaToken(token ?? "");
                          setCaptchaError(null);
                        }}
                        onError={(message) => {
                          setCaptchaToken("");
                          setCaptchaError(message);
                          setToast({
                            kind: "error",
                            message
                          });
                        }}
                        resetSignal={captchaResetKey}
                        labels={{
                          loading: t("form.captchaLoading"),
                          error: t("form.captchaLoadFailed")
                        }}
                      />
                    </div>
                    {captchaError ? (
                      <span className="field__hint field__hint--error">
                        {captchaError}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn btn--secondary btn--full"
                  onClick={handleCreateRemoteClip}
                  disabled={isCreatingClip || (isCaptchaEnabled && !captchaToken)}
                >
                  {isCreatingClip ? t("buttons.creating") : t("buttons.create")}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2>{t("list.title")}</h2>
              <p className="muted">{listSummary}</p>
            </div>
          </div>

          <div className="grid">
            {remoteClips.map((clip) => {
              const consumed = clip.downloadCount >= clip.maxDownloads;
              const expired = clip.expiresAt <= now;
              const inactive = expired || consumed;
              const remainingDownloads = Math.max(
                0,
                clip.maxDownloads - clip.downloadCount
              );
              const hoursLeft = clip.expiresAt - now;
              const badgeTone = inactive
                ? "badge--danger"
                : remainingDownloads <= 2 || hoursLeft <= 60 * 60 * 1000
                ? "badge--warning"
                : "badge--ok";
              const badgeLabel = inactive
                ? consumed
                  ? t("list.badge.limitReached")
                  : t("list.badge.expired")
                : t("list.badge.remaining", {
                    duration: formatRemaining(clip.expiresAt - now)
                  });
              const directAccessUrl = clip.accessCode
                ? clip.directUrl ?? buildRelativeAccessPath(clip.accessCode)
                : "";
              const tokenAccessUrl = clip.accessToken
                ? buildRelativeAccessPath(clip.accessToken)
                : "";
              const clipTypeLabel =
                clip.type === "text"
                  ? t("list.clipType.text")
                  : t("list.clipType.file");
              const clipMeta = t("list.clipMeta", {
                created: formatDateTime(clip.createdAt),
                type: clipTypeLabel
              });
              return (
                <article
                  key={clip.id}
                  className={`remote-card ${inactive ? "remote-card--expired" : ""}`}
                >
                  <header className="remote-card__header">
                    <div>
                      <h4>{getClipTitle(clip)}</h4>
                      <span className="muted small">{clipMeta}</span>
                    </div>
                    <span className={`badge ${badgeTone}`}>{badgeLabel}</span>
                  </header>

                  <div className="remote-card__body">
                    {clip.type === "text" ? (
                      <pre className="remote-card__content">
                        {clip.payload.text ?? ""}
                      </pre>
                    ) : clip.payload.file ? (
                      <div className="file-preview">
                        <span className="file-preview__name">
                          {clip.payload.file.name}
                        </span>
                        <span className="file-preview__meta">
                          {formatBytes(clip.payload.file.size)} ·{" "}
                          {clip.payload.file.type || t("form.unknownType")}
                        </span>
                        <span className="file-preview__meta">
                          {t("list.fileMeta.downloads", {
                            count: clip.downloadCount,
                            max: clip.maxDownloads
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="muted">{t("list.fileUnavailable")}</span>
                    )}
                  </div>

                  <footer className="remote-card__footer">
                    <div className="remote-card__creds">
                      {clip.accessCode ? (
                        <button
                          type="button"
                          className="badge badge--ghost"
                          onClick={() =>
                            handleCopyAccess(directAccessUrl, "direct-link")
                          }
                        >
                          {t("list.codeLabel", { code: clip.accessCode })}
                        </button>
                      ) : null}
                      {clip.accessToken ? (
                        <button
                          type="button"
                          className="badge badge--ghost"
                          onClick={() =>
                            handleCopyAccess(
                              tokenAccessUrl,
                              "direct-link"
                            )
                          }
                        >
                          {t("list.tokenLabel", { token: clip.accessToken })}
                        </button>
                      ) : null}
                      <span className="muted small">
                        {t("list.remainingDownloads", {
                          count: remainingDownloads
                        })}
                      </span>
                    </div>
                    <div className="remote-card__actions">
                      {clip.type === "text" ? (
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => handleCopyRemoteText(clip)}
                          disabled={inactive}
                        >
                          {t("buttons.copyText")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => handleDownloadFile(clip)}
                          disabled={inactive}
                        >
                          {t("buttons.downloadFile")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--tiny btn--danger"
                        onClick={() => void handleRemoveRemoteClip(clip.id)}
                      >
                        {t("buttons.delete")}
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {isSettingsOpen ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__overlay" onClick={handleCloseSettings} />
          <div className="modal__content">
            <header className="modal__header">
              <div>
                <h3>{t("modal.title")}</h3>
                <p className="muted small">{t("modal.description")}</p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--tiny"
                onClick={handleCloseSettings}
              >
                {t("buttons.close")}
              </button>
            </header>

            <div className="stack">
              <label className="field">
                <span className="field__label">{t("modal.tokenLabel")}</span>
                <div className="field field--compact">
                  <input
                    value={settingsTokenDraft}
                    onChange={(event) => setSettingsTokenDraft(event.target.value)}
                    placeholder={t("modal.tokenPlaceholder")}
                  />
                  <button
                    type="button"
                    className="btn btn--tiny"
                    onClick={handleGeneratePersistentToken}
                  >
                    {t("buttons.generateToken")}
                  </button>
                </div>
                <span className="field__hint">
                  {t("modal.tokenHint")}
                </span>
              </label>
              {tokenLastActivityLabel ? (
                <p className="settings-meta">{tokenLastActivityLabel}</p>
              ) : null}
              {settings.persistentToken && tokenExpiryNotice ? (
                <p className="settings-meta">{tokenExpiryNotice}</p>
              ) : null}
            </div>

            <div className="settings-actions settings-actions--modal">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleSaveSettings}
              >
                {t("buttons.saveSettings")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <aside className={`toast toast--${toast.kind}`}>
          <span>{toast.message}</span>
        </aside>
      ) : null}
    </div>
  );
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default App;
