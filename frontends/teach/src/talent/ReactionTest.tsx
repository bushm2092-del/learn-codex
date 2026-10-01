import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TalentCopy } from "../i18n/talent";
import type { TalentSubmission } from "./types";
import { reactionAverage } from "./logic";

type Phase = "waiting" | "green" | "early" | "sample" | "invalid";
export function ReactionTest({ t, onFinish }: { t: TalentCopy; onFinish: (submission: TalentSubmission, score: number) => void }) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const phaseRef = useRef<Phase>("waiting");
  const [samples, setSamples] = useState<number[]>([]);
  const samplesRef = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shownAt = useRef(0);
  const [cycle, setCycle] = useState(0);
  const surface = useRef<HTMLButtonElement>(null);
  function transition(next: Phase) { phaseRef.current = next; setPhase(next); }
  useEffect(() => {
    transition("waiting");
    // 变色信号不做 CSS 过渡；卸载、抢点和重试都清理待触发计时器。
    timer.current = setTimeout(() => { transition("green"); }, 2000 + Math.random() * 3000);
    return () => clearTimeout(timer.current);
  }, [cycle]);
  useLayoutEffect(() => {
    if (phase === "green") shownAt.current = performance.now();
  }, [phase]);
  useEffect(() => { surface.current?.focus({ preventScroll: true }); }, []);
  function activate() {
    const current = phaseRef.current;
    if (current === "waiting") { clearTimeout(timer.current); transition("early"); return; }
    if (current === "green") {
      const elapsed = Math.round(performance.now() - shownAt.current);
      if (elapsed < 80 || elapsed > 5000) { transition("invalid"); return; }
      const next = [...samplesRef.current, elapsed]; samplesRef.current = next; setSamples(next);
      transition("sample");
      if (next.length === 5) onFinish({ samples_ms: next }, reactionAverage(next));
      return;
    }
    // 避免一次按键或双击同时提交成绩并触发下一轮。
    if (current === "sample" && performance.now() - shownAt.current < (samplesRef.current.at(-1) ?? 0) + 250) return;
    setCycle(value => value + 1);
  }
  const title = phase === "waiting" ? t.wait : phase === "green" ? t.clickNow : phase === "early" ? t.tooSoon : phase === "invalid" ? t.invalidTime : `${samples.at(-1)} ms`;
  return <div className="talent-reaction">
    <button ref={surface} type="button" className={`talent-reaction__surface talent-reaction__surface--${phase}`} onPointerDown={event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); surface.current?.focus({ preventScroll: true }); activate(); } }} onClick={event => { if (event.detail === 0) activate(); }} onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) activate(); } }}>
      <svg className="talent-reaction__symbol" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" aria-hidden="true"><path d="M50 5v20m0 50v20M5 50h20m50 0h20M18 18l14 14m36 36 14 14M82 18 68 32M32 68 10 90" /></svg>
      <strong aria-live="polite">{title}</strong>
      <span>{phase === "early" ? t.tooSoonHint : phase === "sample" || phase === "invalid" ? t.next : phase === "green" ? t.reactionHint : t.reactionKeys}</span>
    </button>
    <div className="talent-rounds" aria-label={t.round}>{Array.from({ length: 5 }, (_, i) => <span key={i} data-done={i < samples.length}>{i < samples.length ? `${samples[i]} ms` : `${t.round} ${i + 1}`}</span>)}</div>
  </div>;
}
