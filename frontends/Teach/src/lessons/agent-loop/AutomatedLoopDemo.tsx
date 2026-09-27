import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { LoopDebuggerFilm } from "./LoopDebuggerFilm";
import { useLocale } from "../../i18n/useLocale";
import { automatedLoop } from "../../i18n/automatedLoop";
import { LOOP_FPS } from "./automatedTrace";
import { DEBUG_DURATION as LOOP_DURATION, DEBUG_STEP as LOOP_STEP, DEBUG_STEPS as LOOP_STEPS } from "./debuggerTrace";
import "./AutomatedLoopDemo.css";

export function AutomatedLoopDemo() {
  const { locale } = useLocale();
  const t = automatedLoop[locale];
  const player = useRef<PlayerRef>(null);
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const inputProps = useMemo(() => ({ locale, reduced }), [locale, reduced]);
  const seek = (target: number) => {
    const next = Math.max(0, Math.min(LOOP_STEPS - 1, target));
    player.current?.seekTo(next * LOOP_STEP);
    setStep(next);
  };
  return <section className="lesson-section auto-loop" aria-labelledby="automated-loop-title">
    <h2 id="automated-loop-title">{t.title}</h2>
    <p className="auto-loop__note">{t.note}</p>
    <div className="auto-loop__player">
      <Player ref={player} component={LoopDebuggerFilm} inputProps={inputProps} compositionWidth={1100} compositionHeight={700} fps={LOOP_FPS} durationInFrames={LOOP_DURATION} style={{ width: "100%" }} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false}/>
      <div className="manual-demo__transport">
        <div className="manual-demo__buttons"><button disabled={step === 0} onClick={() => seek(step - 1)}>{t.previous}</button><button disabled={step === LOOP_STEPS - 1} onClick={() => seek(step + 1)}>{t.next}</button></div>
      </div>
    </div>
    <a className="auto-loop__source" href="https://api-docs.deepseek.com/guides/tool_calls/" target="_blank" rel="noreferrer">{t.source}</a>
  </section>;
}
