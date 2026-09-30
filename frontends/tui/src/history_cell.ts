import chalk from 'chalk';
import stringWidth from 'string-width';
import {homedir} from 'node:os';
import type {Cell} from './chatwidget.js';
import {fit, safeText, wrap} from './terminal.js';
import {markdownLines} from './markdown_render.js';
import {accent} from './style.js';

export function displayPath(cwd: string) {
  const home = homedir();
  return cwd === home ? '~' : cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd;
}
export function sessionHeader(model: string, cwd: string, columns: number): string[] {
  // session.rs::card_inner_width / with_border：先截断，再按最长内容决定边框宽度。
  const innerWidth = Math.max(1, Math.min(columns - 4, 56));
  const content = [chalk.dim('>_ ') + chalk.bold('mini-codex') + chalk.dim(' (v0.1.0)'), '', `${chalk.dim('model:     ')}${safeText(model).replace(/\n/g, ' ')}   ${accent('/model')}${chalk.dim(' to change')}`, `${chalk.dim('directory: ')}${safeText(displayPath(cwd)).replace(/\n/g, ' ')}`]
    .map(line => stringWidth(line) <= innerWidth ? line : fit(line, innerWidth));
  const width = Math.max(...content.map(line => stringWidth(line))) + 4;
  return [chalk.dim('╭' + '─'.repeat(width - 2) + '╮'), ...content.map(line => {
    const value = stringWidth(line) <= width - 4 ? line : fit(line, width - 4);
    return chalk.dim('│ ') + value + ' '.repeat(Math.max(0, width - 4 - stringWidth(value))) + chalk.dim(' │');
  }), chalk.dim('╰' + '─'.repeat(width - 2) + '╯')];
}
export function cellLines(cell: Cell, width: number, expanded = false): string[] {
  const available = Math.max(1, width - 2);
  let lines: string[];
  if (cell.kind === 'assistant') {
    lines = markdownLines(cell.text, available);
    return lines.map((line, i) => (i === 0 ? '• ' : '  ') + line).concat('');
  }
  if (cell.kind === 'tool') {
    const verb = cell.status === 'inProgress' ? 'Running' : 'Ran';
    lines = wrap(`${verb} ${safeText(cell.text)}`, available).map((line, i) => (i === 0 ? '• ' : '  ') + line);
    if (cell.output) {
      const output = wrap(safeText(cell.output), Math.max(1, width - 4));
      const visible = expanded || output.length <= 6 ? output : [...output.slice(0, 3), chalk.dim(fit(`… +${output.length - 6} lines (ctrl+t to view)`, width - 4)), ...output.slice(-3)];
      lines.push(...visible.map((line, i) => (i === 0 ? '  └ ' : '    ') + line));
    }
    if (cell.status === 'failed') lines.push(chalk.red('  └ Command failed'));
    return lines.concat('');
  }
  const text = safeText(cell.text);
  lines = wrap(text, available).map((line, i) => (i === 0 ? (cell.kind === 'user' ? '› ' : '• ') : '  ') + line);
  if (cell.kind === 'user') lines = lines.map(line => chalk.bold(line));
  if (cell.kind === 'info') lines = lines.map(line => chalk.dim(line));
  if (cell.kind === 'error') lines = lines.map(line => chalk.red(line));
  return lines.concat('');
}
