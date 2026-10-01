# 第五章：Context，从一次对话到三条压缩路线

沿着一次真实对话，从消息写入到下一次请求，再到三条压缩路线。把我们学习中逐个追问的“为什么”，放回 mini-codex 的真实调用链。

在线教学页 `/lessons/context` 提供六段可播放、暂停、逐步跳转的 Remotion 消息条带动画；每段附文字步骤。本文是同一章节的可离线阅读版。

## 先从一个问题开始：模型下一次到底看到什么？

第四章讲清了模型如何调用工具。这一章继续追问：工具执行完，结果放在哪里？第二轮提问时，模型还看得到第一轮吗？窗口满了以后，是删除 AI 消息、生成摘要，还是直接换一个窗口？

我们沿用一个具体任务：“读取 README，告诉我如何启动项目”，接着用户追问：“再检查启动脚本”。先跟消息走一遍，再回到每个函数。你会看到 Context 并不是一段越来越长的字符串，而是 harness 为每次请求组装的一组结构化信息。

本文以当前 mini-codex 代码为讲解对象，并对照本地 Codex 源码。动画中的短文本与 token 数是教学样例；它们表示真实控制流，不代表一次线上请求的测量结果。

## Context 的三个组成部分

Prompt.instructions 是入口传入的基础指令；Prompt.tools 是当前可见的工具规格；Prompt.input 是整理后的历史。parallel_tool_calls 是请求选项，并不是一条历史消息。基础指令不会被 record_items 当作普通消息追加。

因此，聊天界面里显示的文本不等于模型请求。OutputTextDelta 用来更新显示；只有 OutputItemDone 中的完整 ResponseItem 才写入 history。把每个 delta 都追加为独立消息，会造成重复。

对应：`crates/core/src/session/turn.rs · run_turn`

```rust
let prompt: Prompt = Prompt {
    input: session.history.lock().await.clone().for_prompt(),
    tools: session.tool_router.model_visible_specs().to_vec(),
    parallel_tool_calls: true,
    instructions: session.instructions.clone(),
};
```

## 一段真实的对话链：追加，执行，再重放

Session::spawn 先建立 ContextManager，写入 environment_context；开启 TokenBudget 时，还会写入窗口标识和可选的指导信息。下面先看默认关闭 TokenBudget 的流程。

run_turn 发出 TurnStarted，先检查已有历史是否达到压缩阈值，再 record_items 写入本次用户消息。随后 clone().for_prompt() 生成第一次请求输入。模型返回 function_call 时，先保存调用项，再把工具 future 放进 FuturesOrdered。

response.completed 更新 usage。工具 futures 按入队顺序 drain，结果以 FunctionCallOutput 写回 history，并使用同一个 call_id 与调用对应。needs_follow_up 为 true，循环再请求模型；完成的 assistant 回答随后进入历史。

下一轮用户输入继续追加到同一个 Session。模型可以看到上一轮，是因为历史被重放到新请求里；不是因为这次请求只发新句子，模型仍会自动记住上次的工具结果。

## history 保存协议对象，不只是 user / assistant

ContextManager 的 items 是 Vec<ResponseItem>。除了 Message，还有 FunctionCall、FunctionCallOutput、Reasoning、ToolSearchCall/Output 与 Compaction。动画里的 tool_call / tool_result 是便于阅读的简称，不是实际 JSON 的 type 值。

record_items 是写入边界：过滤不应该进入历史的 system、Other 和 CompactionTrigger，并对函数输出应用 truncation_policy。for_prompt 是发送边界：消耗历史副本，补齐缺失结果，再移除孤立结果。它不会把补出来的 aborted 结果写回活动历史。

对应：`crates/core/src/context_manager/history.rs · for_prompt`

```rust
pub(crate) fn for_prompt(mut self) -> Vec<ResponseItem> {
    normalize::ensure_call_outputs_present(&mut self.items);
    normalize::remove_orphan_outputs(&mut self.items);
    self.items
}
```

## 为什么要补 aborted，为什么又要删结果？

例如历史里有调用 c1，却没有 c1 的结果。normalize.rs 会在调用后插入文本为 aborted 的结果，让发送的调用链闭合；这不代表又执行了一次工具，也不保证工具成功。搜索调用缺结果时则补 completed、client、空 tools 的搜索结果。

反过来，如果历史里只有 orphan 的工具结果，没有对应调用，remove_orphan_outputs 会删掉它。call_id 为 None 的外部具名结果与 server 执行的搜索结果有保留例外，不能一概删掉所有“没有调用”的输出。

补齐位置按倒序插入，避免索引位移；调用有 id 时，合成结果使用固定 UUID v5 命名空间，反复生成请求得到稳定的 id。

## truncation_policy：写入时截断工具输出

这个字段在 history.record_items 中生效，控制 FunctionCallOutput 正文预算。它不是自动压缩开关，也不会按相同规则截断所有 user / assistant 消息。exec 工具自身的输出限制是更早的另一个环节。

当前默认 Bytes(10_000)。history 使用 with_serialization_allowance 增加 20% 预算，因此正文按约 12,000 字节处理。截断保留头尾并添加中间省略标记；按 UTF-8 边界切割，不会切坏一个中文字。省略标记本身会使最终长度略超正文预算。

本地重建历史对用户消息使用独立的 20,000 token 预算；Remote V2 保留消息使用独立的 64,000 token 预算。不要把这些预算与模型的 truncation_policy 混为一谈。

## 五个模型字段，各自控制什么？

ModelInfo 来自模型目录，并接受会话配置覆盖。未知模型不借用 DeepSeek 的窗口大小；静态目录也不会猜一个未经确认的窗口。当前 mini-codex 使用 context_window.or(max_context_window) 解析窗口，所以 max_context_window 在这里是 fallback 字段，不是单独再执行一次 min 钳制。

auto_compact_token_limit() 将显式阈值与解析窗口的 90% 取较小值；usable_context_window() 则用 effective_context_window_percent 计算完整可用上限。这两个数字分别用于提前压缩和完整窗口约束。

| 字段 | 当前用途 |
| --- | --- |
| context_window | 优先使用的模型窗口容量 |
| max_context_window | context_window 缺失时的窗口 fallback |
| auto_compact_token_limit | 提前进入自动压缩的阈值 |
| effective_context_window_percent | 完整窗口的可用百分比，默认 95 |
| truncation_policy | 写入 history 时的函数输出预算 |

## 95% 是留余量，不是 token 算法

假设解析窗口为 100,000 tokens，effective_context_window_percent = 95，则完整可用上限为 95,000；未额外配置时，自动压缩阈值是 90,000。达到 90,000 时已经会进入自动压缩，不必等到 95,000。

这个余量让窗口判断更保守：本地新增项是粗估，协议和服务商还可能有未被本地估算覆盖的开销。例如本地判断 94,000，而实际输入多出 2,000 时，总量仍是 96,000，低于名义窗口 100,000。这只是说明余量的作用，并不保证每种请求都不会超限。

本地文本粗估按 UTF-8 字节数约每 4 字节一个 token，向上取整；它不是 tokenizer。服务端 usage 有时能给出真实计数，尚未发送的工具结果仍需要本地估算。

## 真实 usage + 新增内容：为什么不能用累计账单？

client.rs 在 response.completed 中读取 usage。TokenUsageInfo 同时保存 total_token_usage（各次请求累加）和 last_token_usage（最近响应）。窗口大小判断用后者，因为下一次请求会再次发送历史；把所有请求的输入用量加起来，会把反复发送的内容重复计入当前窗口。

get_total_token_usage = 最近响应 total_tokens + 最后模型生成项之后的本地新增项估算；没有 x-reasoning-included 标志时，还补算最后真实用户边界之前的历史加密 reasoning。这个响应头按“是否存在”判断，不解析成布尔字符串。

例子：服务端报告 1,000；随后工具结果估算为 2，当前判断 1,002。下一次服务端报告 1,200 后，新基线变成 1,200，而累计用量是 2,200，不能再用 1,002 + 1,200 判断窗口。

压缩安装新历史后 recompute_token_usage 用新历史和基础指令重算最近基线，保留累计用量。下一次正常响应再校准。usage 缺失时沿用上游的零基线与尾部规则，不自动估算全部历史；还没有模型生成项时，尾部为空。

## 压缩时机与路线选择，是两个问题

context_window_token_status 计算是否达到阈值。run_turn 在记录本次用户输入之前检查一次；工具执行并写回结果之后，如果 needs_follow_up 为 true，再检查一次。最终回答结束时没有额外 post-turn 压缩。

run_auto_compact 决定怎么处理：先检查 Feature::TokenBudget；开启则直接切新窗口并返回。否则检查 ConfiguredModelProvider.capabilities().remote_compaction：V2 走服务端，Unsupported 走本地摘要。这不是三个顺序执行的阶段，也不是 V2 失败就自动换本地摘要的降级链。

本地配置型 provider 沿用上游 OpenAI 名称和 Azure 名称／地址检测规则。换一个模型名本身，不会把 provider 自动变成 V2。内建 DeepSeek 是默认配置，不是内核功能上限。

| 开关 / 能力 | 路线 |
| --- | --- |
| TokenBudget 开启，任意 provider | 直接建立新窗口 |
| TokenBudget 关闭，provider 支持 V2 | Remote V2 加密压缩 |
| TokenBudget 关闭，provider 不支持 V2 | 本地摘要重建历史 |

对应：`crates/core/src/session/turn.rs · run_auto_compact`

```rust
if session.config.features.enabled(mini_codex_features::Feature::TokenBudget) {
    return crate::compact_token_budget::run_inline_auto_compact_task(session, injection).await;
}
```

## 本地压缩：先让模型总结，再重建历史

run_compact_task_inner_impl 首先读取模型信息并克隆 history。SUMMARIZATION_PROMPT 作为 user 消息只追加到这个副本，原始用户历史不会被这条压缩指令污染。当前指令按我们的学习过程翻译成中文，要求生成进度、关键决策、约束、下一步与必要资料的交接摘要。

构造 Prompt 时，input 用副本的 for_prompt()，instructions 仍是基础指令，tools 为空，parallel_tool_calls 为 false。drain_to_completed 调用当前配置模型；完成的 OutputItemDone 会写入活动历史，delta 被忽略；直到收到 Completed 才继续。

再读取活动历史 snapshot，提取最后一条 assistant 文本，拼上 SUMMARY_PREFIX。随后收集真实用户消息、构建新历史、按时机注入环境，replace 安装，最后 recompute_token_usage。每一步都有独立职责，不能简单理解成“删除 AI 消息”。

## collect_annotated_user_messages 到底保留谁？

items.iter() 逐项扫描；user_message(item)? 只接受 role = user 的 Message，提取文字并排除 environment_context。问号在 filter_map 闭包里表示“不符合就返回 None”，不是把整个压缩任务报错退出。

is_summary_message 再排除带 SUMMARY_PREFIX 的旧摘要。最后保留 id 和 message，形成 Vec<CompactedUserMessage>。这里的 annotated 指保留关联信息；mini-codex 还没有上游完整的 ResponseItemEnvelope 元数据。

这个方法不截断，也不负责生成摘要。它提取用户原始意图，让重建后的上下文不必只依靠模型总结。assistant、工具调用与结果不进入这份列表；它们的信息可能被摘要保留，而不是按原始协议项逐条保留。

对应：`crates/core/src/compact.rs · collect_annotated_user_messages`

```rust
let message: String = user_message(item)?;
if is_summary_message(&message) {
    return None;
}
let ResponseItem::Message { id, .. } = item else {
    return None;
};
Some(CompactedUserMessage {
    id: id.clone(),
    message,
})
```

## 压缩后的消息具体长什么样？

build_compacted_history 从最近用户消息向前选择，在 20,000 粗估 token 预算内保留；边界消息装不下时按剩余预算截断，随后 reverse 恢复时间顺序。最后追加摘要，它是一条 role = user 的 Message。这个预算只约束保留的用户消息，不包含摘要本身。

假设原来是 [环境, user₁, call₁, result₁, assistant₁, user₂, call₂, result₂]。回合中压缩后是 [user₁, 环境, user₂, user(summary)]。不是 [环境, assistant(summary)]，也不是只留下最后一条 user。

采样前压缩使用 DoNotInject：先得到 [user₁, user₂, user(summary)]，回到 run_turn 再追加环境和本次新 user。BeforeLastUserMessage 则将环境插在最后真实用户消息之前；没有真实用户时才退到摘要位置。两种时机不要混用。

## Remote V2：哪个字段告诉服务端“我要压缩”？

不是给普通请求加 compact = true，也不是靠摘要提示词识别。run_remote_compact_v2_attempt 在整理后的 input 末尾追加 ResponseItem::CompactionTrigger，序列化后 type 是 compaction_trigger。请求仍走正常 ModelClient::stream / Responses 流，携带当前 instructions、工具规格和 parallel_tool_calls = true。

发送前只改写连续尾部的工具输出，按可用窗口逐步减小输出；遇到非工具结果就停止。服务端返回 type = compaction、encrypted_content 的项目；客户端不解密它，而是在后续请求中重放。

collect_compaction_output 必须看到 response.completed 且恰好一个 Compaction。只有完整结果通过校验，才 build_v2_compacted_history 并 replace。真实用户消息按最近优先的 64,000 粗估 token 预算保留，最后追加加密项；回合中仍按前述位置注入环境。

attempt.token_usage 与 compaction_response_id 被携带，但当前安装路径不把压缩请求 usage 当作新历史大小，而是重算新基线；也没有持久化 response_id。

## TokenBudget：直接建立一个新窗口

开启后，compact_token_budget 不请求模型总结，也不请求服务端压缩。Session::start_new_context_window 先推进窗口序号与 UUID，再重置 reminder/fallback 的一次性标志，构建环境与 developer 窗口标识，replace 清空旧历史，最后重算 usage。

首次窗口记录 first/current id；以后还记录 previous id，first 不变。Prompt.instructions 仍来自同一个 Session，所以保留。旧 user、assistant、工具调用与结果都不会自动带进新窗口，且没有隐藏摘要替它们保管信息。

采样前切换，会在新窗口追加这次新用户输入；工具后切换，会只用重建的基础上下文继续采样，连旧任务描述也会被清空。上游还有 history/notes 等扩展支持跨窗口工作；mini-codex 当前没有这些能力，不能假设模型还能完整延续旧任务。

## 配置提醒与收尾缓冲，不要扩大完整上限

配置文件是 $MINI_CODEX_HOME/config.toml，默认 ~/.mini-codex/config.toml。最简单写法是 [features] 下 token_budget = true；默认关闭。需要细节时使用下面的配置表，不能再重复声明同一 token_budget 键。窗口数值是示例，需要按服务商实际能力填写。

reminder_threshold_tokens = 10000 指距离未加缓冲的阈值还剩 10,000 时提醒，不是窗口大小。maybe_record 在采样和工具结果收集后调用；每窗口只写一次提醒。auto_compact_fallback_prompt 在剩余量为 0、但尚未强制切换时写入，进入下一次普通采样。

如果自动阈值是 90,000、fallback buffer 是 2,000、完整上限是 95,000，则到 90,000 时允许收尾，到 92,000 时必须切换。若完整上限先到，立即切换，不能为了收尾继续撑到 buffered 阈值。

尚未提供阈值时，开启 feature 本身不会触发自动切换。use_history_notes_extension = true 在当前内核显式报未支持，避免配置看似启用但实际上没有持久化。

对应：`config.toml · 示例 / example`

```toml
model_context_window = 100000
model_auto_compact_token_limit = 90000

[features.token_budget]
enabled = true
reminder_threshold_tokens = 10000
reminder_message_template = "Remaining: {n_remaining} tokens."
auto_compact_fallback_prompt = "Finish essential work before rollover."
auto_compact_fallback_buffer_tokens = 2000
```

## 失败时，不同路线的写入边界不同

本地 drain_to_completed 已完成的摘要输出项先写入活动历史。若流之后失败，不能安装不完整摘要，但也不能声称所有写入都已回滚。采样前压缩失败仍保存本次用户输入，然后让 submission loop 发出 Error。

Remote V2 的局部输出先留在 attempt 中；未完成或结构校验失败不会 replace。流提前关闭属于 Stream 错误，按 provider 预算最多重试两次；缺少或重复 Compaction 属于 Fatal，不重试。未分类的 HTTP/SSE 错误当前直接返回。

TokenBudget 没有摘要网络请求，因此不经过上述结果采集边界。本教学子集也没有上游 hooks、取消与持久化检查点，不能把没有实现的保障当作已有行为。

## 带着断点再走一遍

从 session/session.rs 的 Session::spawn 起步，再跟 session/turn.rs 的三处 record_items 和 clone().for_prompt()。到 history.rs 看写入与发送边界，到 normalize.rs 看配对修复；这是读完本章后应该能独立复述的主线。

实验一：脚本模型返回 total_tokens = 2100，自动阈值设为 1000。关闭 TokenBudget、使用不支持 V2 的 provider，检查下一次请求末尾的中文总结指令；开启 TokenBudget，检查请求数量没有增加、旧消息消失且 previous window id 出现。

实验二：服务端 usage = 1000，随后追加一个约 2 token 的工具结果。窗口判断应为 1002；下一次 usage = 1200 后应改用新基线，累计账单为 2200。实验三：给 c1 删掉结果，再加一个孤立结果；比较 raw history 与 for_prompt() 的副本。

对应测试：core/tests/tool_harness.rs、context_manager/history_tests.rs、compact_tests.rs、compact_remote_v2_tests.rs、state/auto_compact_window_tests.rs 和 config/config_tests.rs。它们是离线行为验证，不是服务商线上压缩能力测试。

## 当前实现的边界

已支持：结构化历史、工具输出截断、配对修复、服务端 usage 加新增项估算、本地中文摘要、Remote V2、TokenBudget 自动窗口切换、预算提醒与收尾缓冲。

尚未移植：完整 SessionState/envelope、前缀增量 scope、post-turn 压缩、模型拥有的预算默认值与订阅实验激活、history/notes 持久化、主动切换工具、手动 /compact、生命周期事件与 hooks、媒体整理、取消和 rollout 恢复。窗口身份在既有 Session 的 Mutex 中保存；默认预算提醒删除了持久化承诺。

源码按钮提供本次构建包含的 mini-codex 源码。完整源路径映射和显式偏离见仓库中的 mini-codex-docs/docs/tutorial/05-context.md；阅读时要区分本项目已经支持的行为与上游仍未移植的分支。

## 源码映射

以下源路径均相对 `codex-rs/`，目标路径相对 `mini-codex-rs/`：

| 源路径 | 目标路径 | 本章关注点 |
| --- | --- | --- |
| `core/src/context_manager/mod.rs` | `crates/core/src/context_manager/mod.rs` | 模块导出 |
| `core/src/context_manager/history.rs` | `crates/core/src/context_manager/history.rs` | 写入、过滤、截断、准备输入、估算 |
| `core/src/context_manager/normalize.rs` | `crates/core/src/context_manager/normalize.rs` | 缺失输出与孤立输出 |
| `core/src/session/context_window.rs` | `crates/core/src/session/context_window.rs` | FullContext 阈值 |
| `core/src/session/mod.rs` | `crates/core/src/session/mod.rs` | usage 更新、reasoning 标志与压缩后重算 |
| `codex-api/src/sse/responses.rs` | `crates/core/src/client.rs` | 在既有教学 HTTP 客户端中移植 usage 解析与响应头事件，保留客户端层级偏离 |
| `core/src/session/turn.rs` | `crates/core/src/session/turn.rs` | 采样前与工具后的压缩时机 |
| `core/src/compact_remote_v2.rs`、`core/src/compact_remote_v2_attempt.rs` | `crates/core/src/compact_remote_v2.rs`、`crates/core/src/compact_remote_v2_attempt.rs` | V2 请求、校验与历史替换 |
| `core/src/compact_remote_history.rs`、`core/src/responses_retry.rs` | `crates/core/src/compact_remote_history.rs`、`crates/core/src/responses_retry.rs` | 尾部工具输出预算与 Stream 重试 |
| `model-provider/src/provider.rs`、`codex-api/src/provider.rs` | `crates/model-provider/src/provider.rs`、`crates/codex-api/src/provider.rs` | provider 能力与 Azure 判定 |
| `async-utils/src/backoff.rs` | `crates/async-utils/src/backoff.rs` | 重试退避 |
| `protocol/src/models.rs`、`protocol/src/error.rs` | `crates/protocol/src/models.rs`、`crates/protocol/src/error.rs` | Compaction 协议与错误子集 |
| `core/src/compact.rs` | `crates/core/src/compact.rs` | 本地摘要与历史替换 |
| `prompts/src/compact.rs`、`prompts/templates/compact/*` | `crates/prompts/src/compact.rs`、`crates/prompts/templates/compact/*` | 摘要指令与前缀 |
| `utils/string/src/truncate.rs` | `crates/utils/string/src/truncate.rs` | token 粗估与 UTF-8 截断 |
| `utils/output-truncation/src/lib.rs` | `crates/utils/output-truncation/src/lib.rs` | 输出预算与多段文字截断 |
| `protocol/src/protocol.rs` | `crates/protocol/src/lib.rs` | TruncationPolicy，保留项目已有扁平协议偏离 |
| `protocol/src/openai_models.rs` | `crates/protocol/src/openai_models.rs` | 模型窗口、阈值及截断字段 |
| `config/src/config_toml.rs`、`core/src/config/mod.rs` | `crates/config/src/config_toml.rs`、`crates/core/src/config/mod.rs` | 配置读取和覆盖 |

原 `crates/core/src/context_manager.rs` 删除，恢复上游目录边界。源 `ResponseItemEnvelope` 元数据、review history、retained context 与版本管理未移植，当前历史仍是 `Vec<ResponseItem>`。因此 `record_items` 保留写入策略子集，不提供 annotated history API。

## 显式偏离与删减

- 按用户要求，将源 `prompts/templates/compact/prompt.md` 的英文交接摘要指令翻译为中文，目标为 `crates/prompts/templates/compact/prompt.md`；保留原指令语义与加载方式，摘要前缀不变。

- 上游 `normalize.rs` 的 custom tool、local shell、图片音频分支删除；目前协议没有这些类型。孤立结果诊断没有移植 `error_or_panic`，仅保留移除算法；真实日志不是已提供能力。
- `ModelInfo.truncation_policy` 使用同 JSON 形状的 `TruncationPolicy`，没有再建 `TruncationPolicyConfig` 转换层。协议预算方法内联上游 4 字节公式，避免 protocol 反向依赖 tools；字符串工具的原始算法保持独立。
- `Session::model_info` 使用当前教学目录与两个配置覆盖字段，没有完整 TurnContext/StepContext 模型设置快照。摘要助手函数只处理文本，无隐藏标记解析。用户消息解析在 compact.rs 中保留文本子集，环境按固定 `<environment_context>` 标签识别，没有移植 event_mapping 与 fragment metadata；活动摘要以普通 user Message 保存。
- 上游非 post-turn 本地摘要完成项目先写入活动历史的顺序保留。没有压缩模型兼容 hash、post-turn 压缩、增量窗口 scope、模型默认窗口回退或多代理消息。
- ModelClient 仍返回 anyhow，协议新增上游 `CodexErr::Stream/Fatal` 子集用于 V2。尚未分类的 HTTP、SSE 解码和服务端失败错误直接返回；未移植完整源错误枚举、context overflow 的本地删旧历史重试、WebSocket 回退、连接专属重试、Retry-After 或 ModelClientSession。V2 的流关闭重试与 backoff 已支持。
- V2 删除多模态、AgentMessage、hook、客户端 developer 元数据保留及附属 notice 分支；当前纯文本历史没有这些类型。旧本地摘要使用前缀识别替代上游 fragment metadata，明确保留此前教学偏离。完成 response_id 不持久化，因尚无 rollout；未移植 compaction analytics、trace 与 executed-tool-call 附加元数据。内建 provider 仍仅 DeepSeek/env_key，已有自定义 provider 可配置 OpenAI/Azure 能力，不恢复 auth.json 登录。
- 没有压缩专属 ItemStarted/ItemCompleted、Warning、ContextCompacted 生命周期、对 UI 的 TokenCount usage 事件、rollout 检查点与取消。入口仍沿原 TurnStarted、Error、TurnCompleted 事件闭环；不能称为完整生产压缩实现。
- environment 状态目前只有固定本地 cwd/shell。采样前压缩后由正常 turn 注入完整环境；没有完整世界状态 baseline、reference_context_item 或 diff 更新。

- 上游 SessionState 层尚未移植：TokenUsageInfo 保存在既有 ContextManager，server_reasoning_included 用 Session 的 AtomicBool 保存，由 session/mod.rs 沿上游方法职责读取与更新。原子值仅代表该独立标志，未增加完整 SessionState、usage contributor、按模型累计展示、rollout budget 或恢复逻辑。TokenUsage 删除尚未支持的 codex_rollout_budget_units 字段，保留 token 计数字段与累计算法。


## TokenBudget 补充映射

`features/src/feature_configs.rs`、`core/src/compact_token_budget.rs`、`core/src/session/token_budget.rs`、`core/src/state/auto_compact_window.rs`、`core/src/context/token_budget_context.rs` 与 `prompts/src/model_messages.rs` 均按 `codex-rs/<crate>/` → `mini-codex-rs/crates/<crate>/` 映射。当前 fragment 适配为普通 developer Message，不提供 envelope content kind。窗口名称固定为 root，不接 thread hint；`use_history_notes_extension = true` 显式拒绝。
