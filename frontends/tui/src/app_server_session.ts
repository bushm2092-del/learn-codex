// 对照 codex-rs/tui/src/app_server_session.rs：UI 只通过此门面操作会话。
// stdio 子进程替代 upstream app-server-client；不通过 shell 拼接命令。
import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {createInterface} from 'node:readline';

export interface Model {
  id: string;
  model: string;
  displayName: string;
  description: string;
  hidden: boolean;
  isDefault: boolean;
}
export interface Config {model: string | null; modelProvider: string}
export interface Thread {id: string; cwd: string; ephemeral: boolean}
export interface Item {
  id: string;
  type: 'agentMessage' | 'commandExecution';
  text?: string;
  command?: string;
  status?: string;
  aggregatedOutput?: string | null;
  exitCode?: number | null;
}
export interface Notification {
  method: string;
  params: {
    threadId?: string;
    turnId?: string;
    itemId?: string;
    delta?: string;
    item?: Item;
    turn?: {id: string; status: string; error?: {message: string} | null};
    settings?: {model: string};
  };
}
export interface Session {
  initialize(): Promise<void>;
  config(): Promise<Config>;
  models(): Promise<Model[]>;
  startThread(cwd: string): Promise<Thread>;
  startTurn(threadId: string, text: string): Promise<string>;
  setModel(threadId: string, model: string): Promise<void>;
  saveModel(model: string): Promise<void>;
  subscribe(listener: (event: Notification) => void): () => void;
  onDisconnect(listener: (error: Error) => void): () => void;
  close(): Promise<void>;
}

export class AppServerSession implements Session {
  private child: ChildProcessWithoutNullStreams;
  private events = new EventEmitter();
  private nextId = 1;
  private failure?: Error;
  private closing = false;
  private closed: Promise<void>;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(command: string, args: string[], cwd: string, private options: {timeoutMs?: number; env?: NodeJS.ProcessEnv} = {}) {
    this.child = spawn(command, args, {cwd, stdio: 'pipe', shell: false, env: options.env ?? process.env});
    this.closed = new Promise(resolve => this.child.once('close', () => resolve()));
    this.child.once('error', () => this.fail(new Error('无法启动 app-server。请先在仓库根目录运行 make app-server-build。')));
    this.child.once('close', code => {
      this.fail(new Error(`app-server 已退出（${code ?? 'signal'}）。检查 config.toml 与 provider 的 env_key 环境变量。`));
    });
    // stderr 可能包含 provider 返回内容，不直接回显，以免错误正文泄露凭据。
    this.child.stderr.resume();
    this.child.stdin.on('error', () => this.fail(new Error('app-server 输入连接已关闭。')));
    const lines = createInterface({input: this.child.stdout});
    lines.on('line', line => {
      let message: {id?: number; result?: unknown; error?: {code: number; message: string}; method?: string; params?: Notification['params']};
      try { message = JSON.parse(line); }
      catch { this.fail(new Error('app-server 返回了无效 JSONL。')); return; }
      if (!message || typeof message !== 'object') {
        this.fail(new Error('app-server 返回了无效协议消息。')); return;
      }
      if (typeof message.id === 'number') {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      } else if (typeof message.method === 'string' && message.params) {
        this.events.emit('notification', message as Notification);
      }
    });
  }

  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    for (const {reject, timer} of this.pending.values()) { clearTimeout(timer); reject(error); }
    this.pending.clear();
    if (!this.closing) this.events.emit('disconnect', error);
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    if (this.failure || this.closing) return Promise.reject(this.failure ?? new Error('会话正在关闭。'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // 超时后不能猜测 turn/start 是否已经执行，关闭连接状态，禁止重复提交。
        this.fail(new Error(`${method} 请求超时。连接状态未知，请退出后重新启动。`));
      }, this.options.timeoutMs ?? 15_000);
      this.pending.set(id, {resolve: value => resolve(value as T), reject, timer});
      this.child.stdin.write(`${JSON.stringify({id, method, params})}\n`);
    });
  }

  async initialize() {
    await this.request('initialize', {clientInfo: {name: 'mini-codex-tui', version: '0.1.0', title: 'mini-codex'}});
    this.child.stdin.write(`${JSON.stringify({method: 'initialized'})}\n`);
  }
  async config() { return (await this.request<{config: Config}>('config/read', {})).config; }
  async models() {
    const models: Model[] = [];
    let cursor: string | null = null;
    do {
      const page: {data: Model[]; nextCursor: string | null} = await this.request('model/list', {cursor});
      models.push(...page.data.filter(model => !model.hidden));
      cursor = page.nextCursor;
    } while (cursor);
    return models;
  }
  async startThread(cwd: string) {
    return (await this.request<{thread: Thread}>('thread/start', {cwd})).thread;
  }
  async startTurn(threadId: string, text: string) {
    return (await this.request<{turn: {id: string}}>('turn/start', {threadId, input: [{type: 'text', text}]})).turn.id;
  }
  async setModel(threadId: string, model: string) {
    await this.request('thread/settings/update', {threadId, model});
  }
  async saveModel(model: string) {
    await this.request('config/value/write', {keyPath: 'model', value: model, mergeStrategy: 'replace'});
  }
  subscribe(listener: (event: Notification) => void) {
    this.events.on('notification', listener);
    return () => { this.events.off('notification', listener); };
  }
  onDisconnect(listener: (error: Error) => void) {
    this.events.on('disconnect', listener);
    if (this.failure) listener(this.failure);
    return () => { this.events.off('disconnect', listener); };
  }
  async close() {
    if (this.closing) return this.closed;
    this.closing = true;
    this.child.stdin.end();
    // 正常 UI 仅在 turn 收尾后退出；以下限时回收只用于异常关闭服务本身。
    const terminate = setTimeout(() => this.child.kill('SIGTERM'), 2000);
    const kill = setTimeout(() => this.child.kill('SIGKILL'), 4000);
    try { await this.closed; }
    finally { clearTimeout(terminate); clearTimeout(kill); this.events.removeAllListeners(); }
  }
}
