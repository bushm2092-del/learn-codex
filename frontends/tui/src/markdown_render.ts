// 对照 tui/src/markdown_render.rs；marked 替代 pulldown-cmark，ANSI 样式仅由本地生成。
import {marked, type Token, type Tokens} from 'marked';
import chalk from 'chalk';
import {safeText, wrap} from './terminal.js';

function inline(tokens: Token[]): string {
  return tokens.map(token => {
    const children = 'tokens' in token && token.tokens ? inline(token.tokens) : ('text' in token ? String(token.text) : token.raw);
    switch (token.type) {
      case 'strong': return chalk.bold(children);
      case 'em': return chalk.italic(children);
      case 'codespan': return chalk.cyan(children);
      case 'del': return chalk.strikethrough(children);
      case 'link': return chalk.underline(children) + (token.href === children ? '' : chalk.dim(` (${safeText(token.href)})`));
      case 'image': return `[${token.text}] (${safeText(token.href)})`;
      case 'br': return '\n';
      default: return children;
    }
  }).join('');
}

function block(tokens: Token[]): string {
  return tokens.map(token => {
    switch (token.type) {
      case 'heading': return chalk.bold(inline((token as Tokens.Heading).tokens)) + '\n';
      case 'paragraph': return inline((token as Tokens.Paragraph).tokens) + '\n';
      case 'code': return String(token.text).split('\n').map(line => '  ' + chalk.cyan(line)).join('\n') + '\n';
      case 'blockquote': return block((token as Tokens.Blockquote).tokens).trimEnd().split('\n').map(line => chalk.dim('│ ') + line).join('\n') + '\n';
      case 'list': return (token as Tokens.List).items.map((item, index) => {
        const prefix = token.ordered ? `${Number(token.start) + index}. ` : '• ';
        return prefix + (item.task ? (item.checked ? '[x] ' : '[ ] ') : '') + block(item.tokens).trimEnd().replace(/\n/g, '\n  ');
      }).join('\n') + '\n';
      case 'table': {
        const table = token as Tokens.Table;
        return [table.header.map(cell => chalk.bold(inline(cell.tokens))).join(' │ '), ...table.rows.map(row => row.map(cell => inline(cell.tokens)).join(' │ '))].join('\n') + '\n';
      }
      case 'hr': return chalk.dim('────────') + '\n';
      case 'space': return '\n';
      default: return ('tokens' in token && token.tokens ? inline(token.tokens) : ('text' in token ? String(token.text) : token.raw));
    }
  }).join('');
}
export function markdownLines(text: string, width: number): string[] {
  return wrap(block(marked.lexer(safeText(text))).trimEnd(), width);
}
