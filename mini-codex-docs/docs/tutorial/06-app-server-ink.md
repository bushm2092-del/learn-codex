# 第六章：用 Ink + React 连接 Rust app-server

本章对应 `frontends/tui/`，不是旧文档中的 `mini-codex-tui/`。用户指定使用 Ink + React，并确认本阶段只对齐现有内核支持的交互，缺失能力明确标注。

## 边界与调用链

```text
frontends/tui/src/main.tsx
  -> App / ChatWidget
  -> AppServerSession（stdio JSONL，不使用 shell 拼接命令）
  -> mini-codex-rs/crates/app-server/src/message_processor.rs
  -> request_processors/{thread_lifecycle,turn_processor,catalog_processor,config_processor}.rs
  -> ThreadManager -> CodexThread -> submission loop -> turn -> model / tools
```

前端维护输入、菜单、可见消息与本地排队列表，不维护模型上下文，不实现工具执行。真正的上下文和历史仍由 core 维护；transcript 是前端展示记录，不等于可恢复的 rollout。

## 启动握手

1. `spawn(binary, [], {cwd, shell: false})` 启动 Rust 服务。可执行路径和工作目录分别传递，目录中的空格不需要 shell 转义。
2. 发送 `initialize`，参数为 `clientInfo: {name, version, title}`；收到响应后发送 `initialized` 通知。
3. 调用 `config/read`、`model/list` 获取真实配置与模型列表。
4. 调用 `thread/start`，传入绝对工作目录。现有协议没有 `thread/start.model`，因此随后通过 `thread/settings/update` 应用选中的模型。

`AppServerSession` 用请求 id 关联响应，独立转发 notification。协议超时后不能知道 `turn/start` 是否已执行，因此标记连接不可用，不自动重试。服务 stderr 不直接显示，以免远端错误含密钥。

## 一个回合

```text
Enter
  -> turn/start {threadId, input: [{type: "text", text}]}
  -> response {turn: {id, ...}}
  -> turn/started
  -> item/started
  -> item/agentMessage/delta（零或多次）
  -> item/completed
  -> turn/completed
```

工具结果沿用 `commandExecution` item，分别由 `item/started` 与 `item/completed` 更新；当前服务尚未提供工具输出逐块通知。
前端以 thread/turn/item 组成消息键；delta 追加、completed 用最终值替换，不重复追加完整答案。
response 与通知可能在同一批 stdout 数据中到达，不能在 `await turn/start` 返回后把已经完成的回合重新标记为运行中。完成事件和旧 thread 的迟到事件被过滤。

运行中按 Tab 把输入排到前端 FIFO，正常完成后发送下一条。失败时保留队列，让用户通过 Alt+↑ 取回。运行中 Enter 对应源项目的 steer 能力，当前后端没有 `turn/steer`，所以保留草稿并提示，不冒充已经追加成功。

## 命令语义

- `/model`：`model/list` → `thread/settings/update` → `config/value/write`。当前会话修改成功但持久化失败时分别提示，不假装全部成功。
- `/new`、`/clear`：都创建新 thread 并重置当前 transcript，后续请求不会包含旧会话上下文。前端使用全屏模式，两者重置后的显示相同；不提供会话命名参数。
- `/status`：展示实际模型、provider、目录、临时 thread id；token usage 明确为不可用。
- `/pwd`：显示服务确认的工作目录。
- `/exit`、`/quit`：空闲时关闭服务 stdin，等待服务正常退出；运行时等待当前回合结束，不继续自动发送队列。

空闲空草稿 Ctrl+C 直接退出，依据当前源码关闭的双按退出开关；有草稿时先清空并保存到本进程输入历史。Esc/Ctrl+C 运行时不会假装取消，界面明确说明 `turn/interrupt` 未支持。

## UI 与源码偏离

源 TUI 位于 `codex-rs/tui/src/`，本地对照 HEAD 为 `53446f90a5`。对应的 `app`、`app_server_session`、`chatwidget`、`bottom_pane`、`history_cell` 与 `markdown_render` 职责保留，React/Ink 和 TypeScript 文件扩展名是用户授权的偏离。
完整的逐文件映射及尚未移植的 UI 分支见 [TUI README](../../../frontends/tui/README.md)。

布局还对照用户提供的 Codex v0.158.0 截图：会话框采用 `history_cell/session.rs` 的最长内容宽度，内部最多 56 列；`bottom_pane/chat_composer.ts` 给输入内容上下各留一行，整块填充 `#41464b`。光标行坐标包含新增留白，状态栏紧邻输入区。`style.ts` 对照源样式边界，暂未移植 OSC 11 调色板探测，因此输入底色固定为截图色；主背景继承终端，不伪造用量或重连消息。

聊天记录区域支持鼠标滚轮，每次三行；阅读历史时保持位置，滚到底部恢复跟随。键盘上下键仍负责编辑和输入历史。

Working 状态对照 `motion`、`shimmer` 与 `summary_shimmer` 源模块呈现扫光动画，与输入区留一行空隙；`MINI_CODEX_REDUCED_MOTION=1` 可关闭动画。

文本编辑使用 grapheme 索引，避免删除半个 emoji；光标按终端列宽定位，中文输入法可以跟随真实光标。折行和 Markdown 使用 JavaScript 库，不承诺与 Ratatui 每一个字形或断行一致。长粘贴不折叠为占位符，不实现未移植的 paste-burst 分支。完整 transcript 可用 Ctrl+T 查看，尚无鼠标选择、搜索与 clipboard UI。

工具仍由现有 Rust core 直接执行 shell，没有 sandbox、审批或可靠取消保障。UI 没有新增这些安全能力。服务启动失败时显示配置提示，不切换 demo。

## 运行与验证

仓库根目录执行 `make tui`。默认 provider 使用 `DEEPSEEK_API_KEY`，配置和 `.env` 从 `$MINI_CODEX_HOME`（默认 `~/.mini-codex`）读取，不读取项目目录 `.env`。

`make tui-test` 构建服务并执行 TypeScript 检查、构建和测试。离线集成测试启动真实 Rust app-server、本地 Responses SSE fixture 与临时配置目录，覆盖工具调用、stream delta、模型保存、全新上下文、失败恢复以及连接超时，避免依赖真实 API Key。

当前仓库仅恢复了本章 Markdown，`mini-codex-docs/` 尚无 `package.json` 或 VitePress 构建配置，因此本章不能单独运行 `pnpm docs:build`；前端验证使用 `make tui-test`。
