import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import type {Client, Notification} from './protocol.js';

export class AppServerClient implements Client {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, {resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout}>();
  private listeners = new Set<(event: Notification) => void>();
  private failures = new Set<(error: Error) => void>();
  private failure?: Error;
  private closing = false;
  private closed: Promise<void>;

  constructor(cwd: string, launch?: {command: string; args: string[]}) {
    const binary = process.env.MINI_CODEX_APP_SERVER ?? fileURLToPath(new URL(`../../mini-codex-rs/target/debug/mini-codex-app-server${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
    // 路径、参数分开传递，不通过 shell 拼接命令。工作目录由用户明确选择。
    this.child = spawn(launch?.command ?? binary, launch?.args ?? [], {cwd, stdio: 'pipe', shell: false});
    const lines = createInterface({input: this.child.stdout});
    lines.on('line', line => {
      try {
        const message = JSON.parse(line);
        if (typeof message.id === 'number') {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        } else if (typeof message.method === 'string' && message.params) {
          for (const listener of this.listeners) listener(message as Notification);
        } else throw new Error('Invalid message');
      } catch {
        this.fail(new Error('服务端返回了无效的协议消息'));
        this.child.kill();
      }
    });
    // 排空 stderr，避免子进程阻塞；不向界面转发可能包含敏感信息的原始日志。
    this.child.stderr.resume();
    this.child.stdin.on('error', () => this.fail(new Error('无法向服务端发送消息')));
    this.child.on('error', () => this.fail(new Error('无法启动 app-server，请先构建 Rust 服务并检查可执行文件路径')));
    this.closed = new Promise(resolve => this.child.once('close', () => {
      lines.close();
      this.fail(new Error('app-server 已退出，请检查密钥环境变量与服务配置'));
      resolve();
    }));
  }

  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    if (!this.closing) for (const listener of this.failures) listener(error);
  }

  request<T>(method: string, params: unknown): Promise<T> {
    if (this.failure || this.closing) return Promise.reject(this.failure ?? new Error('服务正在关闭'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`请求超时：${method}`));
        this.fail(new Error('服务端请求超时，请重新启动'));
        this.child.kill();
      }, 15_000);
      this.pending.set(id, {resolve: value => resolve(value as T), reject, timer});
      this.child.stdin.write(JSON.stringify({id, method, params}) + '\n');
    });
  }
  notify(method: string) {
    if (!this.failure && !this.closing) this.child.stdin.write(JSON.stringify({method}) + '\n');
  }
  subscribe(listener: (event: Notification) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  onFailure(listener: (error: Error) => void) {
    this.failures.add(listener);
    if (this.failure) listener(this.failure);
    return () => { this.failures.delete(listener); };
  }
  async close() {
    if (this.closing) return this.closed;
    this.closing = true;
    this.child.stdin.end();
    const terminate = setTimeout(() => this.child.kill('SIGTERM'), 1000);
    const force = setTimeout(() => this.child.kill('SIGKILL'), 2000);
    await this.closed;
    clearTimeout(terminate);
    clearTimeout(force);
  }
}
