// 对照 bottom_pane/textarea.rs；只保留纯文本编辑分支，光标以 grapheme 索引存储。
import type {Key} from 'ink';
import stringWidth from 'string-width';
import {safeText} from '../terminal.js';

export interface Draft {text: string; cursor: number; killBuffer: string}
export const emptyDraft = (): Draft => ({text: '', cursor: 0, killBuffer: ''});
export const graphemes = (text: string): string[] => Array.from(new Intl.Segmenter().segment(text), item => item.segment);
export function replaceDraft(draft: Draft, text: string): Draft {
  return {...draft, text, cursor: graphemes(text).length};
}
export function insert(draft: Draft, text: string): Draft {
  const parts = graphemes(draft.text);
  const added = graphemes(safeText(text).replace(/\t/g, '    '));
  parts.splice(draft.cursor, 0, ...added);
  return {...draft, text: parts.join(''), cursor: draft.cursor + added.length};
}
export function layoutDraft(draft: Draft, width: number) {
  const rows: {text: string; start: number; end: number}[] = [];
  let text = '', start = 0, columns = 0;
  const parts = graphemes(draft.text);
  for (const [index, part] of parts.entries()) {
    const size = stringWidth(part);
    if (part === '\n' || columns + size > width) {
      rows.push({text, start, end: index});
      text = ''; columns = 0; start = part === '\n' ? index + 1 : index;
    }
    if (part !== '\n') { text += part; columns += size; }
  }
  rows.push({text, start, end: parts.length});
  // 满行末尾需要留出光标所在的一格，与 upstream wrapping 的末行规则一致。
  if (columns >= width && draft.cursor === parts.length) rows.push({text: '', start: parts.length, end: parts.length});
  const cursorRow = Math.max(0, rows.findLastIndex(row => row.start <= draft.cursor));
  return {rows, cursorRow, cursorColumn: stringWidth(parts.slice(rows[cursorRow]!.start, draft.cursor).join(''))};
}
export function edit(draft: Draft, input: string, key: Key, width: number): Draft {
  const parts = graphemes(draft.text);
  const pos = draft.cursor;
  const lineStart = pos === 0 ? 0 : parts.lastIndexOf('\n', pos - 1) + 1;
  const nextBreak = parts.indexOf('\n', pos);
  const lineEnd = nextBreak === -1 ? parts.length : nextBreak;
  const remove = (from: number, to: number, kill = false) => {
    const removed = parts.splice(from, to - from).join('');
    return {...draft, text: parts.join(''), cursor: from, killBuffer: kill ? removed : draft.killBuffer};
  };
  const wordLeft = () => {
    let p = pos;
    while (p > 0 && /\s/u.test(parts[p - 1]!)) p--;
    while (p > 0 && !/\s/u.test(parts[p - 1]!)) p--;
    return p;
  };
  const wordRight = () => {
    let p = pos;
    while (p < parts.length && /\s/u.test(parts[p]!)) p++;
    while (p < parts.length && !/\s/u.test(parts[p]!)) p++;
    return p;
  };
  if (key.ctrl && input === 'y') return insert(draft, draft.killBuffer);
  if (key.ctrl && input === 'u') return remove(lineStart, pos, true);
  if (key.ctrl && input === 'k') return remove(pos, lineEnd === pos ? Math.min(pos + 1, parts.length) : lineEnd, true);
  if ((key.ctrl && input === 'w') || ((key.meta || key.ctrl) && key.backspace)) return remove(wordLeft(), pos, true);
  if ((key.meta && input === 'd') || ((key.meta || key.ctrl) && key.delete)) return remove(pos, wordRight(), true);
  if (key.home || (key.ctrl && input === 'a')) return {...draft, cursor: lineStart};
  if (key.end || (key.ctrl && input === 'e')) return {...draft, cursor: lineEnd};
  if ((key.leftArrow && (key.meta || key.ctrl)) || (key.meta && input === 'b')) return {...draft, cursor: wordLeft()};
  if ((key.rightArrow && (key.meta || key.ctrl)) || (key.meta && input === 'f')) return {...draft, cursor: wordRight()};
  if (key.leftArrow || (key.ctrl && input === 'b')) return {...draft, cursor: Math.max(0, pos - 1)};
  if (key.rightArrow || (key.ctrl && input === 'f')) return {...draft, cursor: Math.min(parts.length, pos + 1)};
  if (key.backspace || (key.ctrl && input === 'h')) return remove(Math.max(0, pos - 1), pos);
  if (key.delete || (key.ctrl && input === 'd')) return remove(pos, Math.min(parts.length, pos + 1));
  if (key.upArrow || key.downArrow || (key.ctrl && ['p', 'n'].includes(input))) {
    const {rows, cursorRow, cursorColumn} = layoutDraft(draft, width);
    const delta = key.upArrow || input === 'p' ? -1 : 1;
    const target = rows[Math.max(0, Math.min(rows.length - 1, cursorRow + delta))]!;
    let cursor = target.start, columns = 0;
    while (cursor < target.end && columns + stringWidth(parts[cursor]!) <= cursorColumn) columns += stringWidth(parts[cursor++]!);
    return {...draft, cursor};
  }
  if ((key.return && (key.shift || key.meta)) || (key.ctrl && ['j', 'm'].includes(input))) return insert(draft, '\n');
  if (!key.ctrl && !key.meta && !key.escape && !key.tab && !key.return && !key.super) return insert(draft, input);
  return draft;
}
