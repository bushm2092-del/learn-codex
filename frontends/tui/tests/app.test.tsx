import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {render} from 'ink-testing-library';
import {App} from '../src/app.js';
import {ChatWidget} from '../src/chatwidget.js';
import {FakeSession, tick, until} from './helpers.js';

test('keyboard flow: slash completion, model picker, paste, stream, history, clear and unsupported commands', async () => {
  const session = new FakeSession();
  const chat = new ChatWidget(session, '/tmp/项目');
  const ui = render(<App chat={chat}/>);
  try {
    await until(() => chat.getSnapshot().phase === 'ready'); await tick();
    assert.match(ui.lastFrame()!, />_ mini-codex/);
    ui.stdin.write('/mod'); await tick();
    assert.match(ui.lastFrame()!, /choose what model/);
    ui.stdin.write('\r'); await tick();
    assert.match(ui.lastFrame()!, /Select Model/);
    ui.stdin.write('\x1b[B'); await tick();
    ui.stdin.write('\r'); await tick();
    assert.deepEqual(session.saved, ['deepseek-v4-pro']);
    ui.stdin.write('\x1b[200~你好\n第二行\x1b[201~'); await tick();
    assert.equal(session.turns.length, 0);
    assert.match(ui.lastFrame()!, /第二行/);
    ui.stdin.write('\r'); await tick();
    assert.equal(session.turns[0]?.text, '你好\n第二行');
    assert.match(ui.lastFrame()!, /Working/);
    session.finish('**收到**：你好'); await tick();
    assert.match(ui.lastFrame()!, /收到/);
    ui.stdin.write('\x1b[A'); await tick();
    assert.match(ui.lastFrame()!, /第二行/);
    ui.stdin.write('\x03'); await tick();
    ui.stdin.write('/resume'); await tick(); ui.stdin.write('\r'); await tick();
    assert.match(ui.lastFrame()!, /尚未支持/);
    assert.equal(session.turns.length, 1);
    ui.stdin.write('\x03'); await tick();
    ui.stdin.write('/clear'); await tick(); ui.stdin.write('\r'); await tick();
    assert.equal(chat.getSnapshot().thread?.id, 'thread-2');
    assert.deepEqual(chat.getSnapshot().cells, []);
    assert.doesNotMatch(ui.lastFrame()!, /收到/);
  } finally { ui.unmount(); ui.cleanup(); await chat.close(); }
});

test('search accepts recalled text without submitting and help returns to intact draft', async () => {
  const session = new FakeSession();
  const chat = new ChatWidget(session, '/tmp');
  const ui = render(<App chat={chat}/>);
  try {
    await until(() => chat.getSnapshot().phase === 'ready'); await tick();
    ui.stdin.write('first prompt'); await tick(); ui.stdin.write('\r'); await tick();
    session.finish(); await tick();
    ui.stdin.write('?'); await tick();
    assert.match(ui.lastFrame()!, /Keyboard shortcuts/);
    ui.stdin.write('\x1b'); await tick();
    ui.stdin.write('\x12'); await tick();
    ui.stdin.write('first'); await tick();
    assert.match(ui.lastFrame()!, /reverse-i-search: first/);
    ui.stdin.write('\r'); await tick();
    assert.equal(session.turns.length, 1);
    assert.match(ui.lastFrame()!, /› first prompt/);
  } finally { ui.unmount(); ui.cleanup(); await chat.close(); }
});
test('Ctrl+J and Alt+Enter insert newlines, while ! shell mode is explicitly refused', async () => {
  const session = new FakeSession();
  const chat = new ChatWidget(session, '/tmp');
  const ui = render(<App chat={chat}/>);
  try {
    await until(() => chat.getSnapshot().phase === 'ready'); await tick();
    ui.stdin.write('one'); await tick(); ui.stdin.write('\n'); await tick();
    ui.stdin.write('two'); await tick(); ui.stdin.write('\x1b\r'); await tick();
    ui.stdin.write('three'); await tick();
    assert.equal(session.turns.length, 0);
    ui.stdin.write('\r'); await tick();
    assert.equal(session.turns[0]?.text, 'one\ntwo\nthree');
    session.finish(); await tick();
    ui.stdin.write('!pwd'); await tick(); ui.stdin.write('\r'); await tick();
    assert.match(ui.lastFrame()!, /尚未支持 !/);
    assert.equal(session.turns.length, 1);
  } finally { ui.unmount(); ui.cleanup(); await chat.close(); }
});

test('SGR wheel scrolls conversation without recalling history or modifying the draft', async () => {
  const session = new FakeSession();
  const chat = new ChatWidget(session, '/tmp');
  const ui = render(<App chat={chat}/>);
  const send = async (value: string) => { ui.stdin.write(value); await tick(); };
  try {
    await until(() => chat.getSnapshot().phase === 'ready'); await tick();
    await send('previous prompt'); await send('\r');
    session.finish(Array.from({length: 80}, (_,i) => `history line ${String(i).padStart(2, '0')}`).join('\n'));
    await tick();
    const bottom = ui.lastFrame();
    await send('\x1b[<64;10;3M');
    assert.notEqual(ui.lastFrame(), bottom);
    assert.doesNotMatch(ui.lastFrame()!, /› previous prompt/);
    await send('\x1b[<65;10;3M');
    assert.equal(ui.lastFrame(), bottom);
    await send('draft stays');
    await send('\x1b[<64;10;3M');
    const reading = ui.lastFrame();
    chat.add('info', 'new content while reading'); await tick();
    assert.equal(ui.lastFrame(), reading, 'appending content preserves the reading position');
    await send('\x1b[<0;10;3M'); // 点击与松开也不能泄漏为输入文本。
    await send('\x1b[<0;10;3m');
    await send('\x14');
    const transcript = ui.lastFrame();
    await send('\x1b[<64;10;3M');
    assert.notEqual(ui.lastFrame(), transcript);
    await send('\x1b');
    await send('\r');
    assert.equal(session.turns.at(-1)?.text, 'draft stays');
    session.finish(); await tick();
    await send('\x1b[A'); await send('\r');
    assert.equal(session.turns.at(-1)?.text, 'draft stays', 'keyboard arrows still recall input history');
  } finally { ui.unmount(); ui.cleanup(); await chat.close(); }
});
