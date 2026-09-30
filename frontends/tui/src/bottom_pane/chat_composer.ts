import {graphemes, layoutDraft, type Draft} from './textarea.js';
import {fit} from '../terminal.js';
import {composerRow, muted} from '../style.js';

export function composerLines(draft: Draft, width: number, maxRows: number, focused: boolean) {
  const {rows, cursorRow, cursorColumn} = layoutDraft(draft, Math.max(1, width - 2));
  const start = Math.max(0, cursorRow - maxRows + 1);
  const visible = rows.slice(start, start + maxRows);
  const lines = visible.map((row, index) => {
    const prefix = index + start === 0 ? '› ' : '  ';
    if (!draft.text && index === 0) return prefix + muted(fit('Ask mini-codex to do anything', width - 2));
    return prefix + row.text;
  });
  // 源 composer_rect 包含上下留白，整块背景铺满终端列宽。
  return {lines: ['', ...lines, ''].map(line => composerRow(line, width)), cursor: focused ? {x: cursorColumn + 2, y: cursorRow - start + 1} : undefined};
}

export function atDraftBoundary(draft: Draft) {
  return draft.cursor === 0 || draft.cursor === graphemes(draft.text).length;
}
