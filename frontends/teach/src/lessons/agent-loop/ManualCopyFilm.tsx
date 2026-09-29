import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { DesktopWindow } from "../../ui/DesktopWindow";
import { SceneToast } from "../../ui/SceneToast";
import { SceneDialog } from "../../ui/SceneDialog";
import { manualCopy } from "../../i18n/manualCopy";
import { FPS, INTRO_FRAMES, manualScene } from "./manualScene";

interface Props { locale: "zh" | "en"; reduced: boolean }
const bounded = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const charWidth = (c: string) => c.charCodeAt(0) > 255 ? 17 : 10.2;
function selectionPoint(value: string, count: number) {
  const lines = value.slice(0, count).split("\n");
  return { x: 72 + [...lines[lines.length - 1]!].reduce((sum, c) => sum + charWidth(c), 0), y: 140 + (lines.length - 1) * 28 };
}
const CopyIcon = () => <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="6" width="10" height="11" rx="2"/><path d="M12 6V3H3v10h3"/></svg>;

export function ManualCopyFilm({ locale, reduced }: Props) {
  const absoluteFrame = useCurrentFrame();
  const frame = Math.max(0, absoluteFrame - INTRO_FRAMES);
  const s = manualScene(frame);
  const text = manualCopy[locale];
  const introOpacity = reduced ? Number(absoluteFrame < INTRO_FRAMES) : interpolate(absoluteFrame, [INTRO_FRAMES - 24, INTRO_FRAMES], [1, 0], bounded);
  const full = text.original + text.addition;
  const file = s.finalPasted ? full + text.deletion : s.pasted ? full : text.original;
  const selectionProgress = file.length * (reduced ? 1 : interpolate(s.beat, [16, 78], [0, 1], bounded));
  const selected = s.selecting ? Math.floor(selectionProgress) : [1, 12].includes(s.step) || s.step === 9 && !s.pasted ? file.length : 0;
  const camera = reduced ? 1 : spring({ frame: s.beat, fps: FPS, config: { damping: 200 }, durationInFrames: 24 });
  const fileWeight = Number(s.previousFile) + (Number(s.fileActive) - Number(s.previousFile)) * camera;
  const pose = (w: number, direction: number) => ({ transform: `translateX(${direction * (1 - w) * 82}px) scale(${.92 + .08 * w})`, opacity: .16 + .84 * w, zIndex: w >= .5 ? 2 : 1 });
  const request = s.feedback ? text.feedback : text.request;
  const isTyping = [3, 14].includes(s.step);
  const draft = [2, 13].includes(s.step) ? "" : isTyping && !reduced ? request.slice(0, Math.floor(request.length * interpolate(s.beat, [8, 70], [0, 1], bounded))) : request;
  const answer = s.feedbackSent ? text.deletion.trim() : full;
  const visibleAnswer = s.step === 15 ? "" : s.generating && !reduced ? answer.slice(0, Math.floor(answer.length * interpolate(s.beat, [0, 85], [0, 1], bounded))) : answer;
  const originalEnd = selectionPoint(text.original, text.original.length);
  const updatedEnd = selectionPoint(full, full.length);
  const targets = [
    originalEnd, { x: 705, y: 91 }, { x: 280, y: 454 }, { x: 430, y: 476 },
    { x: 743, y: 553 }, { x: 620, y: 300 }, { x: 91, y: 438 }, { x: 91, y: 438 },
    originalEnd, { x: 280, y: 192 }, { x: 754, y: 91 }, updatedEnd, { x: 705, y: 91 },
    { x: 280, y: 454 }, { x: 430, y: 490 }, { x: 743, y: 553 }, { x: 620, y: 300 }, { x: 620, y: 300 },
    { x: 91, y: 438 }, updatedEnd, updatedEnd, { x: 754, y: 91 }, { x: 754, y: 91 },
  ];
  const previous = s.step === 0 ? selectionPoint(file, 0) : targets[s.step - 1]!;
  const start = selectionPoint(file, Math.floor(selectionProgress));
  const next = selectionPoint(file, Math.min(file.length, Math.floor(selectionProgress) + 1));
  const fraction = selectionProgress % 1;
  const drag = { x: start.x + (next.x - start.x) * fraction, y: start.y + (next.y - start.y) * fraction };
  const target = s.selecting ? drag : targets[s.step]!;
  const travel = reduced ? 1 : interpolate(s.beat, [0, s.selecting ? 16 : 30], [0, 1], { ...bounded, easing: Easing.inOut(Easing.cubic) });
  const cursor = { x: previous.x + (target.x - previous.x) * travel, y: previous.y + (target.y - previous.y) * travel };
  const down = s.selecting && s.beat >= 16 && s.beat < 78 || [1, 4, 7, 10, 12, 15, 18, 19, 20, 21].includes(s.step) && s.beat >= 34 && s.beat < 44;
  const toast = s.copied ? text.copied : s.saveToast ? text.saved : "";
  const toastProgress = reduced ? 1 : interpolate(s.toastAge, [0, 8, FPS * .7, FPS * .9], [0, 1, 1, 0], bounded);
  const sendStep = s.feedbackSent ? 15 : 4;
  const messageProgress = reduced || s.step > sendStep ? 1 : interpolate(s.beat, [42, 62], [0, 1], bounded);
  const sent = s.feedbackSent || s.sent;
  const cursorOpacity = reduced || s.step === 22 ? 0 : s.generating
    ? interpolate(s.beat, s.step === 5 ? [0, 10, 80, 90] : [0, 10], s.step === 5 ? [1, 0, 0, 1] : [1, 0], bounded)
    : 1;
  return <AbsoluteFill className="manual-film" data-step={s.step} data-frame={frame} data-reduced={reduced}>
    <DesktopWindow title="README.md" className="manual-film__file" style={pose(fileWeight, -1)}>
      <div className="manual-film__toolbar"><span>README.md{s.pasted && !s.saved || s.finalPasted && !s.finalSaved ? " •" : ""}</span><div><span className="manual-film__tool" data-pressed={s.copied && s.fileActive}><CopyIcon/></span><span>{text.save}</span></div></div>
      <pre className="manual-film__editor"><code>{file.split("\n").map((line, row, lines) => {
        const before = lines.slice(0, row).join("\n").length + (row ? 1 : 0);
        return <div key={row} className="manual-film__line">{[...line].map((c, col) => <span key={col} style={{ display: "inline-block", width: charWidth(c), background: before + col < selected ? "#cfe1ff" : undefined }}>{c}</span>)}{row === lines.length - 1 && s.step >= 19 && s.step <= 20 && <i className="manual-film__caret"/>}</div>;
      })}</code></pre>
      <footer><span>Markdown</span><span>UTF-8{(s.finalPasted ? s.finalSaved : s.saved) ? ` · ${text.saved}` : ""}</span></footer>
    </DesktopWindow>
    <DesktopWindow title="chat.deepseek.com" className="manual-film__chat" style={pose(1 - fileWeight, 1)}>
      <div className="manual-film__brand">deepseek</div>
      <div className="manual-film__conversation">
        {!sent ? <div className="manual-film__welcome">deepseek<p>{text.waiting}</p></div> : <>
          <div className="manual-film__message" style={{ opacity: messageProgress, transform: `translateY(${(1 - messageProgress) * 18}px)` }}><span>README.md</span><p>{s.feedbackSent ? text.feedback : text.request}</p></div>
          {(s.step >= 5 || s.feedbackSent) && <div className="manual-film__answer"><span>DeepSeek</span><pre>{visibleAnswer}<i className="manual-film__caret" hidden={!s.generating || reduced}/></pre></div>}
        </>}
      </div>
      {(s.step >= 6 && !s.feedbackSent || s.step >= 17) && <span className="manual-film__reply-copy" data-pressed={[7, 18].includes(s.step) && s.beat >= 35}><CopyIcon/></span>}
      <div className="manual-film__composer" data-filled={s.composing}>
        {s.composing ? <><div className="manual-film__attachment"><span>README.md</span><pre>{s.feedback ? full : text.original}</pre></div><p className="manual-film__draft">{draft}<i className="manual-film__caret" hidden={!isTyping || reduced}/></p></> : <p className="manual-film__placeholder">{text.empty}</p>}
        <div className="manual-film__composer-bottom"><span>+</span><span className="manual-film__send" data-ready={s.composing} data-pressed={[4, 15].includes(s.step) && down}><svg viewBox="0 0 20 20"><path d="M10 15V5m-5 5 5-5 5 5"/></svg></span></div>
      </div>
    </DesktopWindow>
    <div className="manual-film__cursor" aria-hidden="true" data-down={down} style={{ transform: `translate(${cursor.x - 3}px, ${cursor.y - 2}px)`, opacity: cursorOpacity }}><svg viewBox="0 0 24 28"><path d="M3 2v21l6-6 5 9 4-2-5-9h8L3 2Z"/></svg></div>
    {toast && <SceneToast message={toast} style={{ opacity: toastProgress, transform: `translate(-50%, ${(1 - toastProgress) * 8}px)` }}/>}
    {absoluteFrame < INTRO_FRAMES && <SceneDialog title={text.requirement} description={text.opening} style={{ opacity: introOpacity }}/>}
  </AbsoluteFill>;
}
