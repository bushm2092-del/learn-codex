import "./DirectoryComparison.css";

type Props = {
  caption: string;
  mapping: string;
  rows: readonly { path: string; label: string }[];
};

export function DirectoryComparison({ caption, mapping, rows }: Props) {
  return <figure className="directory-comparison">
    <div className="directory-comparison__scroll" tabIndex={0} role="region" aria-label={caption}>
      <div className="directory-comparison__grid">
        <header><strong>Codex</strong><code>codex-rs/</code></header>
        <div className="directory-comparison__ratio">1:1</div>
        <header><strong>mini-codex</strong><code>mini-codex-rs/crates/</code></header>
        <code className="directory-comparison__root">core/src/</code><span/><code className="directory-comparison__root">core/src/</code>
        {rows.map(({ path, label }) => <div className="directory-comparison__row" key={path}>
          <code>{path}</code>
          <span className="directory-comparison__link"><span>{label}</span><svg viewBox="0 0 120 12" aria-hidden="true"><path d="M0 6h117m-5-4 5 4-5 4"/></svg></span>
          <code>{path}</code>
        </div>)}
      </div>
    </div>
    <figcaption><strong>{mapping}</strong><span>{caption}</span></figcaption>
  </figure>;
}
