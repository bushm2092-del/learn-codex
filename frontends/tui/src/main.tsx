import {render} from 'ink';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
import {App} from './app.js';
import {AppServerSession} from './app_server_session.js';
import {ChatWidget} from './chatwidget.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('mini-codex TUI\n\nUsage: pnpm dev [working-directory]\n\nMINI_CODEX_APP_SERVER  已构建的 app-server 可执行文件路径（不是 shell 命令）\nMINI_CODEX_HOME        Rust 配置目录\n\n构建与启动：在仓库根目录运行 make tui');
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('mini-codex TUI 需要交互式终端；请直接在终端运行 make tui。');
  process.exitCode = 1;
} else {
  const cwd = resolve(args[0] ?? process.cwd());
  try {
    if (args.length > 1) throw new Error('只接受一个工作目录参数。运行 pnpm dev --help 查看用法。');
    if (!(await stat(cwd)).isDirectory()) throw new Error('工作目录必须是目录。');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const binary = process.env.MINI_CODEX_APP_SERVER
      ? resolve(process.env.MINI_CODEX_APP_SERVER)
      : resolve(root, 'mini-codex-rs/target/debug', process.platform === 'win32' ? 'mini-codex-app-server.exe' : 'mini-codex-app-server');
    const session = new AppServerSession(binary, [], cwd);
    const chat = new ChatWidget(session, cwd);
    const instance = render(<App chat={chat}/>, {exitOnCtrlC: false, alternateScreen: true, incrementalRendering: true});
    const shutdown = () => { void chat.close().finally(() => instance.unmount()); };
    process.once('SIGTERM', shutdown);
    process.once('SIGHUP', shutdown);
    try { await instance.waitUntilExit(); }
    finally {
      process.removeListener('SIGTERM', shutdown);
      process.removeListener('SIGHUP', shutdown);
      await chat.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
