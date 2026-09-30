import chalk from 'chalk';
import type {Model} from '../app_server_session.js';
import {fit, safeText, wrap} from '../terminal.js';

export function modelPickerLines(models: Model[], selected: number, current: string, width: number, height: number): string[] {
  const lines = ['  ' + chalk.bold('Select Model'), chalk.dim(fit('  Reasoning effort: not supported', width)), ''];
  const count = Math.max(1, Math.floor((height - 5) / 3));
  const start = Math.max(0, selected - count + 1);
  models.slice(start, start + count).forEach((model, i) => {
    const index = start + i;
    const active = index === selected;
    const label = `${index + 1}. ${model.displayName}${model.model === current ? ' (current)' : ''}`;
    lines.push((active ? chalk.cyan('› ') : '  ') + (active ? chalk.cyan(fit(label, width - 2)) : fit(label, width - 2)));
    lines.push(...wrap(safeText(model.description), Math.max(1, width - 5)).slice(0, 1).map(line => '     ' + chalk.dim(line)), '');
  });
  if (!models.length) lines.push(chalk.dim('  No models available'));
  lines.push(chalk.dim(fit(width < 55 ? '  ↑/↓ move · enter select · esc back' : '  ↑/↓ to move · enter to select · esc to dismiss', width)));
  return lines;
}
