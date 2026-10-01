import { useEffect, useState } from "react";
import type { ThemedToken } from "shiki/core";
import { CodeBlockFrame } from "./CodeBlockFrame";

const highlighter = Promise.all([
  import("shiki/core"),
  import("shiki/engine/javascript"),
  import("shiki/langs/rust.mjs"),
  import("shiki/langs/bash.mjs"),
  import("shiki/langs/toml.mjs"),
  import("shiki/langs/json.mjs"),
  import("shiki/langs/jsonc.mjs"),
  import("shiki/themes/github-light.mjs"),
]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }, rust, bash, toml, json, jsonc, theme]) =>
  createHighlighterCore({
    langs: [rust.default, bash.default, toml.default, json.default, jsonc.default],
    themes: [theme.default],
    engine: createJavaScriptRegexEngine(),
  }),
);

export function CodeBlock({ code, label, language = "rust" }: { code: string; label: string; language?: string }) {
  const [highlighted, setHighlighted] = useState<{ code: string; language: string; tokens: ThemedToken[][] }>();
  useEffect(() => {
    if (!["rust", "bash", "toml", "json", "jsonc"].includes(language)) return;
    let active = true;
    highlighter.then((instance) => {
      const { tokens } = instance.codeToTokens(code, { lang: language, theme: "github-light" });
      if (active) setHighlighted({ code, language, tokens });
    }).catch(() => { /* 高亮不可用时仍展示可读的原始代码。 */ });
    return () => { active = false; };
  }, [code, language]);

  const languageLabel = language === "bash" ? "Bash" : language === "toml" ? "TOML" : language === "rust" ? "Rust" : language.startsWith("json") ? "JSON" : language;

  return (
    <CodeBlockFrame code={code} label={label} language={language === "text" || label.toLowerCase() === languageLabel.toLowerCase() ? undefined : languageLabel}>
      <pre tabIndex={0} aria-label={label}><code>{highlighted?.code === code && highlighted.language === language
        ? highlighted.tokens.map((line, index) => <span key={index}>{line.map((token, i) =>
          <span key={i} style={{ color: token.color }}>{token.content}</span>)}{index < highlighted.tokens.length - 1 ? "\n" : ""}</span>)
        : code}</code></pre>
    </CodeBlockFrame>
  );
}
