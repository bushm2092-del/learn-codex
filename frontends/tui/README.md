# mini-codex TUI

用户指定的 Ink + React 终端前端，代码位于 `frontends/tui/`。对照本地 Codex TUI 实现现有内核支持的交互子集；不声称已完整移植生产 Codex。Rust 内核仍是会话、模型请求与工具执行的唯一实现。

## 启动

需要 Node.js 22+、pnpm、Rust。仓库根目录：

```bash
make tui
```

这会构建 `mini-codex-app-server`、安装前端依赖，并以仓库根目录为工作目录启动终端界面。要选择其他目录：

```bash
make app-server-build tui-install
cd frontends/tui
pnpm dev /absolute/path/to/project
```

编译后可运行 `pnpm build`、`pnpm start /absolute/path/to/project`。`pnpm dev --help` 显示帮助。输入和输出必须是 TTY；不支持通过管道向交互前端提交消息。

配置与 Rust 入口相同：`$MINI_CODEX_HOME/config.toml`，默认目录 `~/.mini-codex`；API Key 由 provider 的 `env_key` 提供，内建 DeepSeek 使用 `DEEPSEEK_API_KEY`。Rust 只从配置目录加载 `.env`，不读取当前工作目录中的 `.env`。前端不读写密钥。没有密钥时显示错误，不自动切换到假模型。

如使用自定义构建目录，可设置 `MINI_CODEX_APP_SERVER` 为 app-server 可执行文件的完整路径；它不是 shell 命令，不支持附加命令参数。工作目录以 `spawn` 的 `cwd` 与 `thread/start.cwd` 传入，不拼接进 shell 命令。

## 交互

| 操作 | 行为 |
| --- | --- |
| Enter | 空闲时发送；运行中不支持 steer，保留草稿并提示使用 Tab |
| Shift+Enter / Alt+Enter / Ctrl+J | 换行；Shift+Enter 依赖终端增强键盘协议 |
| Tab | 空闲时发送；运行中加入 FIFO 队列；命令菜单打开时补全 |
| `/`、↑/↓、Enter、Esc | 搜索命令、选择、执行、关闭菜单 |
| `/model` | 选择模型，更新当前会话并保存默认模型；数字键也可选择 |
| `/new` / `/clear` | 创建新后端 thread，重置当前 transcript；不继承旧模型上下文 |
| `/status` / `/pwd`（`/cwd` 别名） | 查看实际会话配置、目录；不编造 token 用量 |
| `/quit` / `/exit` | 空闲时退出；运行中等待当前回合结束，不再自动发送队列 |
| Ctrl+C | 先关闭弹层/菜单；有草稿时清空并留在本地输入历史；空闲空草稿时退出 |
| Ctrl+D | 没有弹层且输入为空时退出；非空输入时向前删除 |
| ↑/↓ | 空输入或位于已回忆输入的边界时浏览本进程历史；其他时候移动光标 |
| Ctrl+R / Ctrl+S | 搜索本进程历史，向旧/新匹配移动；Enter 取回，不直接发送；Esc 取消 |
| Ctrl+A/E、Ctrl+B/F | 行首/行尾、左右移动 |
| Ctrl+U/K/W/Y | 删除至行首/行尾、删除前一个单词、恢复最近删除的文本 |
| Alt+B/F、Ctrl+←/→ | 按词移动 |
| Alt+↑ | 空草稿时取回最近一条排队消息 |
| 鼠标滚轮 | 聊天记录区域每次滚动三行，不改变输入；滚到底部恢复跟随；transcript/帮助也支持滚动 |
| Ctrl+T | 打开/关闭完整 transcript，包含工具完整输出 |
| PgUp/PgDn、↑/↓、Home/End | 在 transcript/帮助中滚动 |
| `?` | 空草稿时显示快捷键和未支持能力 |

正常聊天显示工具输出的头尾；超长内容用提示折叠，Ctrl+T 可查看前端收到的完整文本。core 本身已截断的工具内容不会在前端恢复。
使用终端原生文字颜色；选择态 cyan，错误 red。Working 使用 Codex 的两秒文字扫光和圆点明暗动画，下方空一行与输入区分隔；仅在工作期间以 20fps 刷新，空闲停止刷新。非真彩终端改为每 600ms 切换实心/空心圆点。设置 `MINI_CODEX_REDUCED_MOTION=1` 可关闭动画，耗时仍每秒更新。使用真实光标位置支持中文 IME，删除以 grapheme 为单位，不拆开 emoji 或组合音标。bracketed paste 中的换行不会触发发送。

Ink 启用 `incrementalRendering`，仅覆盖变化行，避免滚动时擦除并重画整块界面；未变化的输入框和状态栏不重复输出。终端支持时，Ink 自带的 synchronized output 将一帧更新统一呈现。

布局按用户提供的 Codex v0.158.0 截图校正：会话框按内容收窄（内部最多 56 列），灰色输入区铺满终端宽度，包含上下各一行留白，其下紧接模型/目录与快捷键。`src/style.ts` 对照 upstream `tui/src/style.rs`；Ink 尚未移植 OSC 11 背景探测，输入区暂用截图采样的 `#41464b`，不会随亮色终端自动调整。扫光使用截图深色调色板（背景 `#282c33`、前景 `#f1f1f1`）；动画时钟从当前回合开始，替代源实现的进程时钟。全屏背景继续继承终端。截图中的周用量、重连和警告计数没有对应数据时不显示。

## 范围与明确偏离

对照版本：`/Users/hfh/Desktop/github/codex`，HEAD `53446f90a5`（2026-09-30 检查的本地源码）。当前源码 `bottom_pane/mod.rs` 的 `DOUBLE_PRESS_QUIT_SHORTCUT_ENABLED = false`，所以不采用旧快照中的双按退出。

1. 按用户要求，Rust/Ratatui 改为 React/Ink，目录改为 `frontends/tui/`，文件扩展名使用 `.ts`/`.tsx`。不修改 Rust 核心逻辑。选择全屏 alternate-screen 布局，退出恢复原终端；尚未提供 Codex 的 inline/raw 模式切换。
2. 内核缺少 `turn/interrupt`、`turn/steer`、`thread/rollback`、持久化/恢复、sandbox/审批、文件搜索、图片输入、推理档位与 token usage。因此 Esc/Ctrl+C 在运行时仅显示未支持，不能停止工具；Esc 回退上次消息未支持。退出等待当前回合结束，可能需要等待模型/工具本身返回。异常关闭只限时回收 app-server，不宣称能可靠取消所有后台工具进程。
3. 用户明确接受的功能子集之外，尚未移植的 UI 包括自定义快捷键、Vim、外部编辑器、剪贴板选择器、transcript 搜索/鼠标选择、主题、语音、多代理等。`!` 直接 shell 模式明确拒绝；`@` 不做文件引用解析。命令菜单只列已支持命令，已知未支持命令给出原因，未知命令不会发送给模型。`/new`、`/clear` 的会话命名参数未支持。
4. 文本编辑、折行与 Markdown 使用 `Intl.Segmenter`、`string-width`、`wrap-ansi`、marked 替代 Rust 库；不保证每个 Unicode 标点的按词移动、每个终端的行折断或代码高亮像素一致。代码块以终端色区分，不含 upstream syntect 语法高亮。长粘贴原样保留，不提供 upstream 大粘贴占位符或 paste-burst 检测；推荐支持 bracketed paste 的终端。
5. 本地输入历史只在此进程内保存。没有虚构持久化 history/rollout；退出后不能恢复。聊天记录按当前 thread 保存于 UI 内存，超出屏幕部分可用滚轮或 transcript 查看。前端排队沿用 FIFO；因缺少取消/steer，失败后暂停自动发送，保留排队输入供取回。
6. stdio 请求/响应与子进程运输合在 `app_server_session.ts`，替代 upstream 独立 `app-server-client`；对外 JSON 字段沿用现有 app-server。连接失败和超时后禁用提交，避免自动重试产生重复执行。启动错误不直接回显服务 stderr，避免包含 provider 凭据。

当前 core 的 `exec_command` 仍直接执行本机 shell，没有新增 sandbox 或审批保证。

## 源码对照

以下源路径均相对于 `/Users/hfh/Desktop/github/codex/codex-rs/`，目标均相对于此目录。UI 是显式允许的 TypeScript 实现偏离，职责与命令语义按源模块对照；没有将其描述为核心算法移植。

| 源路径 | 目标路径 / 范围 |
| --- | --- |
| `tui/src/main.rs`、`tui/src/lib.rs` | `src/main.tsx`，Ink 挂载、TTY 与进程生命周期 |
| `tui/src/app.rs`、`tui/src/app/event_dispatch.rs` | `src/app.tsx`，快捷键、弹层、命令分发与终端布局 |
| `tui/src/app_server_session.rs`、`app-server-client/src/lib.rs` | `src/app_server_session.ts`，stdio RPC 门面；删除生产 transport/daemon 分支 |
| `tui/src/chatwidget.rs`、`chatwidget/input_flow.rs`、`chatwidget/input_restore.rs`、`chatwidget/interaction.rs` | `src/chatwidget.ts` 与 `src/app.tsx`，会话展示、队列和退出；UI 状态简化为 TypeScript 对象 |
| `tui/src/transcript_view/input.rs` | `src/app.tsx`，SGR 鼠标事件和每次三行的滚动；Ink 使用顶部行索引保留阅读位置，未移植源版 cell anchor、选择及拖动 |
| `tui/src/app/session_lifecycle.rs` | `src/chatwidget.ts::newThread`，新建 thread 后重置 transcript |
| `tui/src/bottom_pane/chat_composer.rs` | `src/bottom_pane/chat_composer.ts`，输入视图；Ink 键事件由 `app.tsx` 消费 |
| `tui/src/bottom_pane/textarea.rs` | `src/bottom_pane/textarea.ts`，纯文本编辑；不含 Vim/附件分支 |
| `tui/src/bottom_pane/chat_composer_history.rs` | `src/bottom_pane/chat_composer_history.ts`，local_history 分支；删除持久化查找 |
| `tui/src/bottom_pane/list_selection_view.rs` | `src/bottom_pane/list_selection_view.ts`，模型列表 |
| `tui/src/bottom_pane/footer.rs`、`tui/src/status_indicator_widget.rs` | `src/bottom_pane/footer.ts`，快捷键与工作耗时的 Ink 呈现 |
| `tui/src/motion.rs`、`tui/src/shimmer.rs`、`tui/src/summary_shimmer.rs` | `src/motion.ts`、`src/shimmer.ts`、`src/summary_shimmer.ts`，工作状态动画；固定深色调色板与环境变量替代源配置 |
| `tui/src/slash_command.rs` | `src/slash_command.ts`，顺序、名称与可用性子集 |
| `tui/src/history_cell.rs`、`tui/src/markdown_render.rs` | `src/history_cell.ts`、`src/markdown_render.ts`，消息和 Markdown |
| `tui/src/history_cell/messages.rs`、`tui/src/line_truncation.rs` | `src/terminal.ts`，Ink 共用的控制序列清洗与宽度适配，显式命名偏离 |

## 验证

仓库根目录运行 `make tui-test`，或先构建 Rust app-server，再在此目录执行：

```bash
pnpm check
pnpm build
pnpm test
```

测试包含滚轮不误触输入历史、阅读位置保持、鼠标模式退出清理、Unicode 编辑与 resize、历史边界、真实 Ink 键盘交互、粘贴不误发送、队列、事件去重、错误恢复、未支持命令和 Rust app-server 离线联调。联调只在临时目录执行 `printf tui-tool-ok`，以本地 HTTP SSE fixture 替代远端模型，配置写入临时目录。

本次另在 macOS PTY 检查了 100×30 与 40×16 窗口、命令菜单、模型选择、流式 Markdown、transcript，以及退出后的 alternate screen 和 bracketed paste 恢复。尚未实机验证 Windows、Linux 或所有终端的增强键盘协议。
