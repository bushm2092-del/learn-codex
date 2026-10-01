import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ContextFilm, CONTEXT_FPS, CONTEXT_STEP_FRAMES } from "../lessons/context/ContextFilm";
import type { ContextTrace } from "../lessons/context/types";
import { contextTransport } from "../i18n/contextAnimations";
import "./ContextTracePlayer.css";

export function ContextTracePlayer({ trace, locale }: { trace: ContextTrace; locale: "zh" | "en" }) {
  const id = useId();
  const player = useRef<PlayerRef>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(700);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const t = contextTransport[locale];
  const index = Math.min(trace.steps.length - 1, Math.floor(frame / CONTEXT_STEP_FRAMES));
  const step = trace.steps[index];
  const columns = Math.max(1, Math.floor((width - (width < 480 ? 52 : 80)) / 126));
  const height = Math.max(...trace.steps.map(item => item.rows.reduce((total, row) => total + 58 + Math.ceil(row.items.length / columns) * 70, 0) + Math.max(0, item.rows.length - 1) * 20 + 48 + (item.meter ? 100 : 0)));
  const inputProps = useMemo(() => ({ trace, locale, reduced }), [trace, locale, reduced]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const ref = player.current;
    if (!ref) return;
    const update = ({ detail }: { detail: { frame: number } }) => setFrame(detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    ref.addEventListener("frameupdate", update);
    ref.addEventListener("play", onPlay);
    ref.addEventListener("pause", onPause);
    ref.addEventListener("ended", onPause);
    // 阅读时离开舞台就暂停，避免多个播放器在页面外继续运行。
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) ref.pause(); });
    if (wrapper.current) observer.observe(wrapper.current);
    const hidden = () => { if (document.hidden) ref.pause(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      observer.disconnect(); document.removeEventListener("visibilitychange", hidden);
      ref.removeEventListener("frameupdate", update); ref.removeEventListener("play", onPlay);
      ref.removeEventListener("pause", onPause); ref.removeEventListener("ended", onPause);
    };
  }, []);
  const seek = (target: number) => {
    const next = Math.max(0, Math.min(trace.steps.length - 1, target));
    player.current?.pause();
    // 跳转显示完整静态状态，播放时再由帧驱动新元素进入。
    const targetFrame = next * CONTEXT_STEP_FRAMES + 24;
    player.current?.seekTo(targetFrame); setFrame(targetFrame);
  };
  return <figure className="context-trace" ref={wrapper} aria-labelledby={`${id}-title`}>
    <figcaption className="context-trace__heading"><strong id={`${id}-title`}>{trace.title[locale]}</strong><span>{t.sample}</span></figcaption>
    <p className="context-trace__note">{trace.note[locale]}</p>
    <div className="context-trace__viewport" ref={viewport}>
      <Player ref={player} component={ContextFilm} inputProps={inputProps} compositionWidth={width} compositionHeight={height} durationInFrames={trace.steps.length * CONTEXT_STEP_FRAMES} fps={CONTEXT_FPS} style={{ width: "100%" }} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} />
    </div>
    <div className="context-trace__explanation" aria-live="polite" aria-atomic="true">
      <div><span>{t.step} {index + 1} / {trace.steps.length}</span><strong>{step.title[locale]}</strong></div>
      <p>{step.body[locale]}</p><code>{step.code}</code>
    </div>
    <div className="context-trace__controls">
      <button onClick={() => {
        if (playing) player.current?.pause();
        else { if (frame >= trace.steps.length * CONTEXT_STEP_FRAMES - 1) player.current?.seekTo(0); player.current?.play(); }
      }} aria-pressed={playing}>{playing ? t.pause : t.play}</button>
      <button onClick={() => { player.current?.pause(); player.current?.seekTo(0); setFrame(0); }}>{t.restart}</button>
      <button disabled={index === 0} onClick={() => seek(index - 1)}>{t.previous}</button>
      <button disabled={index === trace.steps.length - 1} onClick={() => seek(index + 1)}>{t.next}</button>
      <input type="range" min={0} max={trace.steps.length - 1} value={index} onChange={event => seek(Number(event.target.value))} aria-label={`${trace.title[locale]} · ${t.seek}`} aria-valuetext={`${index + 1} / ${trace.steps.length}: ${step.title[locale]}`} />
    </div>
    <details className="context-trace__transcript"><summary>{t.transcript}</summary><ol>{trace.steps.map((item, n) => <li key={item.code+n}><strong>{item.title[locale]}</strong><p>{item.body[locale]}</p><code>{item.code}</code></li>)}</ol></details>
  </figure>;
}
