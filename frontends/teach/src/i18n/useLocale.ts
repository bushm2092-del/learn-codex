import { useContext } from "react";

import { LocaleContext } from "./locale";

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale 必须在 LocaleProvider 内使用");
  }

  return context;
}
