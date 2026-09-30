import {EventEmitter} from 'node:events';
import type {Config, Model, Notification, Session} from '../src/app_server_session.js';

export const models: Model[] = [
  {id: 'flash', model: 'deepseek-flash', displayName: 'DeepSeek Flash', description: 'Fast model', isDefault: true, hidden: false},
  {id: 'pro', model: 'deepseek-v4-pro', displayName: 'DeepSeek Pro', description: 'Reasoning model', isDefault: false, hidden: false},
];
export class FakeSession implements Session {
  events = new EventEmitter();
  configValue: Config = {model: models[0]!.model, modelProvider: 'deepseek'};
  threads = 0;
  turns: {threadId: string; text: string}[] = [];
  settings: string[] = [];
  saved: string[] = [];
  failTurn = false;
  failSave = false;
  closeCount = 0;
  async initialize() {}
  async config() { return this.configValue; }
  async models() { return models; }
  async startThread(cwd: string) { return {id: `thread-${++this.threads}`, cwd, ephemeral: true}; }
  async startTurn(threadId: string, text: string) {
    if (this.failTurn) throw new Error('rejected');
    this.turns.push({threadId, text});
    const id = `turn-${this.turns.length}`;
    this.emit('turn/started', {threadId, turn: {id, status: 'inProgress'}});
    return id;
  }
  async setModel(threadId: string, model: string) {
    this.settings.push(model);
    this.emit('thread/settings/applied', {threadId, settings: {model}});
  }
  async saveModel(model: string) { if (this.failSave) throw new Error('not writable'); this.saved.push(model); }
  emit(method: string, params: Notification['params']) { this.events.emit('notification', {method, params}); }
  finish(text = 'Hello', status = 'completed') {
    const threadId = this.turns.at(-1)!.threadId;
    const turnId = `turn-${this.turns.length}`;
    this.emit('item/completed', {threadId, turnId, item: {id: 'msg', type: 'agentMessage', text}});
    this.emit('turn/completed', {threadId, turn: {id: turnId, status, error: status === 'failed' ? {message: '失败'} : null}});
  }
  subscribe(listener: (event: Notification) => void) { this.events.on('notification', listener); return () => { this.events.off('notification', listener); }; }
  onDisconnect(listener: (error: Error) => void) { this.events.on('disconnect', listener); return () => { this.events.off('disconnect', listener); }; }
  async close() { this.closeCount++; }
}
export const tick = () => new Promise<void>(resolve => setTimeout(resolve, 30));
export async function until(predicate: () => boolean, timeout = 3000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > end) throw new Error('Timed out waiting for observable state');
    await tick();
  }
}
