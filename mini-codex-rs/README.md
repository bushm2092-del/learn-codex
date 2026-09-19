# mini-codex Rust 内核

这是 Rust 执行内核，使用 Cargo workspace 管理 `protocol`、`config`、`model-provider-info`、
`models-manager`、`utils/home-dir`、`arg0`、`core`、`cli`、`app-server` 和 `app-server-protocol` 十个 crate。

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
    ├── utils/home-dir/src/lib.rs                  # find_codex_home
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
    │   ├── session/{session.rs,handlers.rs,thread_settings.rs,turn.rs}
    │   └── tools/{registry.rs,router.rs,handlers/exec_command.rs}
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
  -> ToolRouter
  -> history
```

中文界面文案和 system prompt 由 `crates/cli/src/main.rs` 定义，system prompt 在创建
`ThreadManager` 时传入核心。

## 配置与运行

配置来自 `$MINI_CODEX_HOME/config.toml`（默认 `~/.mini-codex/config.toml`，可选），字段与真实 Codex 一致：
`model`、`model_provider`、`[model_providers.<id>]`（`name`、`base_url`、`env_key`、
`env_key_instructions`、`wire_api`）。API key 由 provider 的 `env_key` 环境变量提供，
源码和配置文件中都不保存密钥。内建 provider 只有 `deepseek`；内建模型目录在
`crates/models-manager/models.json`，`model` 缺省时使用目录默认模型 `deepseek-flash`。

```bash
printf 'DEEPSEEK_API_KEY=你的密钥\n' > ~/.mini-codex/.env
cargo run -p mini-codex-cli
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

当前 `exec_command` 仍然直接执行 shell，尚未实现生产 Codex 的 sandbox、审批、取消、rollout
恢复、context compaction、MCP 和 subagents。不要在不可信 prompt 或敏感目录中运行。

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
