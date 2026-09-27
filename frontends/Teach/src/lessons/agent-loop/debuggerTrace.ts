import { automatedTrace } from "./automatedTrace";

export const DEBUG_STEP = 180;
export const DEBUG_STEPS = 22;
export const DEBUG_DURATION = DEBUG_STEP * DEBUG_STEPS;
export const debuggerCode = [
  "let tools = available_tools();",
  "let mut history = vec![system(prompt), user(task)];",
  "loop {",
  "    let reply = request_llm_api(&history, &tools).await?;",
  "    history.push(reply.as_message());",
  "    if reply.tool_calls.is_empty() { break; }",
  "    for call in reply.tool_calls {",
  "        let result = run_tool(&call.name, &call.arguments).await;",
  "        history.push(tool_result(call.id, result));",
  "    }",
  "}",
];

// 每步表示当前行执行后的快照。模拟数据来自同一条协议轨迹，不产生副作用。
export function debuggerState(step: number, locale: "zh" | "en") {
  const index = Math.max(0, Math.min(DEBUG_STEPS - 1, step));
  const round = Math.floor(index / 6);
  const phase = index % 6;
  const item = automatedTrace(locale)[round]!;
  const message = item.response.choices[0]!.message;
  const history = [...item.request.messages];
  if (phase >= 2) history.push(message);
  if (phase >= 5 && item.result) history.push(item.result);
  const call = phase >= 4 ? message.tool_calls?.[0] : undefined;
  return {
    round, phase, line: [3, 3, 4, 5, 7, 8][phase]!,
    finished: round === 3 && phase === 3,
    variables: {
      prompt: item.request.messages[0]!.content,
      task: item.request.messages[1]!.content,
      tools: item.request.tools,
      history,
      reply: phase >= 1 ? { text: message.content, tool_calls: message.tool_calls ?? [] } : undefined,
      call,
      result: phase >= 4 && item.result ? JSON.parse(item.result.content!) : undefined,
    },
    request: item.request,
    response: phase >= 1 ? item.response : undefined,
  };
}
