import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { HighlighterCore } from "shiki/core";
import type { SourceFile, SourceRefs } from "../course/sourceSnapshot";
import type { SourceExplorerLabels } from "../i18n/sourceExplorer";
import { GitHubIcon } from "./GitHubIcon";
import "./SourceExplorer.css";

type Language = "rust" | "toml" | "json" | "markdown";
type Token = { content: string; color?: string };
type Line = Token[];
type TreeDir = { name: string; path: string; dirs: TreeDir[]; files: SourceFile[] };
// 行列从 0 开始，列按 UTF-16 计，与跳转表一致。
type Location = { path: string; line: number; column: number };
type Link = { start: number; end: number; target: Location };
type Segment = { tokens: Token[]; link?: Link };
// seq 使重复跳到同一行时仍会重新滚动。
type Focus = { line: number; seq: number };
type SourceRequest = { path: string; seq: number };
type Props = {
  version: string;
  versionUrl?: string;
  load: () => Promise<{ files: SourceFile[]; dirs?: Record<string, [string, string]> }>;
  loadFile: (blob: string) => Promise<string>;
  loadRefs: (refs: string) => Promise<SourceRefs>;
  fileUrl: (path: string) => string | undefined;
  iconUrl: (icon: string) => string;
  // 打开时展开的目录路径；默认选中文件的上级目录总会展开。
  defaultExpanded: readonly string[];
  // 从正文路径打开时选中对应文件；目录路径只展开到该层。seq 用于重复打开同一路径。
  request?: SourceRequest;
  labels: SourceExplorerLabels;
  onClose: () => void;
};

let highlighter: Promise<HighlighterCore> | undefined;
function getHighlighter() {
  highlighter ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/langs/rust.mjs"),
    import("shiki/langs/toml.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/markdown.mjs"),
    import("shiki/themes/github-light.mjs"),
  ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }, rust, toml, json, markdown, theme]) =>
    createHighlighterCore({
      langs: [rust.default, toml.default, json.default, markdown.default],
      themes: [theme.default],
      engine: createJavaScriptRegexEngine(),
    }));
  return highlighter;
}

function languageOf(path: string): Language | undefined {
  const extension = path.slice(path.lastIndexOf(".") + 1);
  if (extension === "rs") return "rust";
  if (extension === "toml" || extension === "lock") return "toml";
  if (extension === "json") return "json";
  if (extension === "md") return "markdown";
  return undefined;
}

const byName = <T extends { name: string }>(a: T, b: T) => (a.name < b.name ? -1 : 1);
const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

function buildTree(files: SourceFile[]) {
  const root: TreeDir = { name: "", path: "", dirs: [], files: [] };
  for (const file of files) {
    let dir = root;
    for (const name of file.path.split("/").slice(0, -1)) {
      let next = dir.dirs.find(item => item.name === name);
      if (!next) {
        next = { name, path: dir.path ? `${dir.path}/${name}` : name, dirs: [], files: [] };
        dir.dirs.push(next);
      }
      dir = next;
    }
    dir.files.push(file);
  }
  const sort = (dir: TreeDir) => {
    dir.dirs.sort(byName).forEach(sort);
    dir.files.sort((a, b) => byName({ name: fileName(a.path) }, { name: fileName(b.path) }));
  };
  sort(root);
  return root;
}

function ancestors(path: string) {
  const parts = path.split("/").slice(0, -1);
  return [...parts.map((_, index) => parts.slice(0, index + 1).join("/"))];
}

function locate(files: SourceFile[], raw: string) {
  const path = raw.replace(/\/$/, "");
  if (files.some(item => item.path === path)) return { file: path, dirs: ancestors(path) };
  if (files.some(item => item.path.startsWith(`${path}/`))) return { dirs: ancestors(`${path}/x`) };
}

// 按跳转区间切分高亮 token；区间由构建期索引生成，同一行内已排序且互不重叠。
function linkTokens(line: Line, links: Link[] | undefined): Segment[] {
  if (!links) return [{ tokens: line }];
  const segments: Segment[] = [];
  let offset = 0;
  let next = 0;
  for (const token of line) {
    let start = 0;
    while (start < token.content.length) {
      const position = offset + start;
      while (next < links.length && links[next].end <= position) next++;
      const link = links[next] && links[next].start <= position ? links[next] : undefined;
      const stop = Math.min(token.content.length, (link ? link.end : links[next]?.start ?? Infinity) - offset);
      const piece = { ...token, content: token.content.slice(start, stop) };
      const last = segments.at(-1);
      if (last && last.link === link) last.tokens.push(piece);
      else segments.push({ tokens: [piece], link });
      start = stop;
    }
    offset += token.content.length;
  }
  return segments;
}

// 分屏由根节点标记驱动：面板经 Portal 渲染，不能依赖 .lesson-layout 的 :has 选择器。
const SPLIT = { initial: 45, min: 30, max: 70 };
const TREE = { initial: 260, min: 160, codeMin: 240 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function SourceExplorer({ version, versionUrl, load, loadFile, loadRefs, fileUrl, iconUrl, defaultExpanded, request, labels, onClose }: Props) {
  const [files, setFiles] = useState<SourceFile[]>();
  const [dirIcons, setDirIcons] = useState<Record<string, [string, string]>>();
  const [split, setSplit] = useState(SPLIT.initial);
  const [treeWidth, setTreeWidth] = useState(TREE.initial);
  const body = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<Focus>();
  // 跳转前的位置；文件树中直接切换文件不入栈。
  const [history, setHistory] = useState<Location[]>([]);
  const treeNav = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const requestRef = useRef(request);
  const appliedRequest = useRef<number | undefined>(undefined);
  requestRef.current = request;
  const id = useId();
  const tree = useMemo(() => files && buildTree(files), [files]);
  const file = files?.find(item => item.path === selected);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sourceExplorer = "open";
    closeButton.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) onClose(); };
    window.addEventListener("keydown", escape);
    return () => {
      delete root.dataset.sourceExplorer;
      window.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--source-split", `${split}%`);
    return () => { root.style.removeProperty("--source-split"); };
  }, [split]);

  const setTree = (value: number) => {
    const width = body.current?.clientWidth ?? 0;
    setTreeWidth(clamp(value, TREE.min, Math.max(TREE.min, width - TREE.codeMin)));
  };

  useEffect(() => {
    let active = true;
    setFailed(false);
    load().then(snapshot => {
      if (!active) return;
      const current = requestRef.current;
      const located = current && locate(snapshot.files, current.path);
      const fallback = snapshot.files.find(item => item.path === "README.md") ?? snapshot.files[0];
      const initial = located?.file ?? fallback?.path;
      setFiles(snapshot.files);
      setDirIcons(snapshot.dirs);
      setSelected(initial);
      setExpanded(new Set([...defaultExpanded, ...(initial ? ancestors(initial) : []), ...(located?.dirs ?? [])]));
      setFocus(located?.file && current ? { line: -1, seq: current.seq } : undefined);
      if (current) appliedRequest.current = current.seq;
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [load, attempt, defaultExpanded]);

  const toggle = (path: string) => setExpanded(current => {
    const next = new Set(current);
    if (!next.delete(path)) next.add(path);
    return next;
  });

  const reveal = (location: Location) => {
    setSelected(location.path);
    setFocus(current => ({ line: location.line, seq: (current?.seq ?? 0) + 1 }));
    setExpanded(current => new Set([...current, ...ancestors(location.path)]));
  };
  const navigate = (target: Location, from: Location) => {
    setHistory(current => [...current, from]);
    reveal(target);
  };
  const back = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    reveal(previous);
  };

  useEffect(() => {
    if (!files || !request || appliedRequest.current === request.seq) return;
    appliedRequest.current = request.seq;
    const located = locate(files, request.path);
    if (!located) return;
    if (located.file) {
      setHistory([]);
      setSelected(located.file);
      setFocus({ line: -1, seq: request.seq });
    }
    setExpanded(current => new Set([...current, ...located.dirs]));
  }, [files, request]);

  useEffect(() => {
    treeNav.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected, focus]);

  const icon = (name: string | undefined) => name && <img className="source-explorer__icon" src={iconUrl(name)} alt="" width={16} height={16} />;
  const renderDir = (dir: TreeDir, depth: number) => <ul>
    {dir.dirs.map(child => {
      const open = expanded.has(child.path);
      return <li key={child.path}>
        <button type="button" className="source-explorer__dir" style={{ paddingLeft: 10 + depth * 14 }} aria-expanded={open} onClick={() => toggle(child.path)}>
          <span className="source-explorer__chevron" aria-hidden="true" />{icon(dirIcons?.[child.path]?.[open ? 1 : 0])}{child.name}
        </button>
        {open && renderDir(child, depth + 1)}
      </li>;
    })}
    {dir.files.map(item => <li key={item.path}>
      <button type="button" className="source-explorer__file" style={{ paddingLeft: 26 + depth * 14 }} aria-current={item.path === selected ? "true" : undefined} onClick={() => { setSelected(item.path); setFocus(undefined); }}>
        {icon(item.icon)}{fileName(item.path)}
      </button>
    </li>)}
  </ul>;

  return createPortal(<>
    <Resizer className="source-explorer__resizer" label={labels.resizePanel} value={split} min={SPLIT.min} max={SPLIT.max} step={2}
      onChange={value => setSplit(clamp(value, SPLIT.min, SPLIT.max))} fromPointer={x => x / window.innerWidth * 100} onReset={() => setSplit(SPLIT.initial)} />
    <section className="source-explorer" id={id} aria-label={labels.title}>
    <header className="source-explorer__header">
      <h2>{labels.title}</h2>
      {versionUrl ? <a className="source-explorer__version" href={versionUrl} target="_blank" rel="noopener noreferrer" title={labels.githubTree}>
        <GitHubIcon />
        <span>{version}</span>
        <svg className="source-explorer__external" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" /></svg>
      </a> : <span className="source-explorer__version">{version}</span>}
      <button ref={closeButton} type="button" className="source-explorer__close" aria-label={labels.close} title={labels.close} onClick={onClose}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
      </button>
    </header>
    {failed ? <SourceMessage text={labels.error} retry={labels.retry} onRetry={() => setAttempt(value => value + 1)} />
      : !tree ? <SourceMessage text={labels.loading} />
      : <div ref={body} className="source-explorer__body" style={{ "--source-tree": `${treeWidth}px` } as CSSProperties}>
        <nav ref={treeNav} className="source-explorer__tree" aria-label={labels.files}>{renderDir(tree, 0)}</nav>
        <Resizer className="source-explorer__tree-resizer" label={labels.resizeTree} value={treeWidth} min={TREE.min} max={Math.max(TREE.min, (body.current?.clientWidth ?? 0) - TREE.codeMin)} step={16}
          onChange={setTree} fromPointer={x => x - (body.current?.getBoundingClientRect().left ?? 0)} onReset={() => setTree(TREE.initial)} />
        {file ? <SourceCode key={file.path} file={file} loadFile={loadFile} loadRefs={loadRefs} fileUrl={fileUrl} focus={focus}
          onNavigate={navigate} onBack={history.length ? back : undefined} labels={labels} /> : <div />}
      </div>}
    </section>
  </>, document.body);
}

// 与 CodeWorkspace 分隔条一致：拖动、方向键与 Home/End 调整，双击恢复默认宽度。
function Resizer({ className, label, value, min, max, step, onChange, fromPointer, onReset }: {
  className: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; fromPointer: (clientX: number) => number; onReset: () => void;
}) {
  return <div className={className} role="separator" tabIndex={0} aria-orientation="vertical" aria-label={label} title={label}
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)}
    onPointerDown={event => { event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onChange(fromPointer(event.clientX)); }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onDoubleClick={onReset}
    onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      onChange(event.key === "Home" ? min : event.key === "End" ? max : value + (event.key === "ArrowLeft" ? -step : step));
    }} />;
}

function SourceMessage({ text, retry, onRetry }: { text: string; retry?: string; onRetry?: () => void }) {
  return <div className="source-explorer__message" role="status">
    <p>{text}</p>
    {retry && onRetry && <button type="button" onClick={onRetry}>{retry}</button>}
  </div>;
}

function renderTokens(tokens: Token[]) {
  return tokens.map((token, i) => <span key={i} style={token.color ? { color: token.color } : undefined}>{token.content}</span>);
}

function SourceCode({ file, loadFile, loadRefs, fileUrl, focus, onNavigate, onBack, labels }: {
  file: SourceFile; loadFile: Props["loadFile"]; loadRefs: Props["loadRefs"]; fileUrl: Props["fileUrl"]; focus: Focus | undefined;
  onNavigate: (target: Location, from: Location) => void; onBack: (() => void) | undefined; labels: SourceExplorerLabels;
}) {
  const [lines, setLines] = useState<Line[]>();
  const [links, setLinks] = useState<Map<number, Link[]>>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const code = useRef<HTMLPreElement>(null);
  const ready = lines !== undefined;

  useEffect(() => {
    if (!file.refs) return;
    let active = true;
    loadRefs(file.refs).then(({ targets, refs }) => {
      if (!active) return;
      const byLine = new Map<number, Link[]>();
      for (const [line, start, end, index] of refs) {
        const [path, targetLine, column] = targets[index];
        const link = { start, end, target: { path, line: targetLine, column } };
        const list = byLine.get(line);
        if (list) list.push(link);
        else byLine.set(line, [link]);
      }
      setLinks(byLine);
    }).catch(() => { /* 跳转表不可用时仍可阅读源码。 */ });
    return () => { active = false; };
  }, [file.refs, loadRefs]);

  // 跳转后把目标行滚到代码区中部，并把焦点交给代码区：被点击的链接可能已随文件切换卸载。
  useEffect(() => {
    const pre = code.current;
    if (!pre || !focus) return;
    if (focus.line < 0) {
      pre.scrollTop = 0;
      pre.focus({ preventScroll: true });
      return;
    }
    const line = pre.querySelector<HTMLElement>(`[data-line="${focus.line + 1}"]`);
    if (!line) return;
    pre.scrollTop += line.getBoundingClientRect().top - pre.getBoundingClientRect().top - (pre.clientHeight - line.offsetHeight) / 2;
    pre.focus({ preventScroll: true });
  }, [focus, ready]);

  useEffect(() => {
    if (!file.blob) return;
    let active = true;
    setFailed(false);
    loadFile(file.blob).then(async text => {
      const body = text.endsWith("\n") ? text.slice(0, -1) : text;
      if (!active) return;
      setLines(body.split("\n").map(content => [{ content }]));
      const language = languageOf(file.path);
      if (!language) return;
      try {
        const { tokens } = (await getHighlighter()).codeToTokens(body, { lang: language, theme: "github-light" });
        if (active) setLines(tokens);
      } catch { /* 高亮不可用时保留纯文本。 */ }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [file.blob, file.path, loadFile, attempt]);

  const skipped = file.skipped === "binary" ? labels.binary : file.skipped === "too_large" ? labels.tooLarge : undefined;
  return <div className="source-explorer__view">
    <div className="source-explorer__path">
      {onBack && <button type="button" className="source-explorer__back" aria-label={labels.back} title={labels.back} onClick={onBack}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5 7 10l5 5" /></svg>
      </button>}
      <span>{file.path}</span>
      {lines && <span>{lines.length} {labels.lines}</span>}
      {fileUrl(file.path) && <a href={fileUrl(file.path)} target="_blank" rel="noopener noreferrer">
        {labels.github}
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" /></svg>
      </a>}
    </div>
    {skipped ? <SourceMessage text={skipped} />
      : failed ? <SourceMessage text={labels.error} retry={labels.retry} onRetry={() => setAttempt(value => value + 1)} />
      : !lines ? <SourceMessage text={labels.loading} />
      : <pre ref={code} className="source-explorer__code" tabIndex={0} aria-label={`${labels.code}: ${file.path}`}><code>
        {lines.map((line, index) => <span className="source-explorer__line" data-line={index + 1} data-target={focus?.line === index ? "true" : undefined} key={index}>
          {linkTokens(line, links?.get(index)).map(({ tokens, link }, i) => {
            if (!link) return <Fragment key={i}>{renderTokens(tokens)}</Fragment>;
            const { target } = link;
            // href 指向 GitHub 同一位置，修饰键点击或中键可在新标签页打开；普通点击在面板内跳转。
            return <a key={i} className="source-explorer__ref" href={fileUrl(target.path) ? `${fileUrl(target.path)}#L${target.line + 1}` : `#source-${encodeURIComponent(target.path)}-L${target.line + 1}`} title={`${labels.definition}: ${target.path}:${target.line + 1}`}
              onClick={event => {
                if (fileUrl(target.path) && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
                event.preventDefault();
                onNavigate(target, { path: file.path, line: index, column: link.start });
              }}>{renderTokens(tokens)}</a>;
          })}{"\n"}
        </span>)}
      </code></pre>}
  </div>;
}
