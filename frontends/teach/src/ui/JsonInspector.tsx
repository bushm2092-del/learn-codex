import "./JsonInspector.css";
export function JsonInspector({ title, value, highlightedLines = [] }: { title: string; value: unknown; highlightedLines?: number[] }) {
  const lines = JSON.stringify(value, null, 2).split("\n");
  return <section className="json-inspector"><h3>{title}</h3><pre tabIndex={0} aria-label={title}><code>{lines.map((line, i) => <span key={i} className={highlightedLines.includes(i) ? "json-inspector__new" : undefined}>{line}{"\n"}</span>)}</code></pre></section>;
}
