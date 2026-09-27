import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// 使用项目已有 TypeScript 编译器在内存加载纯数据模块，不生成构建文件。
const moduleUrl = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64");
const copy = moduleUrl(await readFile(new URL("../src/i18n/automatedLoop.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lessons/agent-loop/automatedTrace.ts", import.meta.url), "utf8")).replace('"../../i18n/automatedLoop"', JSON.stringify(copy));
const { automatedTrace, newMessageLines, loopPosition, LOOP_DURATION } = await import(moduleUrl(source));
const debugSource = (await readFile(new URL("../src/lessons/agent-loop/debuggerTrace.ts", import.meta.url), "utf8")).replace('"./automatedTrace"', JSON.stringify(moduleUrl(source)));
const { debuggerState } = await import(moduleUrl(debugSource));
test("debugger records replies before results without leaking future values", () => {
  assert.equal(debuggerState(0, "zh").variables.reply, undefined);
  assert.equal(debuggerState(1, "zh").variables.history.length, 2);
  assert.equal(debuggerState(2, "zh").variables.history.length, 3);
  assert.equal(debuggerState(3, "zh").variables.result, undefined);
  assert.equal(debuggerState(4, "zh").variables.result.exit_code, 0);
  assert.deepEqual(debuggerState(5, "zh").variables.history, debuggerState(6, "zh").variables.history);
  assert.deepEqual(debuggerState(21, "en").variables.reply.tool_calls, []);
  assert.equal(debuggerState(21, "en").finished, true);
  assert.equal(debuggerState(21, "en").variables.history.length, 9);
});

for (const locale of ["zh", "en"]) {
  test(`${locale}: complete history, matching call IDs, and final stop`, () => {
    const rounds = automatedTrace(locale);
    assert.deepEqual(rounds.map(r => r.request.messages.length), [2, 4, 6, 8]);
    for (let i = 0; i < 3; i++) {
      const current = rounds[i];
      const call = current.response.choices[0].message.tool_calls[0];
      assert.equal(call.id, current.result.tool_call_id);
      assert.deepEqual(rounds[i + 1].request.messages, [...current.request.messages, current.response.choices[0].message, current.result]);
      assert.deepEqual(rounds[i + 1].request.tools, rounds[0].request.tools);
      assert.equal(JSON.parse(call.function.arguments).cmd, current.command);
    }
    const final = rounds[3].response.choices[0];
    assert.equal(final.finish_reason, "stop");
    assert.equal(final.message.tool_calls, undefined);
    assert.ok(JSON.parse(rounds[2].result.content).stdout.includes("##"));
    const lines = JSON.stringify(rounds[3].request, null, 2).split("\n");
    const highlighted = newMessageLines(rounds[3].request, 3).map(i => lines[i]).join("\n");
    assert.ok(highlighted.includes("call_demo_3"));
    assert.ok(!highlighted.includes("call_demo_2"));
  });
}
test("last frame ends at the fourth response", () => {
  assert.deepEqual(loopPosition(LOOP_DURATION - 1), { step: 13, round: 3, phase: 1 });
});
