# Unified Exec、shell 检测与跨平台执行

本章说明 mini-codex 如何把模型发出的 `exec_command` 从 Responses 工具定义一路送到操作系统，
以及为什么模型能选择 PowerShell、POSIX shell 或 cmd。实现只删去当前教学内核没有上游依赖的
生产分支；已支持路径的模块边界、状态顺序和模型可见数据形状均对照 Codex 源码。

## 源码映射

| Codex 源文件 | mini-codex 文件 | 当前职责 |
| --- | --- | --- |
| `codex-rs/features/src/lib.rs` | `mini-codex-rs/crates/features/src/lib.rs` | `UnifiedExec` 与 `UnifiedExecTty` 默认值和配置覆盖 |
| `codex-rs/shell-command/src/shell_detect.rs` | `mini-codex-rs/crates/shell-command/src/shell_detect.rs` | 用户 shell、PATH 与平台 fallback 检测 |
| `codex-rs/shell-command/src/powershell.rs` | `mini-codex-rs/crates/shell-command/src/powershell.rs` | PowerShell 命令识别与 UTF-8 输出前缀 |
| `codex-rs/core/src/shell.rs` | `mini-codex-rs/crates/core/src/shell.rs` | shell 类型转换为真正执行的 argv |
| `codex-rs/core/src/tools/handlers/shell_spec.rs` | `mini-codex-rs/crates/core/src/tools/handlers/shell_spec.rs` | `exec_command`、`write_stdin` 的 JSON Schema |
| `codex-rs/core/src/tools/handlers/unified_exec.rs` | `mini-codex-rs/crates/core/src/tools/handlers/unified_exec.rs` | 参数解析与 shell 选择 |
| `codex-rs/core/src/tools/handlers/unified_exec/` | 同相对路径 | Interactive、OneShot 与 stdin handler |
| `codex-rs/core/src/unified_exec/` | 同相对路径 | 进程、输出缓冲、等待、续写、淘汰和超时终止 |
| `codex-rs/core/src/context/world_state/environment.rs` | 同相对路径 | 首次 turn 的 `<environment_context>` |
| `codex-rs/utils/pty/src/windows_input.rs` | `mini-codex-rs/crates/utils/pty/src/windows_input.rs` | ConPTY 输入字节归一化 |

## 从 session 到模型

`ThreadManager` 根据 feature gate 构造工具注册表。`unified_exec = true` 时注册 Interactive
`exec_command` 与 `write_stdin`；为 `false` 时仅注册 OneShot `exec_command`。工具的 `name`、
`description`、`strict` 和 `parameters` 会随 Responses 请求发给模型；`output_schema` 是宿主侧元数据，
不会作为 Responses function 定义序列化。

创建 `Session` 时，`default_user_shell()` 只执行一次。结果同时保存为会话 shell，并与 cwd 渲染为：

```xml
<environment_context>
  <cwd>/workspace/project</cwd>
  <shell>bash</shell>
</environment_context>
```

这条消息进入 history，随后与用户输入一起发送给模型。模型因此能根据明确的 `shell` 值书写
PowerShell、bash/zsh/sh 或 cmd 命令；不是由 `exec_command` 猜测命令语法。

## 命令执行状态流

```text
function_call(exec_command)
  -> ExecCommandHandler 解析 JSON
  -> get_command 选择会话 shell 或模型请求的已知 shell 类型
  -> Shell::derive_exec_args 生成 argv
  -> UnifiedExecProcessManager 分配随机 process_id
  -> pipe 或 PTY 启动进程并持续收集输出
  -> 在 yield_time_ms 内退出：返回 exit_code
  -> 尚未退出：保留进程并返回 session_id
  -> write_stdin 写入字符或空轮询
  -> 退出后移除进程并释放 process_id
```

普通 pipe 模式关闭 stdin，并发读取 stdout/stderr；PTY 模式保留 writer，供 `write_stdin` 使用。
每个进程有 interaction lock，避免两个续写调用同时消费同一段增量输出。空轮询至少等待 5 秒，
最长等待 300 秒；有输入的调用按 250–30000 毫秒钳制。Windows 首次执行至少等待 10 秒。

输出收集器总容量为 1 MiB，超限时保留头尾并写入省略标记。工具结果的文本顺序与 Codex 一致：
`Chunk ID`、`Wall time`、退出码或运行中的 `session_id`、原始 token 估算、`Output`。这段文本最终成为
Responses 协议中的 `function_call_output`，按模型原始 tool call 顺序写回 history。

OneShot 模式从 schema 移除 `tty` 和 `yield_time_ms`，增加 `timeout_ms`，执行期间不会返回可恢复的
`session_id`；超时后终止进程。Interactive 模式允许最多 64 个保留进程，达到软上限时保护最近使用的
8 个进程，并优先淘汰已退出的最久未使用进程。

## 平台差异

- macOS：用户 shell → zsh → bash → sh。
- Linux：用户 shell → bash → zsh → sh。
- Windows：PowerShell → cmd。
- 模型提供的 `shell` 路径仅用于识别类型；实际可执行文件仍由受控发现顺序选择。
- POSIX 使用 `-c`，允许 login 时使用 `-lc`；PowerShell 使用 `-NoProfile -Command`；cmd 使用 `/c`。
- PowerShell 脚本在执行前加最佳努力的 UTF-8 输出编码设置。
- Windows PTY 把 LF 转为 CR、Backspace 转为 DEL，并跨多次写入折叠 CRLF。

## 明确删减的生产分支

mini-codex 尚无对应上游服务，因此没有移植 sandbox、审批与附加权限、远程 environment、network
proxy、hook/telemetry、shell snapshot/zsh-fork、turn cancellation、rollout 恢复和后台终端事件。
相应参数 `sandbox_permissions`、`additional_permissions`、`justification`、`prefix_rule`、
`environment_id` 不会出现在当前 schema 中。

源项目 `utils/pty` 自己管理进程组、Linux spawn helper、ConPTY 和 Windows Job Object；当前教学版的
同名 crate 通过 `portable-pty` 实现 PTY 平台边界，只逐段保留本次可观察行为需要的 Windows 输入
归一化。当前单环境的 cwd 与 shell 在 session 生命周期内固定，所以只写入完整初始快照，不生成
多环境或后续 turn 的 world-state diff。这些都是显式偏离，不代表生产 Codex 缺少相应能力。
