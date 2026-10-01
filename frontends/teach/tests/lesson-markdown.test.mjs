import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { articleHeadings, articleBody, remarkLessonMarkup, sourceTarget } from '../src/ui/lessonMarkdown.ts';

const parse = markdown => {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkLessonMarkup);
  return processor.runSync(processor.parse(markdown));
};

test('headings use explicit anchors and stable duplicate slugs, preserving inline content', () => {
  assert.deepEqual(articleHeadings('## **History** and `input` {#history}\n\n## Repeat\n\n## Repeat'), [
    { id: 'history', text: 'History and input', level: 2 },
    { id: 'repeat', text: 'Repeat', level: 2 },
    { id: 'repeat-1', text: 'Repeat', level: 2 },
  ]);
});

test('GFM handles ordered lists, nested lists, tables and fenced code without losing blocks', () => {
  const tree = parse('1. first\n   - nested\n2. second\n\n| A | B |\n| --- | --- |\n| x | y |\n\n```rust\nlet x = 1;\n```');
  assert.deepEqual(tree.children.map(x => x.type), ['list', 'table', 'code']);
  assert.equal(tree.children[0].ordered, true);
  assert.equal(tree.children[0].children[0].children[1].type, 'list');
  assert.equal(tree.children[2].value, 'let x = 1;');
});

test('custom component directives preserve names and parameters without evaluating text', () => {
  const node = parse('::ContextTrace{id="local"}').children[0];
  assert.equal(node.data.hName, 'div');
  assert.deepEqual(node.data.hProperties, { 'data-lesson-component': 'ContextTrace', 'data-prop-id': 'local' });
});

test('both Context languages preserve all 19 anchors and six animation slots', async () => {
  const results = [];
  for (const locale of ['zh', 'en']) {
    const markdown = await readFile(new URL(`../src/lessons/context/article.${locale}.md`, import.meta.url), 'utf8');
    const headings = articleHeadings(markdown);
    const components = parse(markdown).children.filter(x => x.type === 'leafDirective');
    assert.equal(headings.length, 19);
    assert.equal(new Set(headings.map(x => x.id)).size, 19);
    assert.deepEqual(components.map(x => x.attributes.id), ['conversation', 'normalize', 'usage', 'local', 'remote', 'budget']);
    results.push(headings.map(x => x.id));
  }
  assert.deepEqual(results[0], results[1]);
});

test('source links require an actual file or directory in the selected source', () => {
  const paths = new Set(['crates/core/src/session/turn.rs']);
  assert.equal(sourceTarget('crates/core/src/session/turn.rs', paths), 'crates/core/src/session/turn.rs');
  assert.equal(sourceTarget('crates/core/', paths), 'crates/core/');
  assert.equal(sourceTarget('crates/core/src/missing.rs', paths), undefined);
  assert.equal(sourceTarget('../../secret', paths), undefined);
});

test('chapter four retains its Markdown body through the shared renderer migration', async () => {
  const markdown = await readFile(new URL('../src/lessons/function-call-source/article.md', import.meta.url), 'utf8');
  const body = articleBody(markdown);
  assert.ok(body.startsWith('## 一个tools 模块要做什么'));
  assert.ok(parse(body).children.some(x => x.type === 'code' && x.lang === 'rust'));
});
