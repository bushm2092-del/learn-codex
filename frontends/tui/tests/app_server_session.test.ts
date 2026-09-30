import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, writeFile, readFile, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {AppServerSession} from '../src/app_server_session.js';
import {ChatWidget} from '../src/chatwidget.js';
import {until} from './helpers.js';

test('real Rust app-server: streaming, tool execution, model persistence, fresh context and failure recovery', {timeout: 15_000}, async () => {
  const binary = resolve('../../mini-codex-rs/target/debug/mini-codex-app-server' + (process.platform === 'win32' ? '.exe' : ''));
  await access(binary); // 必须真实构建；缺失时失败，不静默跳过。
  const home = await mkdtemp(join(tmpdir(), 'mini-codex-tui-'));
  const requests: {model: string; input: {type: string; content?: unknown; call_id?: string}[]}[] = [];
  const http = createServer(async (req, res) => {
    let body = '';
    for await (const data of req) body += data;
    requests.push(JSON.parse(body));
    if (requests.length === 4) { res.writeHead(503); res.end('private upstream error'); return; }
    res.writeHead(200, {'Content-Type': 'text/event-stream'});
    const event = (value: unknown) => res.write(`data: ${JSON.stringify(value)}\n\n`);
    if (requests.length === 1) {
      event({type: 'response.output_item.done', item: {type: 'function_call', call_id: 'call-1', name: 'exec_command', arguments: JSON.stringify({cmd: 'printf tui-tool-ok', max_output_tokens: 100})}});
    } else {
      event({type: 'response.output_text.delta', delta: '你好'});
      event({type: 'response.output_text.delta', delta: '，终端'});
      event({type: 'response.output_item.done', item: {type: 'message', role: 'assistant', content: [{type: 'output_text', text: '你好，终端'}]}});
    }
    event({type: 'response.completed'});
    res.end();
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  await writeFile(join(home, 'config.toml'), `model = "deepseek-flash"\nmodel_provider = "deepseek"\n[model_providers.deepseek]\nname = "Local test fixture"\nbase_url = "http://127.0.0.1:${address.port}"\nenv_key = "MINI_CODEX_TEST_KEY"\nwire_api = "responses"\n`);
  const session = new AppServerSession(binary, [], home, {env: {...process.env, MINI_CODEX_HOME: home, MINI_CODEX_TEST_KEY: 'offline-test-only'}});
  const chat = new ChatWidget(session, home);
  try {
    await chat.initialize();
    assert.equal(chat.getSnapshot().phase, 'ready', chat.getSnapshot().notice);
    assert.ok(chat.getSnapshot().models.length >= 2);
    assert.equal(await chat.submit('run a test command'), true);
    await until(() => !chat.getSnapshot().busy, 6000);
    assert.deepEqual(chat.getSnapshot().cells.map(cell => cell.kind), ['user', 'tool', 'assistant']);
    assert.match(chat.getSnapshot().cells[1]!.output!, /tui-tool-ok/);
    assert.equal(chat.getSnapshot().cells[2]!.text, '你好，终端');
    assert.ok(requests[1]!.input.some(item => item.type === 'function_call_output' && item.call_id === 'call-1'));
    await chat.selectModel('deepseek-v4-pro');
    assert.match(await readFile(join(home, 'config.toml'), 'utf8'), /model = "deepseek-v4-pro"/);
    const oldThread = chat.getSnapshot().thread!.id;
    await chat.newThread(true);
    assert.notEqual(chat.getSnapshot().thread!.id, oldThread);
    await chat.submit('fresh context');
    await until(() => !chat.getSnapshot().busy);
    assert.equal(requests[2]!.model, 'deepseek-v4-pro');
    assert.ok(!JSON.stringify(requests[2]!.input).includes('run a test command'));
    await chat.submit('fail now');
    await until(() => !chat.getSnapshot().busy);
    assert.equal(chat.getSnapshot().cells.at(-1)?.kind, 'error');
    assert.ok(!JSON.stringify(chat.getSnapshot()).includes('private upstream error'));
    await chat.submit('recover');
    await until(() => !chat.getSnapshot().busy);
    assert.equal(chat.getSnapshot().cells.at(-1)?.text, '你好，终端');
  } finally {
    await chat.close();
    await new Promise<void>(resolve => http.close(() => resolve()));
    await rm(home, {recursive: true, force: true});
  }
});

test('missing executable, malformed JSONL, and timeouts reject without leaking stderr', async () => {
  const missing = new AppServerSession('/not/a/real/mini-codex-app-server', [], tmpdir());
  await assert.rejects(missing.initialize(), /无法启动/);
  await missing.close();
  const malformed = new AppServerSession(process.execPath, ['-e', 'process.stdin.resume();process.stderr.write("private-key");process.stdout.write("not json\\n");'], tmpdir());
  await assert.rejects(malformed.initialize(), /无效 JSONL/);
  await malformed.close();
  const hanging = new AppServerSession(process.execPath, ['-e', 'process.stdin.resume();'], tmpdir(), {timeoutMs: 50});
  await assert.rejects(hanging.initialize(), /请求超时/);
  await assert.rejects(hanging.startThread('/tmp'), /连接状态未知/);
  await hanging.close();
});
