// 对应 codex-rs/tui/src/slash_command.rs：内建斜杠命令的枚举与说明。
// 源项目还有 /new、/resume、/compact、/review 等；本项目只保留已支持的三个。
export type SlashCommand = 'model' | 'clear' | 'exit';

export const SLASH_COMMANDS: {command: SlashCommand; description: string}[] = [
  {command: 'model', description: '选择后续回合使用的模型'},
  {command: 'clear', description: '清除界面记录，不重置模型上下文'},
  {command: 'exit', description: '退出 mini-codex'},
];

// 只识别精确匹配的命令，其他以 / 开头的输入原样发给模型。
export function parseSlashCommand(input: string): SlashCommand | null {
  const text = input.trim();
  if (!text.startsWith('/')) return null;
  const command = SLASH_COMMANDS.find(entry => `/${entry.command}` === text);
  return command?.command ?? null;
}
