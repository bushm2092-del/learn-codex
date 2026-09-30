// 对照 tui/src/style.rs 的 user_message_style / accent_color。
// 当前 Ink 未移植 OSC 11 调色板探测，输入区使用用户提供截图的深色底色。
import chalk from 'chalk';
import stringWidth from 'string-width';

export const accent = chalk.hex('#63a8f8');
export const muted = chalk.hex('#999b9e');
export function composerRow(text: string, width: number) {
  return chalk.bgHex('#41464b').hex('#f1f1f1')(text + ' '.repeat(Math.max(0, width - stringWidth(text))));
}
