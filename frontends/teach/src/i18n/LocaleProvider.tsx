import { useEffect, useMemo, useState, type PropsWithChildren } from "react";

import {
  LOCALE_STORAGE_KEY,
  LocaleContext,
  messages,
  type Locale,
} from "./locale";

function getInitialLocale(): Locale {
  try {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale === "zh" || savedLocale === "en") {
      return savedLocale;
    }
  } catch {
    // Storage may be unavailable in privacy-restricted contexts; Chinese remains the product default.
  }

  return "zh";
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // The selected language still works for this session when storage is unavailable.
    }
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, copy: messages[locale] }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
