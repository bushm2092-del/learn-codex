// 对照 tui/src/summary_shimmer.rs：两秒扫过一次，按完整 grapheme 计算亮度。
// 未移植 OSC 调色板探测，沿用用户截图的深色前景/背景（见 README）。
import chalk from 'chalk';
import stringWidth from 'string-width';

export function summaryShimmer(text: string, elapsedMs: number, reduced: boolean) {
  if (reduced) return text;
  if (chalk.level < 3) return chalk.dim(text);
  const width = stringWidth(text);
  const halfWidth = Math.max(width * 0.1, 3);
  const position = (elapsedMs % 2000) / 2000 * (width + 2 * halfWidth) - halfWidth;
  let column = 0;
  return Array.from(new Intl.Segmenter().segment(text), ({segment}) => {
    const glyphWidth = stringWidth(segment);
    const center = column + glyphWidth / 2;
    column += glyphWidth;
    const distance = Math.min(Math.abs(center - position) / halfWidth, 1);
    const intensity = 0.5 * (1 + Math.cos(Math.PI * distance));
    const alpha = 0.5 + 0.5 * intensity;
    const rgb = [40, 44, 51].map(bg => Math.floor(241 * alpha + bg * (1 - alpha)));
    return chalk.rgb(rgb[0]!, rgb[1]!, rgb[2]!)(segment);
  }).join('');
}
