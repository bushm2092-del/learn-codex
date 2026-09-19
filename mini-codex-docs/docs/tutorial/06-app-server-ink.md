# 6. App-server 与 Ink TUI

Ink 界面是 TypeScript + React 项目，放在顶层 `mini-codex-tui/`，不属于 Rust workspace。
Rust app-server 负责通信与会话生命周期；模型请求、上下文和工具循环继续复用 core。

```text
mini-codex-tui/src/index.tsx
  -> AppServerClient 启动 Rust 子进程
  -> JSONL / stdin、stdout
  -> app-server/src/message_processor.rs
  -> request_processors/{thread_lifecycle,turn_processor}.rs
  -> ThreadManager -> CodexThread -> Session -> run_turn
  -> core Event -> app-server 通知 -> Ink React 状态 -> 终端
```

## 源路径与教学取舍

以下路径均相对于真实 Codex 的 `codex-rs/` 和本项目的 `mini-codex-rs/`：

| 源文件 | 教学文件 |
| --- | --- |
| `app-server/src/{main,lib,message_processor,outgoing_message,transport}.rs` | `crates/app-server/src/` 下同名文件 |
| `app-server/src/request_processors/{mod,thread_lifecycle,turn_processor}.rs` | `crates/app-server/src/request_processors/` 下同名文件 |
| `app-server-protocol/src/{lib,rpc}.rs` | `crates/app-server-protocol/src/` 下同名文件 |
| `app-server-protocol/src/protocol/{mod,v1}.rs` | `crates/app-server-protocol/src/protocol/` 下同名文件 |
| `app-server-protocol/src/protocol/v2/{mod,thread,turn}.rs` | `crates/app-server-protocol/src/protocol/v2/` 下同名文件 |
| `app-server/tests/suite/v2/turn_start.rs` | `crates/app-server/tests/suite/v2/turn_start.rs` |

真实源码的 `app-server/src/transport.rs` 委托给独立的 `app-server-transport` crate。
本项目仅实现单个 stdio 连接，将 `app-server-transport/src/transport/stdio.rs` 中对应的
逐行收发职责简化为 app-server 的 `lib.rs` 读循环与 `transport.rs` 写循环，不移植网络传输 crate。
这是为了教学而保留的明确偏离。

源项目 `codex-rs/tui/` 是 Rust TUI。本项目按需求另写 `mini-codex-tui/src/`，使用 Ink，
不是源项目 TUI 的逐文件移植。客户端 TS 协议声明也是手写的最小子集，未提供 schema 生成器。

## 为什么有两个 protocol

- `protocol`：core 内部的 `Op`、`Submission`、`Event`，供同进程调用。
- `app-server-protocol`：外部进程的请求 ID、初始化、thread 和 turn 参数。

外部不直接序列化内部枚举。服务端适配层将内部事件转换成 Codex 风格的通知。
新增请求字段需要同时修改 Rust 请求类型、TS 客户端和测试。

## 连接时序

一行一个 JSON 对象，不发送 `jsonrpc` 字段：

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"mini-codex-tui","version":"0.1.0"}}}
{"method":"initialized"}
{"id":2,"method":"thread/start","params":{"cwd":"/your/project"}}
{"id":3,"method":"turn/start","params":{"threadId":"thread-1","input":[{"type":"text","text":"解释项目结构"}]}}
```

实际客户端必须等待 initialize 和 thread/start 响应后再发送依赖它们的消息。
`turn/start` 立即返回 turn ID，然后推送 `turn/started`、`item/started`、
`item/agentMessage/delta`、`item/completed`、`turn/completed`。
模型或工具循环报错时发送状态为 `failed` 的 `turn/completed`，界面恢复输入。

当前支持文本输入、exec_command 工具，以及 `model/list`、`config/read`、`config/value/write`、
`thread/settings/update` 四个模型相关请求。工具事件映射成 `commandExecution`，
`exitCode` 保留为 null，因为 core 当前只提供成功标志和格式化输出，不伪造退出码。
返回的 thread/turn 对象是精简字段子集；`turn.items` 暂为空，客户端用实时 item 通知维护展示，
因此不能作为完整 Codex app-server 的替代实现。未知请求与未支持的参数返回错误。

## 启动

需要 Rust、Node.js 22+ 和 pnpm 11+。在仓库根目录运行：

```bash
cargo build --manifest-path mini-codex-rs/Cargo.toml -p mini-codex-app-server
pnpm --dir mini-codex-tui install
printf 'DEEPSEEK_API_KEY=你的密钥\n' > ~/.mini-codex/.env
pnpm --dir mini-codex-tui dev /absolute/path/to/project
```

也可以 `make tui`：默认工作目录为仓库根目录。

构建后运行：

```bash
pnpm --dir mini-codex-tui build
node mini-codex-tui/dist/index.js /absolute/path/to/project
```

Ink 默认启动 workspace 的 debug 二进制；设置 `MINI_CODEX_APP_SERVER` 可以指定其他二进制的绝对路径。
服务也可单独启动：`cargo run --manifest-path mini-codex-rs/Cargo.toml -p mini-codex-cli -- app-server`。

服务与 CLI 共用同一条 `Config` 装配链：模型和 provider 来自 `~/.mini-codex/config.toml`，
密钥来自 provider `env_key` 指向的环境变量（见[第七节](./07-config)）。
只加载 `~/.mini-codex/.env`（不读当前目录的 `.env`），也不会在界面中打印密钥或原始服务 stderr。Ink 启动后调用 `config/read`
在头部显示当前模型，`/model` 的切换流程见[第八节](./08-model-selection)。

## Markdown 渲染

助手消息经 `mini-codex-tui/src/markdown_render.tsx` 渲染，对应源项目 `tui/src/markdown_render.rs`。
源项目用 pulldown-cmark 的事件流驱动行构造器，本项目改用 marked 的 token 树，但样式约定照搬：
标题保留 `#` 前缀并按层级加粗/斜体/下划线，`- ` 与 `1. ` 列表标记、每层缩进 4 列，`> ` 绿色引用，
`———` 分隔线，行内代码与链接为青色，表格按显示宽度（CJK 占两格）对齐。

未移植：代码块语法高亮（源项目用 syntect）、`markdown_stream.rs` 的按行提交（本项目每次 delta
重新渲染整段文本，未闭合的代码围栏由 marked 容错处理）、文件引用/本地链接改写、数学与 mermaid。
测试在 `mini-codex-tui/test/markdown_render.test.tsx`。

## 生命周期与边界

同一 thread 一次只接受一个活动 turn，不同 thread 独立运行。响应和事件通过有界队列顺序写入
stdout；stderr 与协议分离。退出时客户端关闭 stdin，服务等待当前回合后退出；Ink 最多等待约两秒，
随后终止服务进程。此行为不是 turn cancellation，也不保证终止已经启动的 shell 子孙进程。
没有 sandbox、审批、会话持久化、恢复、WebSocket 或 MCP。

子进程使用 `spawn` 的独立参数启动，禁用 shell 拼接；thread 工作目录必须存在且为目录。
工具仍使用 core 原有的 shell 执行机制，模型给出的命令会直接执行，只在可信目录和输入下使用。
TUI 支持中文输入、连续对话、流式回复、工具结果、失败状态与 Ctrl+C 退出。
显示最近 40 条记录，每条最多末尾 12000 字符；这只是展示限制，不会截断 core 上下文。

## 验证

```bash
make test
```

Rust 测试用假模型验证 JSONL 握手、工具回传、事件顺序、失败恢复与 EOF 收尾。
TUI 测试验证输入和渲染；进程集成测试真正启动 Rust 二进制，连接本地假 Responses SSE 服务，
执行无副作用的 `printf`，无需真实 API Key 或外网模型调用。

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
