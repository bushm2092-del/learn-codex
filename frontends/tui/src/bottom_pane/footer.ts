import chalk from 'chalk';
import {activityIndicator} from '../motion.js';
import {summaryShimmer} from '../summary_shimmer.js';
import {fit} from '../terminal.js';

export const shortcuts = [
  'Keyboard shortcuts', '',
  'Compose',
  '  /                 Commands',
  '  enter             Send message',
  '  tab               Send / queue message',
  '  shift+enter       New line (alt+enter / ctrl+j)',
  '  ↑ / ↓             Recall local history',
  '  ctrl+r            Search local history',
  '  ctrl+a / ctrl+e   Start / end of line',
  '  ctrl+u / ctrl+k   Kill to start / end of line',
  '  ctrl+w / ctrl+y   Kill word / yank',
  '  alt+↑             Edit latest queued message',
  '', 'Session',
  '  ctrl+t            Open / close transcript',
  '  pgup / pgdn       Scroll transcript',
  '  ctrl+c            Clear draft / quit when idle',
  '  ctrl+d            Quit with an empty composer',
  '', 'Not supported by this backend',
  '  Interrupt / steer, resume, approvals, file mentions,',
  '  image input, reasoning effort, token usage, persistent history.',
  '', 'esc to dismiss',
];

export function elapsed(startedAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
export function workingLine(startedAt: number, now: number, width: number, reduced: boolean) {
  const elapsedMs = Math.max(0, now - startedAt);
  // 先裁剪普通后缀再加样式；不能用 fit 清洗整行，否则动画颜色会被剥掉。
  return activityIndicator(elapsedMs, reduced) + ' ' + summaryShimmer('Working', elapsedMs, reduced)
    + chalk.dim(fit(` (${elapsed(startedAt, now)} · interrupt unavailable)`, Math.max(1, width - 9)));
}
