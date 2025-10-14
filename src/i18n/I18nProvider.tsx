import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  availableLocales,
  defaultLocale,
  Locale,
  translations,
  TranslationValue
} from "./locales";

const LOCALE_STORAGE_KEY = "super-clipboard::locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  formatDateTime: (timestamp: number) => string;
  formatDuration: (milliseconds: number) => string;
  formatRemaining: (milliseconds: number) => string;
  options: typeof availableLocales;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const matchLocale = (value: string): Locale | undefined => {
  const direct = availableLocales.find((item) => item.value === value);
  if (direct) {
    return direct.value;
  }
  const base = value.split("-")[0];
  if (base === "en") {
    return "en";
  }
  if (base === "ja") {
    return "ja";
  }
  if (base === "zh") {
    return "zh-CN";
  }
  return undefined;
};

const resolveInitialLocale = (): Locale => {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      const matchedStored = matchLocale(stored);
      if (matchedStored) {
        return matchedStored;
      }
    }
    const browser = window.navigator.language;
    if (browser) {
      const matchedBrowser = matchLocale(browser);
      if (matchedBrowser) {
        return matchedBrowser;
      }
    }
  }
  return defaultLocale;
};

const resolveTranslation = (
  key: string,
  locale: Locale
): TranslationValue | undefined => {
  const dict = translations[locale];
  if (dict && dict[key] !== undefined) {
    return dict[key];
  }
  const fallbackDict = translations[defaultLocale];
  return fallbackDict[key];
};

const createFormatter = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  });

export const I18nProvider = ({ children }: PropsWithChildren) => {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);
  const [dateFormatter, setDateFormatter] = useState(() => createFormatter(locale));

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    setDateFormatter(createFormatter(locale));
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const translate = (key: string, params?: Record<string, unknown>): string => {
      const entry = resolveTranslation(key, locale);
      if (!entry) {
        return key;
      }
      if (typeof entry === "function") {
        return String(entry(params ?? {}));
      }
      return String(entry);
    };

    const formatDuration = (milliseconds: number): string => {
      if (milliseconds <= 0) {
        return translate("time.zeroMinutes");
      }
      const totalMinutes = Math.floor(milliseconds / (60 * 1000));
      if (totalMinutes <= 0) {
        return translate("time.zeroMinutes");
      }
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;

      if (days > 0) {
        if (hours > 0) {
          return translate("time.daysHours", { days, hours });
        }
        return translate("time.daysOnly", { days });
      }

      if (hours > 0) {
        return translate("time.hoursMinutes", { hours, minutes });
      }

      return translate("time.minutesOnly", { minutes: Math.max(1, minutes) });
    };

    const formatRemaining = (milliseconds: number): string => {
      if (milliseconds <= 0) {
        return translate("time.expired");
      }
      return formatDuration(milliseconds);
    };

    const formatDateTime = (timestamp: number): string =>
      dateFormatter.format(new Date(timestamp));

    return {
      locale,
      setLocale,
      t: translate,
      formatDateTime,
      formatDuration,
      formatRemaining,
      options: availableLocales
    };
  }, [dateFormatter, locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
