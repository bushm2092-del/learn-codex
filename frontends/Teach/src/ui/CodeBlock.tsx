import { useEffect, useState } from "react";
import type { ThemedToken } from "shiki/core";
import "./CodeBlock.css";

const highlighter = Promise.all([
  import("shiki/core"),
  import("shiki/engine/javascript"),
  import("shiki/langs/rust.mjs"),
  import("shiki/themes/github-light.mjs"),
]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }, rust, theme]) =>
  createHighlighterCore({
    langs: [rust.default],
    themes: [theme.default],
    engine: createJavaScriptRegexEngine(),
  }),
);

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [highlighted, setHighlighted] = useState<{ code: string; tokens: ThemedToken[][] }>();
  useEffect(() => {
    let active = true;
    highlighter.then((instance) => {
      const { tokens } = instance.codeToTokens(code, { lang: "rust", theme: "github-light" });
      if (active) setHighlighted({ code, tokens });
    }).catch(() => { /* 高亮不可用时仍展示可读的原始代码。 */ });
    return () => { active = false; };
  }, [code]);

  return (
    <figure className="ui-code-block">
      <figcaption><span>{label}</span><span>Rust</span></figcaption>
      <pre tabIndex={0} aria-label={label}><code>{highlighted?.code === code
        ? highlighted.tokens.map((line, index) => <span key={index}>{line.map((token, i) =>
          <span key={i} style={{ color: token.color }}>{token.content}</span>)}{index < highlighted.tokens.length - 1 ? "\n" : ""}</span>)
        : code}</code></pre>
    </figure>
  );
}
