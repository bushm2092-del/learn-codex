import {Box, Text} from 'ink';

// 仿照 Claude Code 欢迎页的小尺寸像素图标：12x8 像素、4 行文本，手工绘制而不是从图片采样。
// 云朵按行从粉紫过渡到深蓝（颜色取自应用图标的渐变），内部叠加亮色 “>_” 字形。
const gradient = ['#c9b9ff', '#b8a4ff', '#9a92ff', '#8088ff', '#6f86ff', '#5f7aff', '#4a5aff', '#3a3aff'];
const glyph = '#f7f8ff';
const shape = [
  '...######...',
  '.##########.',
  '############',
  '###W########',
  '####W#######',
  '###W##WWWW##',
  '.##########.',
  '...######...',
];
const pixels = shape.map((line, row) => Array.from(line, cell => cell === '#' ? gradient[row] : cell === 'W' ? glyph : null));

// 上下半格分别着色，一行文本承载两行像素，无需终端图片协议。
export function CodexIcon() {
  return <Box flexDirection="column" alignItems="center">
    {Array.from({length: pixels.length / 2}, (_, row) => <Text key={row}>
      {pixels[row * 2].map((top, column) => {
        const bottom = pixels[row * 2 + 1][column];
        if (top && bottom) return <Text key={column} color={top} backgroundColor={bottom}>▀</Text>;
        if (top) return <Text key={column} color={top}>▀</Text>;
        if (bottom) return <Text key={column} color={bottom}>▄</Text>;
        return <Text key={column}> </Text>;
      })}
    </Text>)}
  </Box>;
}
