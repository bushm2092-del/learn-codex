import {realpathSync, statSync} from 'node:fs';
import {render} from 'ink';
import {App} from './app.js';
import {AppServerClient} from './client.js';
import {DemoClient} from './demo.js';

if (!process.stdin.isTTY) {
  console.error('请在交互式终端中运行 mini-codex-tui');
  process.exitCode = 1;
} else {
  const args = process.argv.slice(2);
  const demo = args.includes('--demo');
  const cwd = realpathSync(args.find(arg => arg !== '--demo') ?? process.cwd());
  if (!statSync(cwd).isDirectory()) throw new Error('工作目录必须是一个目录');
  const client = demo ? new DemoClient() : new AppServerClient(cwd);
  const ui = render(<App client={client} cwd={cwd} demo={demo} onExit={() => ui.unmount()} />, {exitOnCtrlC: false});
  const stop = () => ui.unmount();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try { await ui.waitUntilExit(); }
  finally {
    await client.close();
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  }
}
