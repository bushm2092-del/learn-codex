# mini-codex Rust 内核

这是 Rust 执行内核，使用 Cargo workspace 管理 `protocol`、`config`、`features`、
`model-provider-info`、`models-manager`、`shell-command`、`utils/home-dir`、`utils/pty`、
`arg0`、`tools`、`core`、`app-server` 和 `app-server-protocol` 十三个 crate。

## 源码结构

```text
mini-codex-rs/
├── Cargo.toml
├── Cargo.lock
└── crates/
    ├── app-server/src/{main,lib,message_processor,outgoing_message,transport}.rs
    ├── app-server/src/config_manager_service.rs   # config/* 背后的读写与版本比对
    ├── app-server/src/request_processors/{mod,thread_lifecycle,turn_processor,catalog_processor,config_processor}.rs
    ├── app-server/tests/common/mod.rs             # 假模型与 TestServer
    ├── app-server/tests/suite/v2/{turn_start,model_list,thread_settings_update,config_rpc}.rs
    ├── app-server-protocol/src/{lib,rpc}.rs
    ├── app-server-protocol/src/protocol/{mod,v1}.rs
    ├── app-server-protocol/src/protocol/v2/{mod,thread,turn,model,config}.rs
    ├── protocol/src/{lib,error,openai_models}.rs  # Op/Event、EnvVarError、ModelInfo/ModelPreset
    ├── tools/src/{function_call_error,tool_executor,tool_output,tool_payload,tool_spec}.rs
    │                                               # 源 codex-rs/tools 的受支持子集
    ├── features/src/lib.rs                        # UnifiedExec / UnifiedExecTty feature gate
    ├── shell-command/src/{lib,shell_detect,powershell}.rs
    ├── utils/home-dir/src/lib.rs                  # find_codex_home
    ├── utils/pty/src/{lib,windows_input}.rs        # PTY 边界与 ConPTY 输入归一化
    ├── arg0/src/lib.rs                            # load_dotenv：启动时读 $MINI_CODEX_HOME/.env
    ├── model-provider-info/src/lib.rs             # ModelProviderInfo、内建 deepseek provider
    ├── models-manager/{models.json,src/{lib,manager}.rs}  # 内置模型目录与默认模型
    ├── config/src/{lib,config_toml,config_layer_source,state,merge,overrides,fingerprint}.rs
    ├── config/src/loader/{mod,layer_io}.rs        # 读取 $MINI_CODEX_HOME/config.toml
    ├── core/src/
    │   ├── config/{mod,edit}.rs                   # Config 合并；toml_edit 局部写回
    │   ├── thread_manager.rs                      # 持有 Config 与 ModelsManager
    │   ├── codex_thread.rs
    │   ├── client_common.rs                       # ModelClient::stream(prompt, model)
    │   ├── client.rs
    │   ├── context_manager.rs
    │   ├── context/world_state/environment.rs     # 模型可见的 cwd / shell
    │   ├── shell.rs                               # shell 类型到 argv 的转换
    │   ├── unified_exec/                          # 长进程、输出缓冲、会话续写
    │   ├── session/{session.rs,handlers.rs,thread_settings.rs,turn.rs}
    │   └── tools/{context.rs,parallel.rs,registry.rs,router.rs}
    │       └── handlers/{mod.rs,shell_spec.rs,unified_exec.rs,unified_exec/{exec_command,write_stdin}.rs}
    ├── core/tests/tool_harness.rs
    └── cli/src/main.rs
```

核心调用链：

```text
ThreadManager
  -> CodexThread
  -> Session / submission_loop
  -> run_turn
  -> ModelClient
  -> ToolRouter::build_tool_call
  -> ToolCallRuntime
  -> ToolRegistry / ToolInvocation
  -> history
```

Function call 主链使用与源项目一致的 `ResponseItem`、`ResponseInputItem`、`ToolCall`、
`ToolPayload`、`ToolInvocation`、`FunctionCallError` 和 `ToolOutput`。模型参数解析失败和未知工具
会转换为失败的 `function_call_output` 返回模型；同一 response 中的多个调用先进入
`FuturesOrdered`，按模型调用顺序写回历史，并按 handler 的 `supports_parallel_tool_calls`
通过读写锁控制并行。SSE 在 `response.completed` 前关闭会判定为失败，不再误报 turn 完成。

Shell 工具的支持链对照源项目 `core/src/tools/spec_plan.rs`、`tools/handlers/shell_spec.rs`、
`tools/handlers/unified_exec*`、`core/src/unified_exec/`、`core/src/shell.rs`、
`shell-command/src/shell_detect.rs` 和 `utils/pty/src/windows_input.rs`。默认启用 Unified Exec：
短命令直接返回退出码；长命令先返回 `session_id`，后续 `write_stdin` 可输入字符或空轮询；
TTY 开启时保留 stdin，普通管道模式关闭 stdin。每次调用只返回从上次读取后新增的输出，收集层保留
头尾并限制为 1 MiB，模型层再按 `max_output_tokens` 做中间截断。进程表最多保留 64 项，达到软上限时
保护最近使用的 8 项，并优先淘汰已退出的最久未使用项。

会话创建时按平台选择用户 shell：macOS 为用户 shell → zsh → bash → sh，Linux 为用户 shell
→ bash → zsh → sh，Windows 为 PowerShell → cmd。模型传入的 `shell` 只选择受支持的 shell 类型，
不直接信任该路径作为可执行文件。POSIX、PowerShell 和 cmd 分别生成 `-c/-lc`、
`-NoProfile -Command` 和 `/c` argv；PowerShell 脚本会加 UTF-8 输出前缀，Windows PTY 会把 Enter、
Backspace 和跨调用 CRLF 归一化为 ConPTY 需要的字节。检测结果随 `<environment_context>` 的
`cwd` 和 `shell` 一起进入首次模型输入，因此模型选择 PowerShell 或 POSIX shell 不是靠猜测宿主系统。

中文界面文案和 system prompt 由 `crates/cli/src/main.rs` 定义，system prompt 在创建
`ThreadManager` 时传入核心。

## 配置与运行

配置来自 `$MINI_CODEX_HOME/config.toml`（默认 `~/.mini-codex/config.toml`，可选），当前字段与真实 Codex 对应：
`model`、`model_provider`、`[model_providers.<id>]`（`name`、`base_url`、`env_key`、
`env_key_instructions`、`wire_api`）以及 `[features]` 下的 `unified_exec`、`unified_exec_tty`。
两个 feature 默认均为 `true`；关闭 `unified_exec` 后只注册不可恢复、超时即终止的 OneShot
`exec_command`，不会向模型暴露 `write_stdin`。API key 由 provider 的 `env_key` 环境变量提供，
源码和配置文件中都不保存密钥。内建 provider 只有 `deepseek`；内建模型目录在
`crates/models-manager/models.json`，`model` 缺省时使用目录默认模型 `deepseek-flash`。

```bash
printf 'DEEPSEEK_API_KEY=你的密钥\n' > ~/.mini-codex/.env
cargo run -p mini-codex-cli
```

```toml
[features]
unified_exec = true
unified_exec_tty = true
```

两个二进制的 `main` 都先调用 `mini_codex_arg0::load_dotenv()`（对应源项目 `arg0_dispatch_or_else`
中的同名步骤），再创建 Tokio 运行时；`.env` 中 `MINI_CODEX_` 前缀的键会被忽略。

装配链：`arg0::load_dotenv` → `core::config::find_codex_home` → `load_config_as_toml_with_cli_overrides`
（`mini-codex-config::loader` 读 user 层并叠加 `-c` 覆盖层）→
`Config::load_from_base_config_with_overrides`（合并内建 provider、选择 `model_provider`、解析 cwd）→
`OpenAiResponsesClient::from_config` → `ThreadManager::new(config, client, tools, instructions)`。
模型名保存在会话设置里（`session/session.rs::SessionSettings`），每次 `ModelClient::stream(prompt, model)`
传入；`Op::ThreadSettings` 可在回合之间切换模型。

### 模型切换（`/model`）

```text
Ink /model
  -> model/list                 catalog_processor  -> ThreadManager::list_models
  -> thread/settings/update     turn_processor     -> Op::ThreadSettings -> session/thread_settings.rs
                                                    -> EventMsg::ThreadSettingsApplied -> thread/settings/applied
  -> config/value/write         config_processor   -> ConfigManagerService::write_value
                                                    -> core::config::edit::apply_blocking (toml_edit)
  -> config/read                返回当前 model / model_provider
```

与源项目的差异：目录名 `MINI_CODEX_HOME` / `~/.mini-codex`（源为 `CODEX_HOME` / `~/.codex`）；
按用户要求取消官方 `openai` provider、auth.json 与 `requires_openai_auth`；模型目录是打包的
DeepSeek 静态 `models.json`，不在线刷新；只加载 user 与 SessionFlags 两层，未移植
system/MDM/enterprise/project 层与 requirements；`AbsolutePathBuf` 简化为 `PathBuf`；
loader 使用 `std::fs` 同步读取；`config/value/write` 不校验 requirements，只做版本比对与路径白名单。

## 验证

```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

当前 `exec_command` 仍然直接执行本机 shell。生产 Codex 中由 sandbox、审批与附加权限、远程
environment、network proxy、hook/telemetry、shell snapshot/zsh-fork、turn cancellation 和 rollout
恢复承担的分支尚未移植，因此 schema 也不暴露 `sandbox_permissions`、`additional_permissions`、
`justification`、`prefix_rule` 或 `environment_id`。`utils/pty` 当前以 `portable-pty` 保留相同的平台
边界，没有移植源项目完整的进程组、Linux spawn helper 和 Windows Job Object。不要把这些删减描述为
已有安全保障，也不要在不可信 prompt 或敏感目录中运行。详细对照见
[Unified Exec 教程](../mini-codex-docs/docs/tutorial/07-unified-exec.md)。

# 规范
提交注释提示等全部中文书写
## App-server

`cargo run -p mini-codex-app-server` 或 `cargo run -p mini-codex-cli -- app-server` 启动 stdio JSONL 服务。
此入口与 CLI 共用同一条 `Config` 装配链，读取相同的 `config.toml` 和 `env_key` 环境变量。
system prompt 由服务入口组装。

调用链为 `MessageProcessor -> request_processors -> ThreadManager -> CodexThread`。
外部 JSON-RPC 请求类型属于 `app-server-protocol`，内部 Op/Event 仍属于 `protocol`。
独立的 Ink 前端在 `../mini-codex-tui/`；完整源路径映射、协议限制和传输层简化理由见
[第六章](../mini-codex-docs/docs/tutorial/06-app-server-ink.md)。

## TUI 外观与离线演示

Ink 界面采用顶部双栏欢迎区、中央对话视窗和底部固定输入栏。欢迎区使用用户提供的圆形蓝紫色 Codex 应用图标，以半格字符绘制。边框和标题使用
与图标一致的浅蓝紫 → 紫罗兰 → 亮蓝渐变，保留等待动画、回合耗时、消息分层和工具输出折叠。
助手消息按 Markdown 渲染（对应源项目 `tui/src/markdown_render.rs`，解析器用 marked 代替 pulldown-cmark）。
对话视窗跟随最新消息，超出终端高度的旧内容会被裁切；完整上下文仍由 core 保留。
窄终端会切换为紧凑布局。`Tab` 展开或收起工具输出；`/clear` 只清除界面记录，
不会重置模型上下文；`/exit` 和 `Ctrl+C` 退出。

在 `mini-codex-tui/` 中运行 `pnpm demo`，无需 API Key 即可预览模拟工具和流式回复。
演示模式明确标注为 DEMO，不连接模型、不执行 shell；真实使用仍运行 `make tui`（仓库根目录）。
设置 `MINI_CODEX_REDUCED_MOTION=1` 可关闭装饰动画。没有密钥时，真实模式会显示配置提示，
不会自动切换到演示模式。
