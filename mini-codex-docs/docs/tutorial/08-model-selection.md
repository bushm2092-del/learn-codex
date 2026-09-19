# 8. `/model`：运行中切换模型

上一节把模型来源集中到 `config.toml`。但一个 agent 会话往往要中途换模型：先用快的模型探索，
再用强的模型收尾。Codex 的做法是把模型当作**会话可变设置**，而不是客户端常量。本节按源项目
的四段链路移植 `/model`。

## 数据先行：一次切换经过哪些消息

```text
Ink 输入 /model
  ── model/list ─────────────────────▶ app-server  返回 {data: [{model, displayName, description, hidden, isDefault}], nextCursor}
  ◀───────────────────────────────────
  用户在列表里选中 deepseek-v4-pro
  ── thread/settings/update {threadId, model} ─▶  app-server -> core Op::ThreadSettings
  ◀── thread/settings/applied {settings: {model}}  core 发出 EventMsg::ThreadSettingsApplied
  ── config/value/write {keyPath: "model", value, mergeStrategy: "replace"} ─▶  写回 config.toml
  ◀── {status: "ok", version: "sha256:…", filePath}
  下一次 turn/start 的 Responses 请求体里 "model" 已经是新值
```

两步写入各管一件事：`thread/settings/update` 只影响当前会话（进程内），`config/value/write`
只影响下次启动（磁盘）。这正是 Codex TUI 里 `SelectSessionModel` 与 `PersistModelSelection`
两个事件的分工。

## 边界：模型为什么不能留在 client 里

第四节的 `OpenAiResponsesClient` 把 `model` 存成字段。这样 `/model` 只能重建 client，
而 client 又被 `ThreadManager` 和所有 thread 共享——重建会影响别的会话。源项目的 `ModelClient::stream`
把模型信息作为参数传入，模型本身放在 `TurnContext`/`SessionSettings`。本项目照做：

```rust
// crates/core/src/client_common.rs
pub trait ModelClient: Send + Sync {
    fn stream(&self, prompt: Prompt, model: String) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>>;
}

// crates/core/src/session/session.rs
pub(crate) struct SessionSettings { pub(crate) model: String }
pub(crate) struct Session { /* … */ pub(crate) settings: Mutex<SessionSettings>, /* … */ }
```

`run_turn` 每一步采样前读一次 `settings.model`，所以切换在“下一步模型调用”即生效。

| 源路径 | 本项目 | 职责 |
| --- | --- | --- |
| `codex-rs/protocol/src/protocol.rs`（`Op::ThreadSettings`、`ThreadSettingsOverrides`） | `crates/protocol/src/lib.rs` | 跨层数据 |
| `codex-rs/core/src/session/thread_settings.rs` | `crates/core/src/session/thread_settings.rs` | 应用覆盖并发 `ThreadSettingsApplied` |
| `codex-rs/core/src/config/edit.rs` | `crates/core/src/config/edit.rs` | `ConfigEdit::{SetModel, SetPath, ClearPath}`，`toml_edit` 局部改写 |
| `codex-rs/models-manager` | `crates/models-manager` | `models.json` → `ModelPreset` 列表与默认模型 |
| `codex-rs/app-server-protocol/src/protocol/v2/{model,config,thread}.rs` | 同路径 | `model/list`、`config/*`、`thread/settings/update` 的请求/响应形状 |
| `codex-rs/app-server/src/request_processors/{catalog,config}_processor.rs` | 同路径 | RPC 层 |
| `codex-rs/app-server/src/config_manager_service.rs` | 同路径 | keyPath 解析、版本比对、JSON→TOML、调用 `edit::apply_blocking` |
| `codex-rs/tui/src/slash_command.rs` | `mini-codex-tui/src/slash_command.ts` | 斜杠命令表 |
| `codex-rs/tui/src/bottom_pane/list_selection_view.rs` | `mini-codex-tui/src/bottom_pane/list_selection_view.tsx` | ↑↓/Enter/Esc 单选列表 |

## 循环：为什么写回要用 toml_edit

`config/value/write` 不能“反序列化 → 改字段 → 重新序列化”：那会丢掉用户的注释、空行和键顺序。
源项目用 `toml_edit::DocumentMut` 只替换目标键并沿用原有 decor：

```rust
// crates/core/src/config/edit.rs
fn insert(&mut self, segments: &[String], value: TomlItem) -> bool {
    let (last, parents) = segments.split_last()?;
    let parent = self.descend(parents, TraversalMode::Create)?;
    if let Some(existing) = parent.get(last) { Self::preserve_decor(existing, &mut value); }
    parent[last] = value;
    true
}
```

`ConfigManagerService::write_value` 在调用它之前做三件事：解析 `keyPath`（带引号的段允许包含 `.`）、
比对 `expectedVersion`（`sha256:` 指纹，对应 `config/src/fingerprint.rs`）、把 JSON 值转成
`toml_edit::Item`（顶层表写成 `[a.b]`，嵌套表写成内联表）。

## 测试：证明切换真的到了 HTTP 请求体

| 测试 | 断言 |
| --- | --- |
| `app-server/tests/suite/v2/thread_settings_update.rs` | 更新后收到 `thread/settings/applied`；假模型记录到的模型序列是 `["deepseek-flash", "deepseek-v4-pro"]` |
| `app-server/tests/suite/v2/model_list.rs` | 隐藏模型默认不返回；`limit`/`cursor` 分页；非法游标报错文案 |
| `app-server/tests/suite/v2/config_rpc.rs` | `config/value/write` 保留注释只改 `model`；`config/read` 读到新值；缺省时回落默认模型 |
| `app-server/src/config_manager_service_tests.rs` | keyPath 解析；过期版本与非用户路径被拒绝；Upsert 合并表、null 清键 |
| `core/src/config/edit_tests.rs` | 文件不存在时创建；注释与其他键原样保留；`ClearPath` 删除 |
| `mini-codex-tui/test/app.test.tsx` | `/model` 弹出列表、Esc 不写入、↓+Enter 触发两次请求并更新头部 |
| `mini-codex-tui/test/client.test.ts` | 真实 Rust 进程：切换后第三次 Responses 请求的 `model` 是新值，`config.toml` 已改写 |

## 与源项目的差异

- `ThreadSettingsOverrides` 只有 `model`；approval、sandbox、cwd、reasoning effort 未移植。
- 源项目 `Model` 响应无 `isDefault`，本项目加上它以便选择器标注“（默认）”；其余字段是源项目子集。
- `config/read` 只返回 `model` 与 `modelProvider`，不返回各层来源。
- 选择器不支持搜索与次级动作（源项目可按 Tab 只应用到会话不落盘）。
