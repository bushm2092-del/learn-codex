import { useLocale } from "../i18n/useLocale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import "./LanguageMenu.css";

// 语言组件负责选项与状态绑定；持久化仍由 i18n Provider 管理。
export function LanguageMenu() {
  const { locale, setLocale, copy } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="language-trigger" aria-label={copy.navigation.languageMenu}>
        <span>{locale === "zh" ? "中文" : "EN"}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={copy.navigation.languageMenu}>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => {
          if (value === "zh" || value === "en") setLocale(value);
        }}>
          <DropdownMenuRadioItem value="zh" lang="zh-CN">中文</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en" lang="en">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
