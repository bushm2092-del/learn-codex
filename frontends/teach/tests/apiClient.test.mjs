import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = (await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8")).replace("import.meta.env.VITE_API_BASE_URL", '""');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { api, ApiError } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
test("API includes cookies, preserves JSON bodies and handles empty responses", async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (path, options) => {
      calls++; assert.equal(path, "/api/v1/analytics/views"); assert.equal(options.credentials, "include");
      assert.equal(options.headers["Content-Type"], "application/json"); assert.equal(options.body, '{"page":"/"}');
      return new Response(null, { status: 204 });
    };
    assert.equal(await api("/analytics/views", { method: "POST", body: '{"page":"/"}' }), undefined);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test("API exposes expired sessions without automatically retrying writes", async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response('{"error":"login_required"}', { status: 401 }); };
    await assert.rejects(api("/auth/logout", { method: "POST" }), (e) => e instanceof ApiError && e.status === 401 && e.code === "login_required");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
