# mini-codex

[简体中文](#简体中文) · [English](#english) · [在线学习 Learn Codex](https://learn-codex.tech/)

## 简体中文

工具内核已移植 `Direct / Deferred / Hidden` 曝光策略与原生 `tool_search` 延迟发现子集：BM25 检索、namespace 规格回传、历史重放及后续调用都有离线闭环测试。DeepSeek 的原生搜索/namespace 能力尚未确认，默认入口保持直接工具、不启用搜索；这不是通过普通 function 模拟的兼容层。源码映射、边界与验证方式见[工具曝光与延迟发现](mini-codex-docs/docs/tutorial/08-tool-discovery.md)。

Context 章节与 Rust 子集实现见[第五课：Context](mini-codex-docs/docs/tutorial/05-context.md)：历史模块按上游迁入 `context_manager/{mod,history,normalize}.rs`，支持文本工具输出截断、调用结果整理、服务端 usage 加新增内容估算、token 粗估和可配置的本地摘要压缩、远程 V2 加密压缩及 TokenBudget 新窗口切换。本地摘要指令按用户要求采用中文。开启 `[features] token_budget = true` 时优先切换新窗口；否则压缩方式按上游 provider 能力选择，请求使用当前配置模型；默认未声明 DeepSeek 窗口，未配置阈值时不自动压缩。取消与 rollout 恢复尚未移植。

mini-codex 是对 Codex Rust 核心进行简化的教学项目。**核心源码在 [`mini-codex-rs/crates/`](mini-codex-rs/crates/)**；交互式教学站的前端源码在 [`frontends/teach/src/`](frontends/teach/src/)，业务后台在 [`backend/`](backend/)。
![Codex 与 mini-codex 的源码目录和文件 1:1 对照示意](docs/images/codex-source-comparison.png)
| 目录 | 主要职责 |
| --- | --- |
| [`mini-codex-rs/crates/protocol/`](mini-codex-rs/crates/protocol/) | 跨层传递的操作、事件和协议类型。 |
| [`mini-codex-rs/crates/tools/`](mini-codex-rs/crates/tools/) | 与源 `codex-rs/tools` 对齐的工具协议、执行契约和 Responses API 工具定义。 |
| [`mini-codex-rs/crates/core/`](mini-codex-rs/crates/core/) | 会话与 turn 循环、模型客户端、上下文和工具调度；主要执行逻辑在这里。 |
| [`mini-codex-rs/crates/config/`](mini-codex-rs/crates/config/) | 配置文件的读取与合并。 |
| [`mini-codex-rs/crates/features/`](mini-codex-rs/crates/features/) | 与源项目一致的集中式 feature gate；当前保留 Unified Exec 两项。 |
| [`mini-codex-rs/crates/shell-command/`](mini-codex-rs/crates/shell-command/) | 检测 macOS、Linux、Windows 的用户 shell，并处理 PowerShell 命令。 |
| [`mini-codex-rs/crates/utils/pty/`](mini-codex-rs/crates/utils/pty/) | PTY 平台适配边界与 Windows 终端输入归一化。 |
| [`mini-codex-rs/crates/model-provider-info/`](mini-codex-rs/crates/model-provider-info/) | 模型服务商信息。 |
| [`mini-codex-rs/crates/model-provider/`](mini-codex-rs/crates/model-provider/) | 工具搜索依赖的 provider 能力上限子集。 |
| [`mini-codex-rs/crates/models-manager/`](mini-codex-rs/crates/models-manager/) | 模型目录和模型选择。 |
| [`mini-codex-rs/crates/arg0/`](mini-codex-rs/crates/arg0/) | 启动时加载本地环境变量。 |
| [`mini-codex-rs/crates/utils/home-dir/`](mini-codex-rs/crates/utils/home-dir/) | 定位配置目录。 |
| [`mini-codex-rs/crates/cli/`](mini-codex-rs/crates/cli/) | 命令行入口。 |
| [`mini-codex-rs/crates/app-server/`](mini-codex-rs/crates/app-server/) | 服务入口和请求处理。 |
| [`mini-codex-rs/crates/app-server-protocol/`](mini-codex-rs/crates/app-server-protocol/) | 服务对外使用的协议类型。 |
| [`frontends/teach/src/`](frontends/teach/src/) | Learn Codex 课程页面、交互演示和通用界面。 |
| [`frontends/tui/`](frontends/tui/) | Ink + React 终端前端，通过 stdio JSONL 使用 Rust app-server。 |
| [`backend/`](backend/) | 教学站的账号、评论、学习进度和统计等业务 API；与 Rust 内核独立。 |
| [`deploy/`](deploy/) | 教学站的部署配置与脚本。 |

Rust 目录与上游 Codex 的对应关系是 `codex-rs/<crate>/` → `mini-codex-rs/crates/<crate>/`。要从主调用链开始阅读，可依次看 [`thread_manager.rs`](mini-codex-rs/crates/core/src/thread_manager.rs)、[`session/turn.rs`](mini-codex-rs/crates/core/src/session/turn.rs) 和 [`tools/router.rs`](mini-codex-rs/crates/core/src/tools/router.rs)。

`exec_command` 现在按源项目的 Unified Exec 路径工作：会话启动时检测默认 shell 并把 `cwd`/`shell` 放入模型可见的 `<environment_context>`；命令可以先等待后返回 `session_id`，再由 `write_stdin` 写入或轮询。完整调用链、跨平台规则和当前明确删减的生产分支见[教程：Unified Exec 与跨平台 shell](mini-codex-docs/docs/tutorial/07-unified-exec.md)。


### 终端界面（Ink + React）

需要 Node.js 22+、pnpm 和 Rust。配置 provider 的 `env_key`（默认 `DEEPSEEK_API_KEY`）后，在仓库根目录启动：

```bash
make tui
```

前端位于用户指定的 `frontends/tui/`，替代旧文档中的 `mini-codex-tui/`。对照本地 Codex TUI，实现全屏会话布局、流式 Markdown、工具结果、中文多行输入、`/` 补全、`/model`、`/new`、`/clear`、`/status`、`/pwd` 与退出。
按 `?` 查看快捷键，`Ctrl+T` 查看完整记录；`Tab` 在运行中排队。`/new` 和 `/clear` 都创建新的后端会话，`/clear` 不是仅清除显示。
布局按 Codex 参考截图校正为紧凑会话框、整宽灰色输入区及底部两行状态栏。

本次范围为现有内核支持的交互子集，不是完整 Codex TUI：取消/steer、审批/sandbox、恢复会话、文件引用、图片与 reasoning effort 等尚未支持，界面明确提示。当前 core 工具仍直接在指定目录执行 shell。
聊天记录区域支持鼠标滚轮，每次三行；阅读历史时保持位置，滚到底部恢复跟随。键盘上下键仍负责编辑和输入历史。

Working 状态对照 `motion`、`shimmer` 与 `summary_shimmer` 源模块呈现扫光动画，与输入区留一行空隙；`MINI_CODEX_REDUCED_MOTION=1` 可关闭动画。

运行 `make tui-test` 验证；配置、源码映射与明确偏离见 [TUI README](frontends/tui/README.md) 和[第六章](mini-codex-docs/docs/tutorial/06-app-server-ink.md)。

## English

mini-codex is a teaching project that simplifies the Codex Rust core. **The core source is in [`mini-codex-rs/crates/`](mini-codex-rs/crates/)**. The interactive learning site lives in [`frontends/teach/src/`](frontends/teach/src/), with its separate business API in [`backend/`](backend/).

| Directory | Purpose |
| --- | --- |
| [`mini-codex-rs/crates/protocol/`](mini-codex-rs/crates/protocol/) | Operations, events, and protocol types shared across layers. |
| [`mini-codex-rs/crates/tools/`](mini-codex-rs/crates/tools/) | Tool primitives, execution contracts, and Responses API tool definitions mapped from upstream `codex-rs/tools`. |
| [`mini-codex-rs/crates/core/`](mini-codex-rs/crates/core/) | Sessions, the turn loop, model client, context, and tool routing; the main execution logic. |
| [`mini-codex-rs/crates/config/`](mini-codex-rs/crates/config/) | Loading and merging configuration. |
| [`mini-codex-rs/crates/features/`](mini-codex-rs/crates/features/) | Central feature gates; currently the two Unified Exec flags. |
| [`mini-codex-rs/crates/shell-command/`](mini-codex-rs/crates/shell-command/) | User-shell discovery on macOS, Linux, and Windows, plus PowerShell handling. |
| [`mini-codex-rs/crates/utils/pty/`](mini-codex-rs/crates/utils/pty/) | The platform PTY boundary and Windows terminal-input normalization. |
| [`mini-codex-rs/crates/model-provider-info/`](mini-codex-rs/crates/model-provider-info/) | Model provider definitions. |
| [`mini-codex-rs/crates/models-manager/`](mini-codex-rs/crates/models-manager/) | Model catalog and selection. |
| [`mini-codex-rs/crates/arg0/`](mini-codex-rs/crates/arg0/) | Loading local environment variables at startup. |
| [`mini-codex-rs/crates/utils/home-dir/`](mini-codex-rs/crates/utils/home-dir/) | Finding the configuration directory. |
| [`mini-codex-rs/crates/cli/`](mini-codex-rs/crates/cli/) | Command-line entry point. |
| [`mini-codex-rs/crates/app-server/`](mini-codex-rs/crates/app-server/) | Service entry point and request handling. |
| [`mini-codex-rs/crates/app-server-protocol/`](mini-codex-rs/crates/app-server-protocol/) | External service protocol types. |
| [`frontends/teach/src/`](frontends/teach/src/) | Learn Codex lessons, interactive demonstrations, and shared UI. |
| [`frontends/tui/`](frontends/tui/) | Ink + React terminal client for the Rust app-server over stdio JSONL. |
| [`backend/`](backend/) | Site APIs for accounts, comments, learning progress, and statistics; separate from the Rust core. |
| [`deploy/`](deploy/) | Deployment configuration and scripts for the learning site. |

Rust directories map to upstream Codex as `codex-rs/<crate>/` → `mini-codex-rs/crates/<crate>/`. To follow the main execution path, start with [`thread_manager.rs`](mini-codex-rs/crates/core/src/thread_manager.rs), [`session/turn.rs`](mini-codex-rs/crates/core/src/session/turn.rs), and [`tools/router.rs`](mini-codex-rs/crates/core/src/tools/router.rs).

`exec_command` now follows the upstream Unified Exec lifecycle: the session detects its default shell, exposes `cwd` and `shell` through `<environment_context>`, yields long-running commands with a `session_id`, and resumes them through `write_stdin`. See the [Unified Exec tutorial](mini-codex-docs/docs/tutorial/07-unified-exec.md) for the call path and documented omissions.

教学站 Context 章节已按实际学习过程补齐 19 节双语文章，并提供六段可暂停、步进与重播的消息条带动画：对话追加、配对修复、usage 校准、本地摘要、Remote V2 与 TokenBudget。入口为 `/lessons/context`，正文对应 [Context 教程](mini-codex-docs/docs/tutorial/05-context.md)。

第四章与 Context 已统一为共享 Markdown 文章架构：`LessonPage` 负责课头和页面结构，`LessonArticle` 渲染 GFM 正文，`CodeBlock` / `CodeBlockFrame` 与 `LessonSourceButton` 统一代码展示和源码分屏。Markdown 可用注册组件 directive 穿插交互动画，后续章节复用同一排版。详见 [教学站文章约定](frontends/teach/README.md)。

Context 的工作区源码面板与第四章共用文件树图标与 rust-analyzer SCIP 定义跳转，支持定位目标行和返回。教学站构建需可用的 `rust-analyzer`；源码与索引从同一白名单输入生成，按内容缓存，并在打开面板时加载源码正文。

教学站新增登录后可玩的娱乐模块“天赋测试”，入口 `/talent` 为独立的彩色挑战卡大厅，支持错落卡片、翻面玩法与手机滑动，品牌采用 SVG 图标。反应力、顺序记忆、数字规律判断与颜色干扰四项测试各有独立排行榜，榜单入口 `/talent/leaderboard`，保存个人最佳，同分并列。业务代码位于 `frontends/teach/src/talent/` 与 `backend/internal/{httpapi,service,repository,model}/talent.go`，使用后台迁移 `004_talent_tests.sql`，不修改 Rust 内核或章节学习榜。玩法与本地验证见 [教学站说明](frontends/teach/README.md#天赋测试)，接口见 [后台说明](backend/README.md#天赋测试独立娱乐模块)。
