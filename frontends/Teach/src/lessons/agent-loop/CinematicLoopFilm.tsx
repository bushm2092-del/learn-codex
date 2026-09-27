import { AbsoluteFill, interpolate, Easing, useCurrentFrame } from "remotion";
import { automatedLoop } from "../../i18n/automatedLoop";
import { DesktopWindow } from "../../ui/DesktopWindow";
import { automatedTrace, LOOP_STEP, loopPosition } from "./automatedTrace";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// 显示层只摘要协议，真实示意快照保留在 automatedTrace；不执行任何请求或命令。
export function CinematicLoopFilm({ locale, reduced }: { locale: "zh" | "en"; reduced: boolean }) {
  const frame = useCurrentFrame();
  const { step, round, phase } = loopPosition(frame);
  const t = automatedLoop[locale];
  const trace = automatedTrace(locale);
  const beat = frame % LOOP_STEP;
  const enter = reduced || step === 0 ? 1 : interpolate(beat, [0, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const panels = step === 0 || reduced ? [step] : [step - 1, step];
  return <AbsoluteFill className="loop-cinema" data-step={step}>
    <header className="loop-cinema__masthead"><strong>deepseek</strong><span>{t.round} {round + 1} / 4</span></header>
    {panels.map((index) => {
      const state = loopPosition(index * LOOP_STEP);
      const item = trace[state.round]!;
      const final = state.step === 13;
      const active = index === step;
      const movement = active ? 1 - enter : -enter;
      const operation = item.command ?? "";
      const result = item.result ? JSON.parse(item.result.content as string) : null;
      const titles = ["request_llm_api()", "DeepSeek → response", "exec_command()", "history → request"];
      let payload: unknown;
      if (state.phase === 0) payload = {
        model: "deepseek-flash",
        messages: [
          { role: "system", content: t.shortPrompt },
          { role: "user", content: t.user },
          ...(state.round ? [{ role: "tool", tool_call_id: "call_demo_" + state.round, content: JSON.parse(trace[state.round - 1]!.result!.content as string) }] : []),
        ],
        tools: [{ name: "exec_command", parameters: { cmd: "string" } }],
      };
      else if (state.phase === 1) payload = final
        ? { message: t.final, finish_reason: "stop" }
        : { tool_calls: [{ id: "call_demo_" + (state.round + 1), name: "exec_command", arguments: { cmd: operation } }] };
      else if (state.phase === 2) payload = { cmd: operation, exit_code: result.exit_code, stdout: result.stdout };
      else payload = { role: "tool", tool_call_id: item.result!.tool_call_id, content: result };
      // 请求用紧凑 JSON 排版，保证提示词、需求与 tools 同时进入镜头。
      const request = payload as { model: string; messages: unknown[]; tools: unknown[] };
      const json = state.phase === 0
        ? ['{', '  "model": "deepseek-flash",', '  "messages": [', ...request.messages.map((message, i) => '    ' + JSON.stringify(message) + (i < request.messages.length - 1 ? ',' : '')), '  ],', '  "tools": ' + JSON.stringify(request.tools), '}'].join("\n")
        : JSON.stringify(payload, null, 2);
      const lines = json.split("\n");
      return <DesktopWindow key={index} title={titles[state.phase]!} className="loop-cinema__window" style={{
        transform: `translateX(${movement * 210}px) translateY(${Math.abs(movement) * 22}px) scale(${1 - Math.abs(movement) * .09})`,
        opacity: active ? enter : 1 - enter, zIndex: active ? 2 : 1,
      }}>
        <div className="loop-cinema__address">{state.phase === 0 ? "POST api.deepseek.com/chat/completions" : final ? "finish_reason: stop" : state.phase === 2 ? "cwd: /project" : "call_demo_" + (state.round + 1)}</div>
        <pre className="loop-cinema__json" style={{ fontSize: lines.length > 22 ? 15 : 18 }}><code>{lines.map((line, lineIndex) => <span key={lineIndex} className={/tool_calls|tool_call_id|stdout|finish_reason/.test(line) ? "loop-cinema__highlight" : undefined}>{line}{"\n"}</span>)}</code></pre>
        <footer><span>{final ? t.done : state.phase === 0 && state.round ? t.historyRetained : t.filmLabels[state.phase]}</span>{state.phase === 3 && <code>↩ request_llm_api()</code>}</footer>
      </DesktopWindow>;
    })}
    <div className="loop-cinema__caption" aria-live="polite"><span>{t.filmCaptions[phase]}</span><p>{step === 13 ? t.done : t.explain[step]}</p></div>
  </AbsoluteFill>;
}
