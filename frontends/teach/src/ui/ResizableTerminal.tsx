import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function ResizableTerminal({ label, status, resizeLabel, children }: {
  label: string; status: ReactNode; resizeLabel: string; children: ReactNode;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number>();
  const measuredHeight = () => root.current?.querySelector(".json-output")?.getBoundingClientRect().height ?? 216;
  const resize = (next: number) => {
    const editorHeight = root.current?.parentElement?.querySelector(".rust-editor")?.getBoundingClientRect().height ?? 0;
    const maximum = root.current?.closest(".code-workspace--split")
      ? Math.max(96, editorHeight + measuredHeight() - 120)
      : window.innerHeight * .6;
    setHeight(Math.max(96, Math.min(maximum, next)));
  };

  return <div ref={root} className="rust-sandbox__terminal-shell" style={{ "--terminal-height": height === undefined ? undefined : `${height}px` } as CSSProperties}>
    {open && <div className="rust-sandbox__terminal-resizer" role="separator" tabIndex={0}
      aria-label={resizeLabel} title={resizeLabel} aria-orientation="horizontal" aria-controls={id}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (height ?? window.innerHeight * .24) / window.innerHeight * 100))}
      onPointerDown={event => {
        event.preventDefault(); event.currentTarget.focus();
        drag.current = { y: event.clientY, height: measuredHeight() };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) resize(drag.current.height + drag.current.y - event.clientY);
      }}
      onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onLostPointerCapture={() => { drag.current = null; }}
      onDoubleClick={() => setHeight(undefined)}
      onKeyDown={event => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        resize(event.key === "Home" ? 96 : event.key === "End" ? window.innerHeight : measuredHeight() + (event.key === "ArrowUp" ? 24 : -24));
      }} />}
    <details className="rust-sandbox__terminal" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="rust-sandbox__terminal-heading"><span>{label}</span>{status}</summary>
      <div id={id} className="rust-sandbox__terminal-body">{children}</div>
    </details>
  </div>;
}
