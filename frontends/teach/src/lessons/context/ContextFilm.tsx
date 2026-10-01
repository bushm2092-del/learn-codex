import { interpolate, useCurrentFrame } from "remotion";
import type { ContextTrace } from "./types";
export const CONTEXT_STEP_FRAMES = 180;
export const CONTEXT_FPS = 30;

export function ContextFilm({ trace, locale, reduced }: { trace: ContextTrace; locale: "zh" | "en"; reduced: boolean }) {
  const frame = useCurrentFrame();
  const index = Math.min(trace.steps.length - 1, Math.floor(frame / CONTEXT_STEP_FRAMES));
  const step = trace.steps[index];
  const localFrame = frame % CONTEXT_STEP_FRAMES;
  const previous = trace.steps[Math.max(0, index - 1)];
  const reveal = reduced ? 1 : interpolate(localFrame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
  return <div className="context-film">
    {step.rows.map((row, r) => <div className="context-film__row" key={`${r}-${row.label}`}>
      <div className="context-film__row-head"><code>{row.label}</code><code>len={row.items.length}</code></div>
      <div className="context-film__messages">
        {row.items.map(item => {
          const existed = previous.rows[r]?.items.some(old => old.id === item.id);
          const progress = index === 0 || existed ? 1 : reveal;
          const textParts = item.text.split(" / ");
          const text = textParts[locale === "zh" ? 0 : 1] ?? textParts[0];
          return <div key={item.id} className="context-film__message" data-kind={item.kind} style={{ opacity: progress, transform: `translateY(${reduced ? 0 : (1 - progress) * 12}px)`, clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>
            <code>{item.kind === "summary" ? "summary · user" : item.kind === "environment" ? "environment · user" : item.kind}</code><span>{text}</span>
          </div>;
        })}
      </div>
    </div>)}
    {step.meter && <div className="context-film__meter">
      <code>{step.meter.formula}</code>
      <div className="context-film__track"><span style={{ transform: `scaleX(${Math.min(1, step.meter.used / step.meter.limit)})` }}/></div>
      <div className="context-film__row-head"><code>{step.meter.used.toLocaleString()} tokens</code><code>{locale === "zh" ? "示例上限" : "Example cap"}: {step.meter.limit.toLocaleString()}</code></div>
    </div>}
  </div>;
}
