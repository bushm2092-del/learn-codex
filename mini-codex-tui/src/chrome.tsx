import {useEffect, useState} from 'react';
import {Box, Text, useStdout} from 'ink';
import {CodexIcon} from './codex-icon.js';

// 配色取自应用图标：顶部粉紫 -> 中部薰衣草 -> 底部深蓝，与 CodexIcon 的采样渐变保持一致。
export const palette = {lavender: '#BCA6FF', violet: '#8A8CFF', blue: '#5C73FF', error: '#3A36FF'};
const spectrum = ['#C6B8FF', '#BCA6FF', '#A897FF', '#8A8CFF', '#7390FF', '#5C73FF', '#4650FF', '#3226FF'];

export function Gradient({text}: {text: string}) {
  const characters = Array.from(text);
  return <Text>{characters.map((character, index) => <Text key={index} color={spectrum[Math.min(spectrum.length - 1, Math.floor(index * spectrum.length / characters.length))]}>{character}</Text>)}</Text>;
}
const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// 动画只更新装饰组件，避免定时重绘整段对话；退出和切换状态时清理定时器。
function useFrame(enabled: boolean, interval: number, limit = Number.POSITIVE_INFINITY) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!enabled || process.env.MINI_CODEX_REDUCED_MOTION === '1' || process.env.TERM === 'dumb') return;
    const timer = setInterval(() => setFrame(frame => {
      if (frame >= limit) { clearInterval(timer); return frame; }
      return frame + 1;
    }), interval);
    return () => clearInterval(timer);
  }, [enabled, interval, limit]);
  return frame;
}

export function useTerminalSize() {
  const {stdout} = useStdout();
  const [size, setSize] = useState({width: stdout.columns || 80, height: stdout.rows || 30});
  useEffect(() => {
    const resize = () => setSize({width: stdout.columns || 80, height: stdout.rows || 30});
    stdout.on('resize', resize);
    return () => { stdout.off('resize', resize); };
  }, [stdout]);
  return size;
}

export function Header({cwd, compact, demo, width, model: currentModel}: {cwd: string; compact: boolean; demo: boolean; width: number; model: string}) {
  const title = ' Mini Codex v0.1.0 ';
  // 模型名来自 app-server 的 config/read 与 thread/settings/applied；连接前显示占位。
  const model = demo ? 'DEMO · 离线演示' : currentModel ? `模型：${currentModel}` : '模型：连接中…';
  return <Box flexDirection="column" flexShrink={0}>
    <Text><Text color={palette.lavender}>╭─</Text><Gradient text={title} /><Gradient text={'─'.repeat(Math.max(0, width - title.length - 3)) + '╮'} /></Text>
    <Box borderStyle="single" borderTop={false} borderBottom={false} borderLeftColor={palette.lavender} borderRightColor={palette.blue} flexDirection={compact ? 'column' : 'row'}>
      <Box width={compact ? '100%' : '32%'} flexDirection="column" alignItems="center" paddingX={1} flexShrink={0}>
        <Text bold>欢迎回来！</Text>
        {!compact && <Box marginY={1} flexDirection="column" alignItems="center">
          <CodexIcon />
        </Box>}
        <Text color={palette.violet} wrap="truncate">{model}</Text>
        <Text dimColor wrap="truncate-middle">{cwd}</Text>
      </Box>
      {!compact && <Box flexGrow={1} flexBasis={0} borderStyle="single" borderTop={false} borderRight={false} borderBottom={false} borderLeftColor={palette.violet} paddingX={1} flexDirection="column">
        <Text bold color={palette.lavender}>开始使用</Text>
        <Text wrap="truncate">输入一个问题，或让我们一起探索代码。</Text>
        <Text dimColor wrap="truncate">例如：解释这个项目的结构</Text>
        <Text color={palette.violet}>{'─'.repeat(Math.max(0, Math.floor((width - 2) * .68) - 4))}</Text>
        <Text bold color={palette.violet}>工作台提示</Text>
        <Text wrap="truncate">Tab 展开工具输出 · /model 选模型 · /clear 清除界面</Text>
        <Text wrap="truncate">{demo ? '离线演示：模拟回复，不执行命令。' : '流式回复与工具进度会显示在下方。'}</Text>
        <Text dimColor wrap="truncate">/exit 退出 · Ctrl+C 随时关闭</Text>
      </Box>}
    </Box>
    <Gradient text={'╰' + '─'.repeat(Math.max(0, width - 2)) + '╯'} />
  </Box>;
}

export function Activity({busy, connecting, failed, status, turns}: {busy: boolean; connecting: boolean; failed: boolean; status: string; turns: number}) {
  const frame = useFrame(busy || connecting, 90);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const color = failed ? palette.error : busy || connecting ? palette.lavender : palette.blue;
  return <Box justifyContent="space-between">
    <Text color={color}>{busy || connecting ? spinner[frame % spinner.length] : failed ? '○' : '●'} {status}{busy ? ` · ${seconds}s` : ''}
      {busy && <Text color={palette.violet}> {'▁▂▃▄▅▆▅▄▃▂'.slice(frame % 6, frame % 6 + 4)}</Text>}
    </Text>
    <Text dimColor>{turns.toString().padStart(2, '0')} 回合</Text>
  </Box>;
}
