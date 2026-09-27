import { useMemo } from "react";
import "./JsonOutput.css";

export function JsonOutput({ output, label }: { output: string; label: string }) {
  const formatted = useMemo(() => {
    try {
      const text = JSON.stringify(JSON.parse(output), null, 2);
      // 只对已验证的 JSON 分词，所有内容仍由 React 作为文本转义。
      return text.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g).map((token, index) => {
        const kind = token.startsWith('"') ? (token.endsWith(":") ? "key" : "string")
          : /^(true|false|null)$/.test(token) ? "literal"
          : /^-?\d/.test(token) ? "number" : undefined;
        return <span key={index} className={kind ? `json-output__${kind}` : undefined}>{token}</span>;
      });
    } catch {
      // 编译诊断、普通 stdout 和截断的 JSON 保留原文。
      return output || "—";
    }
  }, [output]);

  return <pre className="json-output" tabIndex={0} aria-label={label}><code>{formatted}</code></pre>;
}
