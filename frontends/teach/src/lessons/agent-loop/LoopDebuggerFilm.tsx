import { AbsoluteFill, useCurrentFrame } from "remotion";
import { debuggerCode, debuggerState, DEBUG_STEP } from "./debuggerTrace";
import { loopDebugger } from "../../i18n/loopDebugger";
import { ChangedJson } from "../../ui/ChangedJson";

export function LoopDebuggerFilm({ locale }: { locale: "zh" | "en"; reduced: boolean }) {
  const frame = useCurrentFrame();
  const state = debuggerState(Math.floor(frame / DEBUG_STEP), locale);
  const previous = debuggerState(Math.max(0, Math.floor(frame / DEBUG_STEP) - 1), locale);
  const changed = (value: unknown, old: unknown) => JSON.stringify(value) !== JSON.stringify(old);
  const t = loopDebugger[locale];
  return <AbsoluteFill className="loop-debugger">
    <header><span>agent_loop.rs</span><span>{state.round + 1} / 4</span></header>
    <div className="loop-debugger__endpoint">POST https://api.deepseek.com/chat/completions</div>
    <div className="loop-debugger__body">
      <section><h3>{t.code}</h3><pre>{debuggerCode.map((line, i) => <div key={i} className={state.line === i ? "is-current" : undefined}><span>{state.line === i ? "→" : i + 1}</span><code>{line}</code></div>)}</pre></section>
      <section className="loop-debugger__variables"><h3>{t.variables}</h3>
        {Object.entries(state.variables).map(([name, value]) => {
          const old = previous.variables[name as keyof typeof previous.variables];
          return <details key={name} data-changed={changed(value, old)}><summary><code>{name}</code><span>{changed(value, old) ? t.changed + " · " : ""}{value === undefined ? "—" : Array.isArray(value) ? `[${value.length}]` : typeof value === "string" ? "String" : "Object"}</span></summary><ChangedJson value={value} previous={old} unset={t.unset}/></details>;
        })}
        <details data-changed={changed(state.request, previous.request)}><summary>{t.request}</summary><ChangedJson value={state.request} previous={previous.request} unset={t.unset}/></details>
        <details data-changed={changed(state.response, previous.response)}><summary>{t.response}</summary><ChangedJson value={state.response} previous={previous.response} unset={t.unset}/></details>
      </section>
    </div>
    <footer><strong>{state.finished ? t.done : t.phases[state.phase]}</strong><code style={state.variables.history.length !== previous.variables.history.length ? { background: "var(--change-bg)", color: "var(--change-ink)" } : undefined}>{state.finished ? "break;" : `history.length = ${state.variables.history.length}`}</code></footer>
  </AbsoluteFill>;
}
