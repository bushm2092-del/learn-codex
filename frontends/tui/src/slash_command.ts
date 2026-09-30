// 保持 upstream slash_command.rs 的顺序、描述与已支持命令语义。
export const commands = [
  {name: 'model', description: 'choose what model to use', busy: true},
  {name: 'new', description: 'start a new chat during a conversation', busy: false},
  {name: 'status', description: 'show current session configuration', busy: true},
  {name: 'pwd', description: 'show the current working directory', busy: true},
  {name: 'quit', description: 'exit mini-codex', busy: true},
  {name: 'exit', description: 'exit mini-codex', busy: true},
  {name: 'clear', description: 'clear the terminal and start a new chat', busy: false},
] as const;

export const unsupported: Record<string, string> = {
  resume: '会话持久化与恢复', fork: '会话分叉', archive: '会话归档', delete: '持久化会话删除',
  permissions: 'sandbox 与审批', compact: '上下文压缩', review: '独立 review 模式',
  mention: '文件搜索与引用', plan: 'Plan 模式', agents: '多代理', subagents: '多代理',
  mcp: 'MCP 配置', apps: 'Apps', plugins: '插件', skills: '技能选择器',
  login: '官方登录（项目仅使用 env_key）', logout: '官方登录（项目仅使用 env_key）',
  ps: '后台终端列表协议', stop: '停止后台终端协议', diff: '工作区 diff 协议',
  copy: '剪贴板选择器', export: '导出对话', keymap: '自定义快捷键', vim: 'Vim 输入模式',
  cd: '会话工作目录更新', usage: '账号用量', theme: '主题选择器',
};

export function matchingCommands(text: string) {
  if (!/^\/[^\s]*$/.test(text)) return [];
  const query = text.slice(1).toLowerCase();
  return commands.filter(command => {
    let at = 0;
    for (const char of command.name) if (char === query[at]) at++;
    return at === query.length;
  });
}
