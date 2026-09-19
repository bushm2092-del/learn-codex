import React from 'react';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {render} from 'ink-testing-library';
import {MarkdownText} from '../src/markdown_render.js';

// 去掉可能存在的 ANSI 转义后按纯文本行比较。
const strip = (frame: string) => frame.replace(/\u001b\[[0-9;]*m/g, '');

test('标题、列表、引用、分隔线与行内样式按源项目约定渲染', () => {
  const ui = render(<MarkdownText text={[
    '# 标题',
    '',
    '段落 **粗体** *斜体* `代码` ~~删除~~ [链接](https://example.com)',
    '',
    '- 一',
    '  - 一点一',
    '1. 甲',
    '2. 乙',
    '',
    '> 引用内容',
    '',
    '---',
  ].join('\n')} />);
  try {
    const lines = strip(ui.lastFrame()!).split('\n').map(line => line.trimEnd());
    assert.deepEqual(lines, [
      '# 标题',
      '',
      '段落 粗体 斜体 代码 删除 链接 (https://example.com)',
      '',
      '- 一',
      '    - 一点一',
      '',
      '1. 甲',
      '2. 乙',
      '',
      '> 引用内容',
      '',
      '———',
    ]);
    // 非 TTY 下 Ink 不输出 ANSI 样式，这里只能验证文本结构；样式表见 markdown_render.tsx 顶部。
  } finally { ui.unmount(); ui.cleanup(); }
});

test('代码块保留原文与缩进，表格按列宽对齐', () => {
  const ui = render(<MarkdownText text={[
    '```python',
    'def f():',
    '    return 1',
    '```',
    '',
    '| 列 A | B |',
    '|---|---|',
    '| 1 | 长一些 |',
  ].join('\n')} />);
  try {
    const lines = strip(ui.lastFrame()!).split('\n').map(line => line.trimEnd());
    assert.deepEqual(lines, [
      '```python',
      'def f():',
      '    return 1',
      '```',
      '',
      '| 列 A | B      |',
      '|------|--------|',
      '| 1    | 长一些 |',
    ]);
  } finally { ui.unmount(); ui.cleanup(); }
});

test('流式过程中未闭合的代码围栏不会抛错', () => {
  const ui = render(<MarkdownText text={'看这段：\n\n```rust\nfn main() {'} />);
  try {
    assert.match(strip(ui.lastFrame()!), /fn main\(\) \{/);
  } finally { ui.unmount(); ui.cleanup(); }
});
