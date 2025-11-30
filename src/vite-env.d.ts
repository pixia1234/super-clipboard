/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAPTCHA_PROVIDER?: "turnstile" | "recaptcha";
  readonly VITE_CAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
