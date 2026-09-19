import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppServerClient} from '../src/client.js';
import type {ConfigReadResponse, ConfigWriteResponse, Notification} from '../src/protocol.js';

test('真实 Rust 子进程与本地 Responses SSE 完整往返', {timeout: 10000}, async () => {
  let calls = 0;
  const requestedModels: string[] = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(request.url, '/responses');
    calls++;
    requestedModels.push(body.model);
    response.writeHead(200, {'Content-Type': 'text/event-stream'});
    const emit = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);
    if (calls === 1) {
      emit({type: 'response.output_item.done', item: {type: 'function_call', call_id: 'tool-1', name: 'exec_command', arguments: JSON.stringify({cmd: 'printf from-tool'})}});
    } else {
      assert.ok(body.input.some((item: any) => item.type === 'function_call_output' && item.output.includes('from-tool')));
      emit({type: 'response.output_text.delta', delta: '集成测试完成'});
      emit({type: 'response.output_item.done', item: {type: 'message', content: [{type: 'output_text', text: '集成测试完成'}]}});
    }
    emit({type: 'response.completed'});
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  // app-server 只读 `$MINI_CODEX_HOME/config.toml`：用临时目录把 provider 指向本地假服务。
  const codexHome = mkdtempSync(join(tmpdir(), 'mini-codex-home-'));
  writeFileSync(join(codexHome, 'config.toml'), [
    'model = "test-model"',
    'model_provider = "local"',
    '',
    '[model_providers.local]',
    'name = "Local Test"',
    `base_url = "http://127.0.0.1:${address.port}"`,
    'env_key = "DEEPSEEK_API_KEY"',
    '',
  ].join('\n'));
  const oldHome = process.env.MINI_CODEX_HOME;
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.MINI_CODEX_HOME = codexHome;
  process.env.DEEPSEEK_API_KEY = 'fake-test-key';
  const client = new AppServerClient(process.cwd());
  if (oldHome === undefined) delete process.env.MINI_CODEX_HOME; else process.env.MINI_CODEX_HOME = oldHome;
  if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = oldKey;
  try {
    const events: Notification[] = [];
    let complete!: () => void;
    let completion = new Promise<void>(resolve => { complete = resolve; });
    client.subscribe(event => {events.push(event); if (event.method === 'turn/completed') complete();});
    await client.request('initialize', {clientInfo: {name: 'test', version: '1'}});
    client.notify('initialized');
    const result = await client.request<{thread: {id: string}}>('thread/start', {cwd: process.cwd()});
    const config = await client.request<ConfigReadResponse>('config/read', {});
    assert.deepEqual(config, {config: {model: 'test-model', modelProvider: 'local'}});
    await client.request('turn/start', {threadId: result.thread.id, input: [{type: 'text', text: '测试'}]});
    await completion;
    assert.equal(calls, 2);
    assert.ok(events.some(event => event.method === 'item/agentMessage/delta' && event.params.delta === '集成测试完成'));
    assert.ok(events.some(event => event.method === 'turn/completed' && event.params.turn.status === 'completed'));

    // /model 的两步：会话内生效 + 写回 config.toml；随后的真实 HTTP 请求必须带新模型。
    await client.request('thread/settings/update', {threadId: result.thread.id, model: 'switched-model'});
    const written = await client.request<ConfigWriteResponse>('config/value/write', {keyPath: 'model', value: 'switched-model', mergeStrategy: 'replace'});
    assert.equal(written.status, 'ok');
    assert.match(readFileSync(join(codexHome, 'config.toml'), 'utf8'), /^model = "switched-model"$/m);
    completion = new Promise<void>(resolve => { complete = resolve; });
    await client.request('turn/start', {threadId: result.thread.id, input: [{type: 'text', text: '再来'}]});
    await completion;
    assert.deepEqual(requestedModels, ['test-model', 'test-model', 'switched-model']);
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(codexHome, {recursive: true, force: true});
  }
});

test('启动失败会拒绝请求，关闭不挂起', async () => {
  const client = new AppServerClient(process.cwd(), {command: '/does-not-exist/mini-codex', args: []});
  await assert.rejects(client.request('initialize', {}), /无法启动/);
  await client.close();
});

test('子进程退出会拒绝尚未返回的请求', async () => {
  const client = new AppServerClient(process.cwd(), {command: process.execPath, args: ['-e', 'process.exit(1)']});
  await assert.rejects(client.request('initialize', {}), /已退出|无法向/);
  await client.close();
});
