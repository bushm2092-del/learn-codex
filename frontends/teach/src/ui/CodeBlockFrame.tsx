import { useId, useState, type ReactNode } from "react";
import { useLocale } from "../i18n/useLocale";
import "./CodeBlock.css";

const COLLAPSE_AFTER_LINES = 18;

export function CodeBlockFrame({ code, label, language, children }: {
  code: string;
  label: string;
  language?: string;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const lineCount = code.split("\n").length;
  const collapsible = lineCount > COLLAPSE_AFTER_LINES;
  const action = expanded ? (locale === "zh" ? "收起代码" : "Collapse code")
    : (locale === "zh" ? `展开全部（${lineCount} 行）` : `Show all ${lineCount} lines`);

  return <figure className="ui-code-block">
    <figcaption><span>{label}</span>{language && <span>{language}</span>}</figcaption>
    <div id={contentId} className={collapsible && !expanded ? "ui-code-block__preview" : undefined}>
      {children}
    </div>
    {collapsible && <button
      type="button"
      className="ui-code-block__toggle"
      aria-controls={contentId}
      aria-expanded={expanded}
      aria-label={`${label}：${action}`}
      onClick={() => setExpanded(value => !value)}
    >{action}<span className="ui-code-block__chevron" aria-hidden="true" /></button>}
  </figure>;
}
