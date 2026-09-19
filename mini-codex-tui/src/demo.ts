import type {Client, Notification} from './protocol.js';

// 显式离线演示：复用真实界面和协议，不启动 Rust、网络请求或 shell。
export class DemoClient implements Client {
  private listeners = new Set<(event: Notification) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private turn = 0;
  private model = 'deepseek-flash';
  async request<T>(method: string, params?: unknown): Promise<T> {
    if (method === 'thread/start') return {thread: {id: 'demo'}} as T;
    if (method === 'config/read') return {config: {model: this.model, modelProvider: 'deepseek'}} as T;
    if (method === 'model/list') return {data: [
      {id: 'deepseek-flash', model: 'deepseek-flash', displayName: 'DeepSeek V4.1 Flash', description: '演示：默认模型', hidden: false, isDefault: true},
      {id: 'deepseek-v4-pro', model: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', description: '演示：旗舰模型', hidden: false, isDefault: false},
    ], nextCursor: null} as T;
    if (method === 'thread/settings/update') { this.model = (params as {model: string}).model; return {} as T; }
    // 演示模式不触碰磁盘上的 config.toml。
    if (method === 'config/value/write') return {status: 'ok', version: 'demo', filePath: '(demo)'} as T;
    if (method !== 'turn/start') return {} as T;
    const id = `demo-${++this.turn}`;
    const scope = {threadId: 'demo', turnId: id};
    const later = (delay: number, event: Notification) => {
      const timer = setTimeout(() => {this.timers.delete(timer); for (const listener of this.listeners) listener(event);}, delay);
      this.timers.add(timer);
    };
    later(80, {method: 'turn/started', params: {...scope, turn: {id, status: 'inProgress', error: null}}});
    const item = {type: 'commandExecution' as const, id: `${id}-tool`, command: '项目结构预览（模拟）', status: 'inProgress', aggregatedOutput: null};
    later(450, {method: 'item/started', params: {...scope, item}});
    later(1650, {method: 'item/completed', params: {...scope, item: {...item, status: 'completed', aggregatedOutput: 'mini-codex/\n├── mini-codex-tui/     React + Ink\n├── mini-codex-rs/      Rust agent\n│   └── crates/\n│       ├── app-server/\n│       └── core/\n└── mini-codex-docs/    学习手册'}}});
    const message = '## 这是离线演示\n\n界面负责**输入与展示**，Rust 内核负责会话和工具执行。你正在看到的是：\n\n- 流式回复（按 Markdown 渲染）\n- 动态状态\n- 可折叠的工具记录\n\n> 准备好后，把密钥写入 `~/.mini-codex/.env` 并运行 `make tui`，即可开始真实对话。';
    const characters = Array.from(message);
    characters.forEach((delta, index) => later(1900 + index * 28, {method: 'item/agentMessage/delta', params: {...scope, itemId: `${id}-message`, delta}}));
    later(1950 + characters.length * 28, {method: 'item/completed', params: {...scope, item: {type: 'agentMessage', id: `${id}-message`, text: message}}});
    later(2050 + characters.length * 28, {method: 'turn/completed', params: {...scope, turn: {id, status: 'completed', error: null}}});
    return {turn: {id, status: 'inProgress', error: null}} as T;
  }
  notify() {}
  subscribe(listener: (event: Notification) => void) {this.listeners.add(listener); return () => {this.listeners.delete(listener);};}
  onFailure() {return () => {};}
  async close() {for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); this.listeners.clear();}
}
