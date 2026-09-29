import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { TimelineControls } from "../../animation/TimelineControls";
import { useLocale } from "../../i18n/useLocale";
import { manualCopy } from "../../i18n/manualCopy";
import { ManualCopyFilm } from "./ManualCopyFilm";
import { DURATION, FPS, INTRO_FRAMES, STEP_COUNT, manualScene, stepFrame } from "./manualScene";
import "./ManualCopyDemo.css";

export function ManualCopyDemo() {
  const { locale } = useLocale();
  const text = manualCopy[locale];
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const current = player.current;
    if (!current) return;
    const update = () => setFrame(current.getCurrentFrame());
    current.addEventListener("frameupdate", update);
    return () => current.removeEventListener("frameupdate", update);
  }, []);
  const step = frame < INTRO_FRAMES ? -1 : manualScene(frame - INTRO_FRAMES).step;
  const inputProps = useMemo(() => ({ locale, reduced }), [locale, reduced]);
  const seek = (next: number) => { player.current?.pause(); player.current?.seekTo(next); setFrame(next); };
  const controls = {
    play: () => { if (frame >= DURATION + INTRO_FRAMES - 1) player.current?.seekTo(0); player.current?.play(); },
    pause: () => player.current?.pause(),
    restart: () => { player.current?.seekTo(0); player.current?.play(); },
  };
  return <section className="lesson-section manual-demo" aria-labelledby="manual-demo-title">
    <h2 id="manual-demo-title">{text.title}</h2>
    <p className="manual-demo__note">{text.note}</p>
    <div className="manual-demo__workspace">
      <Player ref={player} component={ManualCopyFilm} inputProps={inputProps} compositionWidth={840} compositionHeight={640} fps={FPS} durationInFrames={DURATION + INTRO_FRAMES} style={{ width: "100%" }} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false}/>
      <div className="manual-demo__transport">
        <input aria-label={text.progress} type="range" min={0} max={DURATION + INTRO_FRAMES - 1} step={1} value={frame} onChange={(event) => seek(Number(event.target.value))}/>
        <div className="manual-demo__buttons">
          <button type="button" disabled={step < 0} onClick={() => seek(step === 0 ? 0 : INTRO_FRAMES + stepFrame(step - 1))}>{text.previous}</button>
          <TimelineControls controls={controls}/>
          <button type="button" disabled={step === STEP_COUNT - 1} onClick={() => seek(INTRO_FRAMES + stepFrame(step + 1))}>{text.next}</button>
        </div>
      </div>
    </div>
  </section>;
}
