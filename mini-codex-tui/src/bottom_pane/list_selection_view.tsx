// 对应 codex-rs/tui/src/bottom_pane/list_selection_view.rs：底部弹出的单选列表。
// 源项目支持搜索、开关、快捷键与次级动作；本项目只保留 ↑↓ 移动、Enter 选择、Esc 关闭。
import {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {palette} from '../chrome.js';

export type SelectionItem = {
  name: string;
  description?: string;
  isCurrent: boolean;
  isDefault: boolean;
};

export function ListSelectionView({title, subtitle, items, onSelect, onCancel}: {
  title: string;
  subtitle?: string;
  items: SelectionItem[];
  onSelect: (index: number) => void;
  onCancel: () => void;
}) {
  // 初始高亮当前项，与源项目 `initial_selected_idx` 的取法一致。
  const initial = Math.max(0, items.findIndex(item => item.isCurrent));
  const [selected, setSelected] = useState(initial);
  useInput((_input, key) => {
    if (key.escape) onCancel();
    else if (key.upArrow) setSelected(index => (index - 1 + items.length) % items.length);
    else if (key.downArrow) setSelected(index => (index + 1) % items.length);
    else if (key.return && items.length > 0) onSelect(selected);
  });
  return <Box flexDirection="column" borderStyle="round" borderColor={palette.violet} paddingX={1}>
    <Text bold color={palette.lavender}>{title}</Text>
    {subtitle && <Text dimColor>{subtitle}</Text>}
    {items.length === 0 && <Text dimColor>没有可选项</Text>}
    {items.map((item, index) => {
      const marker = item.isCurrent ? '（当前）' : item.isDefault ? '（默认）' : '';
      const active = index === selected;
      return <Box key={item.name} flexDirection="column">
        <Text color={active ? palette.blue : undefined} bold={active}>{active ? '› ' : '  '}{index + 1}. {item.name}{marker}</Text>
        {item.description && <Text dimColor>     {item.description}</Text>}
      </Box>;
    })}
    <Text dimColor>↑↓ 移动 · Enter 选择 · Esc 取消</Text>
  </Box>;
}
