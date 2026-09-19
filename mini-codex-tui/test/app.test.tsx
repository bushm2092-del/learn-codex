import React from 'react';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {render} from 'ink-testing-library';
import {App} from '../src/app.js';
import type {Client, Notification} from '../src/protocol.js';

class FakeClient implements Client {
  listeners = new Set<(event: Notification) => void>();
  calls: {method: string; params: unknown}[] = [];
  async request<T>(method: string, params: unknown): Promise<T> {
    this.calls.push({method, params});
    if (method === 'thread/start') return {thread: {id: 'thread-1'}} as T;
    if (method === 'turn/start') return {turn: {id: 'turn-1'}} as T;
    if (method === 'config/read') return {config: {model: 'deepseek-flash', modelProvider: 'deepseek'}} as T;
    if (method === 'model/list') return {data: [
      {id: 'deepseek-flash', model: 'deepseek-flash', displayName: 'Flash', description: '快', hidden: false, isDefault: true},
      {id: 'deepseek-v4-pro', model: 'deepseek-v4-pro', displayName: 'Pro', description: '强', hidden: false, isDefault: false},
    ], nextCursor: null} as T;
    if (method === 'config/value/write') return {status: 'ok', version: 'sha256:x', filePath: '/tmp/config.toml'} as T;
    return {} as T;
  }
  notify() {}
  subscribe(listener: (event: Notification) => void) { this.listeners.add(listener); return () => {this.listeners.delete(listener);}; }
  onFailure() { return () => {}; }
  emit(event: Notification) { for (const listener of this.listeners) listener(event); }
}

test('Ink 输入、流式文本、工具状态和失败恢复', async () => {
  const client = new FakeClient();
  let exited = false;
  const ui = render(<App client={client} cwd="/tmp" onExit={() => {exited = true;}} />);
  try {
    await delay(80);
    assert.match(ui.lastFrame()!, /就绪/);
    ui.stdin.write('你好');
    await delay(30);
    ui.stdin.write('\r');
    await delay(30);
    assert.deepEqual(client.calls.at(-1), {method: 'turn/start', params: {threadId: 'thread-1', input: [{type: 'text', text: '你好'}]}});
    const scope = {threadId: 'thread-1', turnId: 'turn-1'};
    client.emit({method: 'item/agentMessage/delta', params: {...scope, itemId: 'a', delta: '正在检查'}});
    client.emit({method: 'item/completed', params: {...scope, item: {type: 'commandExecution', id: 'tool', command: 'pwd', status: 'completed', aggregatedOutput: '/tmp'}}});
    await delay(30);
    assert.match(ui.lastFrame()!, /正在检查/);
    assert.match(ui.lastFrame()!, /工具 · 成功/);
    client.emit({method: 'item/completed', params: {...scope, item: {type: 'agentMessage', id: 'a', text: '检查完成'}}});
    client.emit({method: 'turn/completed', params: {...scope, turn: {id: 'turn-1', status: 'failed', error: {message: '测试失败'}}}});
    await delay(30);
    assert.match(ui.lastFrame()!, /检查完成/);
    assert.doesNotMatch(ui.lastFrame()!, /正在检查/);
    assert.match(ui.lastFrame()!, /测试失败/);
    ui.stdin.write('/exit');
    await delay(30);
    ui.stdin.write('\r');
    await delay(30);
    assert.equal(exited, true);
  } finally { ui.unmount(); ui.cleanup(); }
});


test('连接失败后提供配置提示，仍然可以输入退出命令', async () => {
  class FailedClient extends FakeClient {
    async request<T>(): Promise<T> { throw new Error('连接失败'); }
  }
  let exited = false;
  const ui = render(<App client={new FailedClient()} cwd="/tmp" onExit={() => {exited = true;}} />);
  try {
    await delay(60);
    assert.match(ui.lastFrame()!, /DEEPSEEK_API_KEY/);
    assert.doesNotMatch(ui.lastFrame()!, /等待连接/);
    ui.stdin.write('/exit');
    await delay(30);
    ui.stdin.write('\r');
    await delay(30);
    assert.equal(exited, true);
  } finally {ui.unmount(); ui.cleanup();}
});

test('窄终端和工具展开，清屏不创建新的后端会话', async () => {
  const client = new FakeClient();
  const ui = render(<App client={client} cwd="/tmp" demo onExit={() => {}} />);
  try {
    Object.defineProperty(ui.stdout, 'columns', {value: 48, configurable: true});
    ui.stdout.emit('resize');
    await delay(70);
    assert.match(ui.lastFrame()!, /DEMO/);
    client.emit({method: 'item/completed', params: {threadId: 'thread-1', turnId: 'turn-1', item: {type: 'commandExecution', id: 'tool', command: 'pwd', status: 'completed', aggregatedOutput: 'one\ntwo\nthree\nfour\nfive\nlast-line'}}});
    await delay(30);
    assert.match(ui.lastFrame()!, /Tab/);
    assert.doesNotMatch(ui.lastFrame()!, /last-line/);
    ui.stdin.write('\t');
    await delay(30);
    assert.match(ui.lastFrame()!, /last-line/);
    ui.stdin.write('/clear');
    await delay(30);
    ui.stdin.write('\r');
    await delay(30);
    assert.doesNotMatch(ui.lastFrame()!, /last-line/);
    assert.equal(client.calls.filter(call => call.method === 'thread/start').length, 1);
  } finally {ui.unmount(); ui.cleanup();}
});


test('/model 弹出选择器，选中后更新会话并写回 config.toml', async () => {
  const client = new FakeClient();
  const ui = render(<App client={client} cwd="/tmp" onExit={() => {}} />);
  try {
    await delay(80);
    assert.match(ui.lastFrame()!, /模型：deepseek-flash/);
    ui.stdin.write('/model');
    await delay(30);
    ui.stdin.write('\r');
    await delay(40);
    assert.match(ui.lastFrame()!, /选择模型/);
    assert.match(ui.lastFrame()!, /deepseek-flash（当前）/);
    assert.doesNotMatch(ui.lastFrame()!, /❯/);
    // Esc 关闭且不产生任何写入。
    ui.stdin.write('\u001b');
    await delay(30);
    assert.doesNotMatch(ui.lastFrame()!, /选择模型/);
    assert.equal(client.calls.some(call => call.method === 'config/value/write'), false);

    ui.stdin.write('/model');
    await delay(30);
    ui.stdin.write('\r');
    await delay(40);
    ui.stdin.write('\u001b[B');
    await delay(30);
    ui.stdin.write('\r');
    await delay(40);
    assert.deepEqual(client.calls.filter(call => call.method === 'thread/settings/update'), [
      {method: 'thread/settings/update', params: {threadId: 'thread-1', model: 'deepseek-v4-pro'}},
    ]);
    assert.deepEqual(client.calls.filter(call => call.method === 'config/value/write'), [
      {method: 'config/value/write', params: {keyPath: 'model', value: 'deepseek-v4-pro', mergeStrategy: 'replace'}},
    ]);
    assert.match(ui.lastFrame()!, /模型：deepseek-v4-pro/);
    assert.match(ui.lastFrame()!, /模型已切换为 deepseek-v4-pro/);
    assert.match(ui.lastFrame()!, /❯/);
    // 后端通知也能同步头部显示。
    client.emit({method: 'thread/settings/applied', params: {threadId: 'thread-1', settings: {model: 'deepseek-flash'}}});
    await delay(30);
    assert.match(ui.lastFrame()!, /模型：deepseek-flash/);
  } finally {ui.unmount(); ui.cleanup();}
});

test('长消息不会将输入栏推出终端视窗', async () => {
  const client = new FakeClient();
  const ui = render(<App client={client} cwd="/tmp" onExit={() => {}} />);
  try {
    await delay(60);
    Object.defineProperty(ui.stdout, 'columns', {value: 90, configurable: true});
    Object.defineProperty(ui.stdout, 'rows', {value: 32, configurable: true});
    ui.stdout.emit('resize');
    await delay(30);
    const before = ui.lastFrame()!.split('\n');
    const inputLine = before.findIndex(line => line.includes('❯'));
    assert.ok(before.some(line => line.includes('欢迎回来！') && line.includes('开始使用')));
    client.emit({method: 'item/completed', params: {threadId: 'thread-1', turnId: 'turn-1', item: {type: 'agentMessage', id: 'long', text: Array.from({length: 80}, (_, index) => `line-${index}`).join('\n')}}});
    await delay(40);
    const after = ui.lastFrame()!.split('\n');
    assert.equal(after.findIndex(line => line.includes('❯')), inputLine);
    assert.ok(after.length <= 32);
    assert.match(ui.lastFrame()!, /line-79/);
  } finally {ui.unmount(); ui.cleanup();}
});
