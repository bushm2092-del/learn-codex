import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough, Writable} from 'node:stream';
import {render} from 'ink';
import {App} from '../src/app.js';
import {ChatWidget} from '../src/chatwidget.js';
import {FakeSession, tick, until} from './helpers.js';

// 使用真实 Ink 光标控制序列；ink-testing-library 的 debug 模式不输出光标定位。
test('terminal cursor follows Chinese input, cursor-only movement, paste and wrapping in the same frame', async () => {
  let output = '';
  const stdout = Object.assign(new Writable({write(chunk, _encoding, done) { output += chunk.toString(); done(); }}), {columns: 40, rows: 16, isTTY: true});
  const stdin = Object.assign(new PassThrough(), {isTTY: true, setRawMode() {}, ref() {}, unref() {}});
  const session = new FakeSession();
  const chat = new ChatWidget(session, '/tmp');
  const instance = render(<App chat={chat}/>, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    interactive: true, alternateScreen: true, incrementalRendering: true, exitOnCtrlC: false, patchConsole: false,
    kittyKeyboard: {mode: 'disabled'},
  });
  const cursorColumn = () => {
    const moves = [...output.matchAll(/\x1b\[(\d+)G\x1b\[\?25h/g)];
    return Number(moves.at(-1)?.[1]) - 1;
  };
  const send = async (text: string) => { stdin.write(text); await tick(); await tick(); };
  try {
    await until(() => chat.getSnapshot().phase === 'ready'); await tick();
    assert.match(output, /\x1b\[\?1000h\x1b\[\?1006h/);
    await send('阿斯顿发');
    assert.equal(cursorColumn(), 10, 'four Chinese characters occupy eight columns after the two-column prefix');
    await send('\x1b[D');
    assert.equal(cursorColumn(), 8, 'moving left must update the cursor without changing the text');
    await send('\x7f');
    assert.equal(cursorColumn(), 6);
    await send('\x03');
    assert.equal(cursorColumn(), 2, 'clearing the draft restores the insertion point');
    await send('\x1b[200~你好\n世界\x1b[201~');
    assert.equal(cursorColumn(), 6);
    await send('\x03');
    await send('中'.repeat(19));
    assert.equal(cursorColumn(), 2, 'a full-width row moves the cursor onto the following row');
    await send('\x03');
    chat.add('info', Array.from({length: 60}, (_, i) => `scroll-row-${i}`).join('\n'));
    await tick(); await tick();
    await send('stable draft');
    output = '';
    await send('\x1b[<64;10;3M');
    assert.match(output, /scroll-row-/, 'scrolling paints the changed history lines');
    assert.doesNotMatch(output, /stable draft|deepseek-flash|for shortcuts/, 'unchanged composer and footer are not repainted');
    assert.doesNotMatch(output, /\x1b\[(?:2J|3J|2K)/, 'scrolling does not erase the screen or whole lines before drawing');
    assert.equal(cursorColumn(), 14, 'scrolling preserves the draft cursor');

  } finally {
    instance.unmount(); instance.cleanup(); await chat.close();
    assert.match(output, /\x1b\[\?1006l\x1b\[\?1000l/);
    stdin.destroy(); stdout.destroy();
  }
});
