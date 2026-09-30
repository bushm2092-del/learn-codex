import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Key} from 'ink';
import stringWidth from 'string-width';
import {edit, emptyDraft, insert, replaceDraft, layoutDraft} from '../src/bottom_pane/textarea.js';
import {ChatComposerHistory} from '../src/bottom_pane/chat_composer_history.js';
import {safeText} from '../src/terminal.js';
import {cellLines, sessionHeader} from '../src/history_cell.js';
import {modelPickerLines} from '../src/bottom_pane/list_selection_view.js';
import {models} from './helpers.js';

const key = (partial: Partial<Key> = {}) => partial as Key;
test('grapheme editing preserves Chinese, emoji families and combining marks', () => {
  let draft = insert(emptyDraft(), '中文👨‍👩‍👧‍👦e\u0301');
  assert.equal(draft.cursor, 4);
  draft = edit(draft, '', key({backspace: true}), 20);
  assert.equal(draft.text, '中文👨‍👩‍👧‍👦');
  draft = edit(draft, '', key({leftArrow: true}), 20);
  draft = edit(draft, '', key({delete: true}), 20);
  assert.deepEqual(draft, {text: '中文', cursor: 2, killBuffer: ''});
});
test('kill buffer survives draft clear and yank restores it', () => {
  let draft = insert(emptyDraft(), 'hello world');
  draft = edit(draft, 'w', key({ctrl: true}), 40);
  assert.equal(draft.text, 'hello ');
  draft = replaceDraft(draft, '');
  draft = edit(draft, 'y', key({ctrl: true}), 40);
  assert.equal(draft.text, 'world');
});
test('line-start editing at index zero never targets a later newline', () => {
  const draft = {...insert(emptyDraft(), 'first\nsecond'), cursor: 0};
  assert.deepEqual(edit(draft, 'a', key({ctrl: true}), 40), draft);
  assert.equal(edit(draft, 'u', key({ctrl: true}), 40).text, 'first\nsecond');
  assert.equal(edit(draft, 'k', key({ctrl: true}), 40).text, '\nsecond');
});
test('wrapped cursor has a visible row at full width and survives resize', () => {
  const draft = insert(emptyDraft(), '中文你好');
  assert.deepEqual(layoutDraft(draft, 8), {rows: [{text: '中文你好', start: 0, end: 4}, {text: '', start: 4, end: 4}], cursorRow: 1, cursorColumn: 0});
  const narrow = layoutDraft(draft, 4);
  assert.equal(narrow.cursorRow, 2);
  assert.ok(narrow.rows.every(row => stringWidth(row.text) <= 4));
});
test('model picker fits a narrow viewport and rejects terminal escapes in descriptions', () => {
  const values = models.map(model => ({...model, description: '\x1b[2J' + model.description}));
  const lines = modelPickerLines(values, 0, models[0]!.model, 40, 13);
  assert.ok(lines.every(line => stringWidth(line) <= 40));
  assert.ok(lines.length <= 13);
  assert.ok(!lines.join('\n').includes('\x1b[2J'));
});
test('bracketed paste content is normalized and never interpreted as a command', () => {
  const draft = insert(emptyDraft(), 'first\r\n/exit\rthird\x1b[2J\x1b]52;c;payload\x07');
  assert.equal(draft.text, 'first\n/exit\nthird');
  assert.equal(safeText('\x1b[31mred\x1b[0m\x00'), 'red');
});
test('local history collapses adjacent duplicates and respects cursor boundaries', () => {
  const history = new ChatComposerHistory();
  history.record('first'); history.record('second'); history.record('second');
  assert.deepEqual(history.entries, ['first', 'second']);
  assert.equal(history.shouldNavigate('unsent', true), false);
  assert.equal(history.navigate(-1), 'second');
  assert.equal(history.shouldNavigate('second', false), false);
  assert.equal(history.shouldNavigate('second', true), true);
  assert.equal(history.navigate(-1), 'first');
  assert.equal(history.navigate(-1), undefined);
  assert.equal(history.navigate(1), 'second');
  assert.equal(history.navigate(1), '');
  assert.deepEqual(history.matches('s'), ['second', 'first']);
});
test('header and long tool output stay inside narrow terminal, transcript preserves full output', () => {
  for (const width of [20, 40, 80]) {
    assert.ok(sessionHeader('deepseek-flash', '/tmp/中文/long-directory', width).every(line => stringWidth(line) <= width));
    const tool = {id: 'tool', kind: 'tool' as const, text: 'printf output', output: Array.from({length: 20}, (_, i) => `line ${i}`).join('\n'), status: 'completed'};
    assert.match(cellLines(tool, width).join('\n'), /lines/);
    assert.match(cellLines(tool, width, true).join('\n'), /line 10/);
    assert.ok(cellLines(tool, width).every(line => stringWidth(line) <= width));
  }
});
