// 对照 tui/src/motion.rs：真彩圆点 shimmer，低色终端每 600ms 切换实心/空心。
import chalk from 'chalk';
import {shimmerSpans} from './shimmer.js';

export function activityIndicator(elapsedMs: number, reduced: boolean) {
  if (reduced) return chalk.dim('•');
  if (chalk.level >= 3) return shimmerSpans('•', elapsedMs);
  return Math.floor(elapsedMs / 600) % 2 === 0 ? '•' : chalk.dim('◦');
}
