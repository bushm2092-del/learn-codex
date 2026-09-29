import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./CodeWorkspace.css";
import { JsonOutput } from "./JsonOutput";
import { Select } from "./Select";

export type WorkspaceExample = { id: string; label: string; code: string; runnable?: boolean };
type Props = { children: (controls: ReactNode) => ReactNode; openLabel: string; closeLabel: string; title: string; resizeLabel: string; fullscreenLabel: string; restoreLabel: string; movedLabel: string; examples?: WorkspaceExample[]; exampleId?: string; catalogLabel: string; readonlyLabel: string };

// 只改变布局，不移动或重新挂载编辑器，保留源码、撤销历史、Key 和运行任务。
export function CodeWorkspace({ children, openLabel, closeLabel, title, resizeLabel, fullscreenLabel, restoreLabel, movedLabel, examples, exampleId, catalogLabel, readonlyLabel }: Props) {
  const [split, setSplit] = useState(false);
  const [ratio, setRatio] = useState(48);
  const [fullscreen, setFullscreen] = useState(false);
  const [selected, setSelected] = useState<string>();
  const preview = split ? examples?.find(item => item.id === selected && !item.runnable) : undefined;
  const root = useRef<HTMLDivElement>(null);
  const clamp = (value: number) => Math.min(62, Math.max(30, value));
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const leave = () => { setSplit(false); setFullscreen(false); requestAnimationFrame(() => trigger.current?.focus()); };

  useEffect(() => {
    if (!split) return;
    const layout = root.current?.closest<HTMLElement>(".lesson-layout");
    if (layout) layout.dataset.workspaceOwner = id;
    layout?.style.setProperty("--code-split", `${fullscreen ? 0 : ratio}%`);
    return () => {
      if (layout?.dataset.workspaceOwner === id) {
        layout.style.removeProperty("--code-split");
        delete layout.dataset.workspaceOwner;
      }
    };
  }, [split, ratio, fullscreen, id]);

  useEffect(() => {
    const switchWorkspace = (event: Event) => {
      const detail = (event as CustomEvent<string | { target: string; ratio: number; fullscreen: boolean }>).detail;
      if (typeof detail === "string") {
        if (detail !== id) setSplit(false);
      } else if (detail.target === exampleId) {
        setSelected(undefined); setRatio(detail.ratio); setFullscreen(detail.fullscreen); setSplit(true);
      } else setSplit(false);
    };
    window.addEventListener("code-workspace-open", switchWorkspace);
    return () => window.removeEventListener("code-workspace-open", switchWorkspace);
  }, [id, exampleId]);

  useEffect(() => {
    if (!split) return;
    trigger.current?.focus({ preventScroll: true });
    const media = window.matchMedia("(min-width: 1100px)");
    const resize = () => { if (!media.matches) setSplit(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) leave();
    };
    media.addEventListener("change", resize);
    window.addEventListener("keydown", escape);
    return () => { media.removeEventListener("change", resize); window.removeEventListener("keydown", escape); };
  }, [split]);

  const controls = <div className="code-workspace__controls" role="group" aria-label={title}>
      <button ref={trigger} type="button" aria-pressed={split} aria-controls={id} aria-label={split ? closeLabel : openLabel} title={split ? closeLabel : openLabel} onClick={() => {
        if (split) { leave(); return; }
        window.dispatchEvent(new CustomEvent("code-workspace-open", { detail: id }));
        setFullscreen(false);
        setSelected(undefined);
        setSplit(true);
      }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="2" /><path d="M10 3v14" /></svg>
      </button>
      {split && <button type="button" aria-pressed={fullscreen} aria-label={fullscreen ? restoreLabel : fullscreenLabel} title={fullscreen ? restoreLabel : fullscreenLabel} onClick={() => setFullscreen(value => !value)}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d={fullscreen ? "M2 7h5V2m6 0v5h5M2 13h5v5m6 0v-5h5" : "M7 2H2v5m11-5h5v5M2 13v5h5m6 0h5v-5"} />
        </svg>
      </button>}
    </div>;

  return <div ref={root} className={`code-workspace${split ? " code-workspace--split" : ""}${split && fullscreen ? " code-workspace--fullscreen" : ""}`}>
    {split && !fullscreen && <div className="code-workspace__resizer" role="separator" tabIndex={0}
      aria-label={resizeLabel} title={resizeLabel} aria-orientation="vertical" aria-controls={id}
      aria-valuemin={30} aria-valuemax={62} aria-valuenow={Math.round(ratio)}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setRatio(clamp(event.clientX / window.innerWidth * 100)); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onDoubleClick={() => setRatio(48)}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        setRatio(value => event.key === "Home" ? 30 : event.key === "End" ? 62 : clamp(value + (event.key === "ArrowLeft" ? -2 : 2)));
      }} />}
    <div className="code-workspace__panel" id={id} data-preview={!!preview}>
      {split && examples && <div className="code-workspace__catalog">
        <label htmlFor={`${id}-catalog`}>{catalogLabel} <span>{examples.length}</span></label>
        <Select id={`${id}-catalog`} label={catalogLabel} value={preview?.id ?? exampleId}
          options={examples.map((item, index) => ({ value: item.id, label: `${index + 1}. ${item.label}` }))}
          onValueChange={value => {
          const next = examples.find(item => item.id === value);
          if (!next) return;
          if (next.runnable && next.id !== exampleId) {
            window.dispatchEvent(new CustomEvent("code-workspace-open", { detail: { target: next.id, ratio, fullscreen } }));
          } else setSelected(next.runnable ? undefined : next.id);
        }} />
      </div>}
      {children(preview ? null : controls)}
      {preview && <div className="code-workspace__reference">
        <div className="code-workspace__reference-heading"><span>{readonlyLabel}</span>{controls}</div>
        <JsonOutput output={preview.code} label={preview.label} />
      </div>}
    </div>
    {split && !fullscreen && <button className="code-workspace__placeholder" type="button" aria-controls={id} onClick={() => {
      setSelected(undefined);
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(".cm-content")?.focus({ preventScroll: true }));
    }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
      <span>{movedLabel}</span>
    </button>}
  </div>;
}
