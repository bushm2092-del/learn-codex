# mini-codex Ink TUI

Node.js 22+、pnpm 11+。助手回复按 Markdown 渲染（`src/markdown_render.tsx`）。把 `DEEPSEEK_API_KEY=...` 写入 `~/.mini-codex/.env`，然后在仓库根目录执行 `make tui`；输入 `/model` 可切换模型并写回 `~/.mini-codex/config.toml`。

```bash
cargo build --manifest-path ../mini-codex-rs/Cargo.toml -p mini-codex-app-server
pnpm install
pnpm dev /absolute/path/to/project
```

`pnpm build && pnpm start /absolute/path/to/project` 运行编译后的 JavaScript。
`pnpm check && pnpm test` 验证类型、界面及真实 Rust 子进程通信；测试前必须构建 Rust 服务。

- `src/index.tsx`：终端入口和进程退出。
- `src/client.ts`：启动 Rust 子进程、JSONL 请求关联、连接失败和关闭。
- `src/protocol.ts`：服务端协议子集的 TS 类型。
- `src/app.tsx`：输入、流式文本、工具结果和状态。

TUI 是独立教学实现，使用 [Ink](https://github.com/vadimdemedes/ink) 与
[ink-text-input](https://github.com/vadimdemedes/ink-text-input)。
详见[架构与协议说明](../mini-codex-docs/docs/tutorial/06-app-server-ink.md)。

## TUI 外观与离线演示

Ink 界面采用顶部双栏欢迎区、中央对话视窗和底部固定输入栏。欢迎区使用用户提供的圆形蓝紫色 Codex 应用图标，以半格字符绘制。边框和标题使用
与图标一致的浅蓝紫 → 紫罗兰 → 亮蓝渐变，保留等待动画、回合耗时、消息分层和工具输出折叠。
对话视窗跟随最新消息，超出终端高度的旧内容会被裁切；完整上下文仍由 core 保留。
窄终端会切换为紧凑布局。`Tab` 展开或收起工具输出；`/clear` 只清除界面记录，
不会重置模型上下文；`/exit` 和 `Ctrl+C` 退出。

在 `mini-codex-tui/` 中运行 `pnpm demo`，无需 API Key 即可预览模拟工具和流式回复。
演示模式明确标注为 DEMO，不连接模型、不执行 shell；真实使用仍运行 `make tui`（仓库根目录）。
设置 `MINI_CODEX_REDUCED_MOTION=1` 可关闭装饰动画。没有密钥时，真实模式会显示配置提示，
不会自动切换到演示模式。

- `src/chrome.tsx`：终端宽度、标题、欢迎面板与状态动画。
- `src/demo.ts`：显式离线演示客户端，复用真实界面。
