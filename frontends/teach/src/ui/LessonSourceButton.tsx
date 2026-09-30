import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { loadSnapshot, loadSourceBlob, loadSourceRefs, sourceFileUrl, sourceIconUrl, sourceTreeUrl, useLessonSnapshot } from "../course/sourceSnapshot";
import { sourceExplorer } from "../i18n/sourceExplorer";
import { useLocale } from "../i18n/useLocale";
import { LESSON_SOURCE_OPEN, type LessonSourceOpen } from "./lessonSource";
import "./LessonSourceButton.css";

const SourceExplorer = lazy(() => import("./SourceExplorer").then(module => ({ default: module.SourceExplorer })));
// 与 CodeWorkspace 共用打开事件，保证右侧同一时间只有一个分屏面板。
const SOURCE_EXPLORER_ID = "source-explorer";
const DEFAULT_EXPANDED = ["crates"];

// 章节标题行的源码入口与面板；本章没有快照时不渲染。
// 标题行按钮滚出视口后，右下角显示同功能的悬浮按钮；面板打开期间由面板自身的关闭按钮接管。
export function LessonSourceButton({ lesson }: { lesson: string }) {
  const { locale } = useLocale();
  const snapshot = useLessonSnapshot(lesson);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<{ path: string; seq: number }>();
  const [inlineVisible, setInlineVisible] = useState(true);
  const inline = useRef<HTMLButtonElement>(null);
  const floating = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const labels = sourceExplorer[locale];
  const load = useCallback(() => loadSnapshot(lesson), [lesson]);
  const fileUrl = useCallback((path: string) => sourceFileUrl(snapshot!, path), [snapshot]);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      // 悬浮按钮在面板打开期间卸载，关闭后是新元素；标题行不可见时把焦点交给它。
      const target = opener.current?.isConnected ? opener.current : floating.current ?? inline.current;
      target?.focus({ preventScroll: true });
    });
  }, []);
  const show = (trigger: HTMLButtonElement) => {
    opener.current = trigger;
    setRequest(undefined);
    setOpen(true);
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<LessonSourceOpen>).detail;
      if (detail?.lesson !== lesson) return;
      opener.current = inline.current;
      setRequest({ path: detail.path, seq: Date.now() });
      setOpen(true);
    };
    window.addEventListener(LESSON_SOURCE_OPEN, onOpen);
    return () => window.removeEventListener(LESSON_SOURCE_OPEN, onOpen);
  }, [lesson]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("code-workspace-open", { detail: SOURCE_EXPLORER_ID }));
    const closeForOther = (event: Event) => { if ((event as CustomEvent).detail !== SOURCE_EXPLORER_ID) setOpen(false); };
    window.addEventListener("code-workspace-open", closeForOther);
    return () => window.removeEventListener("code-workspace-open", closeForOther);
  }, [open]);

  useEffect(() => {
    const target = inline.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting), { rootMargin: "-58px 0px 0px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [snapshot]);

  if (!snapshot) return null;
  const icon = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 6-4 4 4 4m6-8 4 4-4 4" /></svg>;
  return <>
    <button ref={inline} type="button" className="lesson-source-button" aria-expanded={open} onClick={event => (open ? close() : show(event.currentTarget))}>
      {icon}{open ? labels.close : labels.view}
    </button>
    {!open && !inlineVisible && createPortal(
      <button ref={floating} type="button" className="lesson-source-float" aria-expanded={false} onClick={event => show(event.currentTarget)}>
        {icon}{labels.view}
      </button>, document.body)}
    {open && <Suspense fallback={null}>
      <SourceExplorer version={`${snapshot.branch} · ${snapshot.commit.slice(0, 7)}`} versionUrl={sourceTreeUrl(snapshot)} load={load} loadFile={loadSourceBlob} loadRefs={loadSourceRefs}
        fileUrl={fileUrl} iconUrl={sourceIconUrl} defaultExpanded={DEFAULT_EXPANDED} request={request} labels={labels} onClose={close} />
    </Suspense>}
  </>;
}
