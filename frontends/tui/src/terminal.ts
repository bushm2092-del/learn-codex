import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import wrapAnsi from 'wrap-ansi';

// 对照 history_cell/messages.rs 的清洗边界，不把模型、工具或粘贴中的控制序列交给终端。
export function safeText(text: string): string {
  return stripAnsi(text).replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}
export function wrap(text: string, width: number): string[] {
  return wrapAnsi(text, Math.max(1, width), {hard: true, trim: false}).split('\n');
}
export function fit(text: string, width: number): string {
  const clean = safeText(text).replace(/[\n\t]/g, ' ');
  if (stringWidth(clean) <= width) return clean;
  let result = '';
  for (const {segment} of new Intl.Segmenter().segment(clean)) {
    if (stringWidth(result + segment) > width - 1) break;
    result += segment;
  }
  return result + '…';
}
