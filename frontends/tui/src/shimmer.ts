// 对照 tui/src/shimmer.rs：状态圆点的明暗波形。
import chalk from 'chalk';

export function shimmerSpans(text: string, elapsedMs: number) {
  const chars = Array.from(text);
  const padding = 10;
  const position = Math.floor((elapsedMs % 2000) / 2000 * (chars.length + padding * 2));
  return chars.map((char, index) => {
    const distance = Math.abs(index + padding - position);
    const intensity = distance <= 5 ? 0.5 * (1 + Math.cos(Math.PI * distance / 5)) : 0;
    const alpha = intensity * 0.9;
    const rgb = [40, 44, 51].map(bg => Math.floor(bg * alpha + 241 * (1 - alpha)));
    return chalk.rgb(rgb[0]!, rgb[1]!, rgb[2]!).bold(char);
  }).join('');
}
