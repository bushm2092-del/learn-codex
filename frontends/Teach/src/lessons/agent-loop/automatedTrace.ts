import { automatedLoop } from "../../i18n/automatedLoop";
export const LOOP_FPS = 60;
export const LOOP_STEP = 180;
export const LOOP_STEPS = 14;
export const LOOP_DURATION = LOOP_STEP * LOOP_STEPS;
export function loopPosition(frame: number) {
  const step = Math.max(0, Math.min(LOOP_STEPS - 1, Math.floor(frame / LOOP_STEP)));
  return { step, round: Math.floor(step / 4), phase: step % 4 };
}
export function newMessageLines(request: unknown, round: number) {
  if (!round) return [];
  let inMessages = false;
  let message = -1;
  const highlighted: number[] = [];
  JSON.stringify(request, null, 2).split("\n").forEach((line, index) => {
    if (line === '  "messages": [') inMessages = true;
    else if (inMessages && line === '  ],') inMessages = false;
    else if (inMessages) {
      if (line === '    {') message++;
      if (message >= round * 2) highlighted.push(index);
    }
  });
  return highlighted;
}
type Message = { role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export function automatedTrace(locale: "zh" | "en") {
  const t = automatedLoop[locale];
  const tools = [{
    type: "function",
    function: { name: "exec_command", description: t.toolDescription,
      parameters: { type: "object", properties: { cmd: { type: "string", description: t.argumentDescription } }, required: ["cmd"], additionalProperties: false },
    },
  }];
  const commands = ["cat README.md", "printf '%s' '" + t.addition.replaceAll("'", "'\\''") + "' >> README.md", "cat README.md"];
  const outputs = [t.original, "", t.original + t.addition].map((stdout) => JSON.stringify({ exit_code: 0, stdout, stderr: "" }));
  const calls: Message[] = commands.map((cmd, i) => ({ role: "assistant", content: null, tool_calls: [{ id: "call_demo_" + (i + 1), type: "function", function: { name: "exec_command", arguments: JSON.stringify({ cmd }) } }] }));
  const results: Message[] = outputs.map((content, i) => ({ role: "tool", tool_call_id: "call_demo_" + (i + 1), content }));
  const history: Message[] = [{ role: "system", content: t.system }, { role: "user", content: t.user }];
  // 每轮请求独立快照，不提前泄露未来工具结果；仅模拟，不执行命令或网络请求。
  return Array.from({ length: 4 }, (_, round) => {
    const request = { model: "deepseek-flash", messages: [...history], tools, tool_choice: "auto", stream: false, thinking: { type: "disabled" } };
    const message: Message = round < 3 ? calls[round]! : { role: "assistant", content: t.final };
    const response = { id: "chatcmpl_demo_" + (round + 1), object: "chat.completion", model: "deepseek-flash", choices: [{ index: 0, message, finish_reason: round < 3 ? "tool_calls" : "stop" }] };
    if (round < 3) history.push(calls[round]!, results[round]!);
    return { request, response, result: results[round] ?? null, command: commands[round] ?? null };
  });
}
