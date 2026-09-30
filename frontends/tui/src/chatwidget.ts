// 对照 tui/src/chatwidget 的会话展示状态、事件处理与 input_queue；不承担 agent loop。
import type {Config, Item, Model, Notification, Session, Thread} from './app_server_session.js';

export interface Cell {
  id: string;
  kind: 'user' | 'assistant' | 'tool' | 'info' | 'error';
  text: string;
  output?: string;
  status?: string;
}
export interface ChatState {
  phase: 'starting' | 'ready' | 'disconnected';
  thread?: Thread;
  config?: Config;
  models: Model[];
  cells: Cell[];
  busy: boolean;
  changingThread: boolean;
  changingModel: boolean;
  turnId?: string;
  startedAt?: number;
  queued: string[];
  notice?: string;
}

export class ChatWidget {
  private state: ChatState = {phase: 'starting', models: [], cells: [], busy: false, changingThread: false, changingModel: false, queued: []};
  private listeners = new Set<() => void>();
  private disposers: (() => void)[] = [];
  private serial = 0;
  private completed = new Set<string>();
  private exitPending = false;
  private suppressQueueAutosend = false;
  constructor(readonly session: Session, readonly cwd: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ChatState>) {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }
  notice(text?: string) { this.update({notice: text}); }
  waitForExit() { this.exitPending = true; }
  add(kind: Cell['kind'], text: string) {
    this.update({cells: [...this.state.cells, {id: `local-${++this.serial}`, kind, text}]});
  }
  async initialize() {
    this.disposers.push(this.session.subscribe(event => this.event(event)));
    this.disposers.push(this.session.onDisconnect(error => {
      this.update({phase: 'disconnected', busy: false, notice: error.message});
    }));
    try {
      await this.session.initialize();
      const [config, models] = await Promise.all([this.session.config(), this.session.models()]);
      this.update({config, models});
      await this.newThread(false);
      if (this.state.phase !== 'disconnected') this.update({phase: 'ready'});
    } catch (error) {
      this.update({phase: 'disconnected', notice: (error as Error).message});
    }
  }
  async newThread(_clear: boolean) {
    if (this.state.busy || this.state.changingThread || this.state.changingModel) return false;
    this.update({changingThread: true});
    try {
      const thread = await this.session.startThread(this.cwd);
      // thread/start 当前没有 model 参数；保持所选模型跨 /new 生效。
      if (this.state.config?.model) await this.session.setModel(thread.id, this.state.config.model);
      this.completed.clear();
      this.suppressQueueAutosend = false;
      // fullscreen transcript 在 /new 和 /clear 时都重置；不把旧 thread 的消息混入新 transcript。
      this.update({thread, turnId: undefined, queued: [], cells: [], notice: undefined});
      return true;
    } finally { this.update({changingThread: false}); }
  }
  async refreshModels() { this.update({models: await this.session.models()}); }
  async selectModel(model: string) {
    if (!this.state.thread || this.state.changingModel || this.state.changingThread) return;
    this.update({changingModel: true});
    try {
      await this.session.setModel(this.state.thread.id, model);
      this.update({config: {...this.state.config!, model}});
      try { await this.session.saveModel(model); }
      catch { this.notice('模型已用于当前会话，但保存默认模型失败；检查配置目录写入权限。'); }
    } finally {
      this.update({changingModel: false});
      this.maybeSubmitNextQueuedInput();
    }
  }
  async submit(text: string, queue = false): Promise<boolean> {
    if (!text.trim() || !this.state.thread || this.state.phase !== 'ready' || this.state.changingThread || this.state.changingModel) return false;
    if (this.state.busy) {
      if (queue) { this.update({queued: [...this.state.queued, text]}); return true; }
      this.notice('尚未支持运行中追加指令（turn/steer）；按 Tab 排队，或等待当前回合结束。');
      return false;
    }
    this.update({busy: true, startedAt: Date.now(), turnId: undefined, notice: undefined});
    this.suppressQueueAutosend = false;
    const id = `local-${++this.serial}`;
    this.update({cells: [...this.state.cells, {id, kind: 'user', text}]});
    try {
      // 事件可紧随 response 同批到达；turnId 与完成状态只由事件更新，避免复活已完成 turn。
      await this.session.startTurn(this.state.thread.id, text);
      return true;
    } catch (error) {
      this.update({busy: false, cells: this.state.cells.filter(cell => cell.id !== id), notice: (error as Error).message});
      return false;
    }
  }
  takeQueued(): string | undefined {
    const text = this.state.queued.at(-1);
    if (text !== undefined) this.update({queued: this.state.queued.slice(0, -1)});
    return text;
  }
  // 对照 chatwidget/input_restore.rs：配置更新未完成时保留队列，恢复可提交状态后再取队首。
  private maybeSubmitNextQueuedInput() {
    if (this.exitPending || this.suppressQueueAutosend || this.state.busy || this.state.changingModel || this.state.changingThread || this.state.phase !== 'ready') return;
    const next = this.state.queued[0];
    if (next === undefined) return;
    this.update({queued: this.state.queued.slice(1)});
    void this.submit(next).then(ok => {
      if (!ok) {
        this.suppressQueueAutosend = true;
        this.update({queued: [next, ...this.state.queued]});
      }
    });
  }
  private item(item: Item, turnId: string, completed: boolean) {
    const id = `${this.state.thread!.id}/${turnId}/${item.id}`;
    const existing = this.state.cells.find(cell => cell.id === id);
    const cell: Cell = item.type === 'agentMessage'
      ? {id, kind: 'assistant', text: item.text ?? existing?.text ?? ''}
      : {id, kind: 'tool', text: item.command ?? existing?.text ?? '', output: item.aggregatedOutput ?? existing?.output ?? '', status: item.status ?? (completed ? 'completed' : 'inProgress')};
    this.update({cells: existing ? this.state.cells.map(value => value.id === id ? cell : value) : [...this.state.cells, cell]});
  }
  private event(event: Notification) {
    const p = event.params;
    if (!this.state.thread || p.threadId !== this.state.thread.id) return;
    if (event.method === 'thread/settings/applied' && p.settings) {
      this.update({config: {...this.state.config!, model: p.settings.model}}); return;
    }
    const turnId = p.turn?.id ?? p.turnId;
    if (!turnId || this.completed.has(turnId)) return;
    if (event.method === 'turn/started') {
      this.update({turnId, busy: true}); return;
    }
    if (turnId !== this.state.turnId) return;
    if ((event.method === 'item/started' || event.method === 'item/completed') && p.item) {
      this.item(p.item, turnId, event.method === 'item/completed');
    } else if (event.method === 'item/agentMessage/delta' && p.itemId) {
      const id = `${this.state.thread.id}/${turnId}/${p.itemId}`;
      const existing = this.state.cells.find(cell => cell.id === id);
      const cell: Cell = {id, kind: 'assistant', text: (existing?.text ?? '') + (p.delta ?? '')};
      this.update({cells: existing ? this.state.cells.map(value => value.id === id ? cell : value) : [...this.state.cells, cell]});
    } else if (event.method === 'turn/completed') {
      this.completed.add(turnId);
      this.update({busy: false});
      if (p.turn?.status === 'failed') {
        this.suppressQueueAutosend = true;
        this.add('error', p.turn.error?.message ?? '回合失败。');
        // 失败时保留排队内容供用户编辑，避免自动重试同一错误。
        if (this.state.queued.length) this.notice('回合失败，排队消息已保留。按 Alt+↑ 取回编辑。');
      } else {
        this.maybeSubmitNextQueuedInput();
      }
    }
  }
  async close() {
    for (const dispose of this.disposers) dispose();
    await this.session.close();
  }
}
