// 对应 codex-rs/tui/src/markdown_render.rs：把 Markdown 渲染成带样式的终端行。
// 源项目用 pulldown-cmark 事件流驱动一个行构造器；这里用 marked 的 token 树做同样的事，
// 样式选择（标题保留 `#`、`- `/`1. ` 标记、`> ` 绿色引用、`———` 分隔线、青色代码与链接）照搬源项目。
// 未移植：代码块语法高亮、文件引用/本地链接改写、数学公式、mermaid。
import {memo, useMemo, type ReactNode} from 'react';
import {Box, Text} from 'ink';
import {marked, type Token, type Tokens} from 'marked';
import stringWidth from 'string-width';

// 与源项目 MarkdownStyles::for_theme 一致的样式表。
const styles = {
  code: {color: 'cyan'},
  link: {color: 'cyan', underline: true},
  blockquote: {color: 'green'},
  orderedListMarker: {color: 'blueBright'},
};

type Inline = {bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; color?: string};

function headingStyle(depth: number): Inline {
  switch (depth) {
    case 1: return {bold: true, underline: true};
    case 2: return {bold: true};
    case 3: return {bold: true, italic: true};
    default: return {italic: true};
  }
}

// 把行内 token 渲染为嵌套 <Text>；样式沿栈继承，对应源项目的 push_inline_style/pop_inline_style。
function renderInline(tokens: Token[] | undefined, style: Inline, keyPrefix: string): ReactNode[] {
  if (!tokens) return [];
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case 'text': {
        const text = token as Tokens.Text;
        return text.tokens ? <Text key={key} {...style}>{renderInline(text.tokens, style, key)}</Text> : <Text key={key} {...style}>{text.text}</Text>;
      }
      case 'escape': return <Text key={key} {...style}>{(token as Tokens.Escape).text}</Text>;
      case 'strong': return <Text key={key} {...style} bold>{renderInline((token as Tokens.Strong).tokens, {...style, bold: true}, key)}</Text>;
      case 'em': return <Text key={key} {...style} italic>{renderInline((token as Tokens.Em).tokens, {...style, italic: true}, key)}</Text>;
      case 'del': return <Text key={key} {...style} strikethrough>{renderInline((token as Tokens.Del).tokens, {...style, strikethrough: true}, key)}</Text>;
      case 'codespan': return <Text key={key} {...style} {...styles.code}>{(token as Tokens.Codespan).text}</Text>;
      case 'link': {
        const link = token as Tokens.Link;
        // 源项目在链接文字后附上目标地址，终端里不能点击时仍可看到 URL。
        return <Text key={key} {...style}>
          <Text {...styles.link}>{renderInline(link.tokens, {...style, ...styles.link}, key)}</Text>
          {link.text !== link.href && <Text dimColor> ({link.href})</Text>}
        </Text>;
      }
      case 'image': return <Text key={key} {...style} dimColor>[图片: {(token as Tokens.Image).text || (token as Tokens.Image).href}]</Text>;
      case 'br': return <Text key={key}>{'\n'}</Text>;
      case 'html': return <Text key={key} {...style}>{(token as Tokens.HTML).text}</Text>;
      default: return <Text key={key} {...style}>{'raw' in token ? String(token.raw) : ''}</Text>;
    }
  });
}

// 表格按列宽对齐，对应源项目 start_table/end_table 的列宽计算。
function renderTable(table: Tokens.Table, key: string): ReactNode {
  const rows = [table.header, ...table.rows];
  const plain = (cell: Tokens.TableCell) => cell.text;
  // 源项目用 unicode-width 计算列宽；CJK 字符占两格，必须按显示宽度对齐。
  const widths = table.header.map((_, column) => Math.max(...rows.map(row => stringWidth(plain(row[column]!)))));
  const line = (row: Tokens.TableCell[], rowKey: string, bold: boolean) => <Text key={rowKey}>
    {row.map((cell, column) => <Text key={column}>
      {column === 0 ? '| ' : ' | '}
      <Text bold={bold}>{renderInline(cell.tokens, {}, `${rowKey}-${column}`)}</Text>
      {' '.repeat(Math.max(0, widths[column]! - stringWidth(plain(cell))))}
    </Text>)}
    <Text> |</Text>
  </Text>;
  return <Box key={key} flexDirection="column">
    {line(table.header, `${key}-head`, true)}
    <Text>{'|' + widths.map(width => '-'.repeat(width + 2)).join('|') + '|'}</Text>
    {table.rows.map((row, index) => line(row, `${key}-row-${index}`, false))}
  </Box>;
}

// 块级 token；depth 是列表嵌套层数，offset 是外层前缀已占用的列数，base 是外层（如引用）传下来的行内样式。
// 源项目把列表标记宽度定为 `depth * 4 - 3`，即每层缩进 4 列；这里用 offset 抵消父级标记已占的列。
function renderBlocks(tokens: Token[], keyPrefix: string, depth: number, base: Inline = {}, offset = 0): ReactNode[] {
  const out: ReactNode[] = [];
  // marked 用 space token 表示空行；块与块之间统一补一行空白，对应源项目的 needs_newline/push_blank_line。
  const blocks = tokens.filter(token => token.type !== 'space');
  blocks.forEach((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (index > 0 && depth === 0) out.push(<Text key={`${key}-gap`}> </Text>);
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading;
        const style = {...base, ...headingStyle(heading.depth)};
        out.push(<Text key={key} {...style}>{'#'.repeat(heading.depth)} {renderInline(heading.tokens, style, key)}</Text>);
        break;
      }
      case 'paragraph': out.push(<Text key={key} {...base}>{renderInline((token as Tokens.Paragraph).tokens, base, key)}</Text>); break;
      case 'text': out.push(<Text key={key} {...base}>{renderInline((token as Tokens.Text).tokens ?? [token], base, key)}</Text>); break;
      case 'code': {
        const code = token as Tokens.Code;
        // 源项目对围栏代码块做语法高亮；这里统一用代码色并保留原始缩进。
        out.push(<Box key={key} flexDirection="column">
          {code.lang && <Text dimColor>```{code.lang}</Text>}
          {code.text.split('\n').map((line, lineIndex) => <Text key={lineIndex} {...styles.code}>{line || ' '}</Text>)}
          {code.lang && <Text dimColor>```</Text>}
        </Box>);
        break;
      }
      case 'blockquote': {
        const quote = token as Tokens.Blockquote;
        out.push(<Box key={key} flexDirection="row">
          <Text {...styles.blockquote}>{'> '}</Text>
          <Box flexDirection="column">{renderBlocks(quote.tokens, key, depth, {...base, ...styles.blockquote}, offset + 2)}</Box>
        </Box>);
        break;
      }
      case 'list': {
        const list = token as Tokens.List;
        const start = typeof list.start === 'number' ? list.start : 1;
        const indent = ' '.repeat(Math.max(0, depth * 4 - offset));
        list.items.forEach((item, itemIndex) => {
          const itemKey = `${key}-item-${itemIndex}`;
          const markerText = list.ordered ? `${start + itemIndex}. ` : '- ';
          const marker = list.ordered
            ? <Text {...styles.orderedListMarker}>{markerText}</Text>
            : <Text>{markerText}</Text>;
          const checkbox = item.task ? (item.checked ? '[x] ' : '[ ] ') : '';
          out.push(<Box key={itemKey} flexDirection="row">
            <Text>{indent}</Text>{marker}
            <Box flexDirection="column">
              {checkbox && <Text>{checkbox}</Text>}
              {renderBlocks(item.tokens, itemKey, depth + 1, base, offset + indent.length + markerText.length)}
            </Box>
          </Box>);
        });
        break;
      }
      case 'hr': out.push(<Text key={key}>———</Text>); break;
      case 'table': out.push(renderTable(token as Tokens.Table, key)); break;
      case 'html': out.push(<Text key={key} dimColor>{(token as Tokens.HTML).raw.trimEnd()}</Text>); break;
      default: out.push(<Text key={key} {...base}>{'raw' in token ? String(token.raw).trimEnd() : ''}</Text>);
    }
  });
  return out;
}

// 对应源项目 render_markdown_text：输入完整 Markdown，输出可直接放进 Ink 树的节点。
// 源项目按 history cell 缓存渲染结果；这里用 memo/useMemo 保证只有文本变化时才重新解析，
// 否则每次按键都会让所有助手消息重新走一遍 lexer。
export const MarkdownText = memo(function MarkdownText({text}: {text: string}) {
  const blocks = useMemo(() => renderBlocks(marked.lexer(text, {gfm: true}), 'md', 0), [text]);
  return <Box flexDirection="column">{blocks}</Box>;
});
