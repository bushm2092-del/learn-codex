import { useMemo } from "react";
import { CodeBlockFrame } from "./CodeBlockFrame";
import "./JsonOutput.css";

function formatOutput(output: string) {
  try {
    return { text: JSON.stringify(JSON.parse(output), null, 2), isJson: true };
  } catch {
    // 编译诊断、普通 stdout 和截断的 JSON 保留原文。
    return { text: output || "—", isJson: false };
  }
}

export function JsonCodeBlock({ output, label }: { output: string; label: string }) {
  const formatted = useMemo(() => formatOutput(output), [output]);
  return <CodeBlockFrame code={formatted.text} label={label}>
    <JsonOutput output={output} label={label} />
  </CodeBlockFrame>;
}

export function JsonOutput({ output, label }: { output: string; label: string }) {
  const formatted = useMemo(() => formatOutput(output), [output]);
  // 只对已验证的 JSON 分词，所有内容仍由 React 作为文本转义。
  const tokens = useMemo(() => formatted.isJson ? formatted.text.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g).map((token, index) => {
    const kind = token.startsWith('"') ? (token.endsWith(":") ? "key" : "string")
      : /^(true|false|null)$/.test(token) ? "literal"
      : /^-?\d/.test(token) ? "number" : undefined;
    return <span key={index} className={kind ? `json-output__${kind}` : undefined}>{token}</span>;
  }) : formatted.text, [formatted]);

  return <pre className="json-output" tabIndex={0} aria-label={label}><code>{tokens}</code></pre>;
}
