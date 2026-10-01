## Start with the next request {#context-start}

Function Calling explained how a model invokes tools. Now follow the result: where is it stored, what survives the next user turn, and what happens when the window fills?

Our example starts with “Read README and explain how to start the project”, followed by “Check the startup script too”. Follow the messages first, then the functions. Context is structured information assembled by the harness for each request.

This chapter describes the current mini-codex implementation against the local Codex source. Short texts and token counts in the animations are illustrative, not measurements from a live service.

## Three parts of model context {#context-prompt}

Prompt.instructions contains entry-point instructions, Prompt.tools contains visible tool specifications, and Prompt.input contains normalized history. parallel_tool_calls is an option, not a history message.

The transcript differs from the request. OutputTextDelta updates the display; complete ResponseItems from OutputItemDone enter history. Recording every delta as a message would duplicate content.

`crates/core/src/session/turn.rs` · run_turn

```rust
let prompt: Prompt = Prompt {
    input: session.history.lock().await.clone().for_prompt(),
    tools: session.tool_router.model_visible_specs().to_vec(),
    parallel_tool_calls: true,
    instructions: session.instructions.clone(),
};
```

## A conversation: append, execute, replay {#context-chain}

Session::spawn initializes ContextManager with environment_context. TokenBudget adds window identity and optional guidance. First consider the default path with that feature disabled.

run_turn emits TurnStarted, checks existing history, records the incoming user message, then prepares a request with clone().for_prompt(). On function_call, it records the call before enqueuing its future in FuturesOrdered.

response.completed updates usage. Tool results are drained in enqueue order and recorded as FunctionCallOutput with the matching call_id. needs_follow_up keeps the loop sampling. The completed assistant answer enters history too.

The next user turn appends to the same Session. Earlier information is available because history is replayed in the next request. Sending only the new sentence would not reproduce this behavior.

::ContextTrace{id="conversation"}

## History stores protocol objects {#context-history}

ContextManager stores Vec<ResponseItem>: messages, calls, outputs, reasoning, search items, and compaction. tool_call / tool_result in the diagrams are display aliases, not JSON type values.

record_items filters system, Other, and CompactionTrigger items and applies output truncation. for_prompt consumes a copy, repairs missing outputs, then removes orphan outputs. Synthetic aborted results do not overwrite active history.

`crates/core/src/context_manager/history.rs` · for_prompt

```rust
pub(crate) fn for_prompt(mut self) -> Vec<ResponseItem> {
    normalize::ensure_call_outputs_present(&mut self.items);
    normalize::remove_orphan_outputs(&mut self.items);
    self.items
}
```

## Repair missing results, remove orphans {#context-normalize}

If call c1 lacks a result, normalization inserts an aborted output after it. This closes the input chain without executing a tool again or asserting success. Missing search outputs become completed client results with empty tools.

An orphan output without its matching call is removed. Named external outputs with no call_id and server-executed search outputs are exceptions.

Insertions run in reverse index order. Calls with IDs receive stable synthetic result IDs from the upstream UUID v5 namespace.

::ContextTrace{id="normalize"}

## truncation_policy: truncate outputs on write {#context-truncate}

This field applies in history.record_items to FunctionCallOutput bodies. It is not an auto-compaction switch and does not uniformly trim every user or assistant message. Exec output limits are an earlier, separate stage.

The current default is Bytes(10_000), with a 20% serialization allowance: approximately 12,000 bytes of body budget. Middle truncation preserves both ends on UTF-8 boundaries. The marker itself can make the final output slightly longer.

Local compaction uses a separate 20,000-token user-message budget; Remote V2 retains messages within 64,000 tokens. These are different from truncation_policy.

## Five model fields and their roles {#context-model-fields}

ModelInfo comes from the catalog with configuration overrides. Unknown models do not inherit the DeepSeek window. The current resolver uses context_window.or(max_context_window), so max_context_window is a fallback here, not an additional min clamp.

auto_compact_token_limit() takes the smaller of the explicit limit and 90% of the resolved window. usable_context_window() applies effective_context_window_percent to compute the full usable cap.

| Field | Current role |
| --- | --- |
| context_window | Preferred context capacity |
| max_context_window | Fallback when context_window is absent |
| auto_compact_token_limit | Early automatic compaction threshold |
| effective_context_window_percent | Usable percentage of full capacity; default 95 |
| truncation_policy | Function-output budget during history recording |

## 95% reserves headroom {#context-margin}

For a 100,000-token window at 95%, the usable cap is 95,000. Without a lower configured limit, automatic compaction begins at 90,000 rather than waiting for 95,000.

Headroom makes checks conservative because local estimates may omit overhead. An illustrative 94,000-token estimate plus 2,000 tokens of extra overhead stays below the nominal 100,000 capacity. This explains the margin, not a guarantee against overflow.

Local text estimates use roughly one token per four UTF-8 bytes, rounded up. They are not tokenizer counts. Server usage calibrates observed content; unsent tool outputs still need estimates.

## Server usage plus new content {#context-usage}

client.rs reads usage from response.completed. TokenUsageInfo stores cumulative total_token_usage and latest last_token_usage. Window checks use the latest response: summing every request would count replayed history repeatedly.

get_total_token_usage combines the latest reported total_tokens with estimates after the last model-generated item. Without x-reasoning-included, it also estimates older encrypted reasoning before the latest real user boundary. The header is checked for presence.

Example: server usage 1,000 plus a two-token tool result gives 1,002. A later response reports 1,200, replacing the baseline. Cumulative usage is 2,200, but that is not the current window size.

After compaction, recompute_token_usage estimates the new history plus base instructions while retaining cumulative usage. Missing usage follows the upstream zero-baseline and tail rules, not a full-history fallback.

::ContextTrace{id="usage"}

## When to compact, which route to choose {#context-when}

context_window_token_status checks limits. run_turn checks before recording the incoming user message, then again after tool results when needs_follow_up is true. It does not compact after a final answer.

run_auto_compact selects the route: TokenBudget first, returning after rollover; otherwise RemoteCompactionSupport::V2 or Unsupported. These are alternatives, not three stages or a V2-to-local failure ladder.

Configured providers follow the upstream OpenAI name and Azure name/URL detection rules. Changing the model name alone does not grant V2 capability.

| Flag / capability | Route |
| --- | --- |
| TokenBudget enabled; any provider | Fresh context window |
| TokenBudget disabled; V2 supported | Remote V2 compaction |
| TokenBudget disabled; V2 unsupported | Local summary compaction |

`crates/core/src/session/turn.rs` · run_auto_compact

```rust
if session.config.features.enabled(mini_codex_features::Feature::TokenBudget) {
    return crate::compact_token_budget::run_inline_auto_compact_task(session, injection).await;
}
```

## Local compaction: summarize, then rebuild {#context-local}

run_compact_task_inner_impl reads model info and clones history. SUMMARIZATION_PROMPT is appended as a user message only to the copy. The translated Chinese instruction asks for a handoff with progress, decisions, constraints, next steps, and critical references.

The summary request uses normalized copy input, unchanged instructions, no tools, and parallel_tool_calls=false. drain_to_completed calls the current model, records completed output items into live history, ignores deltas, and waits for Completed.

It then extracts the last assistant text from a history snapshot, prefixes it with SUMMARY_PREFIX, collects real users, builds replacement history, reinjects the environment where needed, installs history, and recomputes usage.

::ContextTrace{id="local"}

## What does collect_annotated_user_messages retain? {#context-collect}

The iterator scans items. user_message(item)? accepts user Message text and excludes environment_context. Inside filter_map, ? means skip this item, not fail the compaction task.

is_summary_message excludes prior prefixed summaries. Remaining IDs and texts become CompactedUserMessage values. mini-codex does not yet implement the full upstream envelope metadata.

This function neither truncates nor summarizes. It retains original user intent. Assistant messages and tool items are absent from the list; their useful information may survive in the generated summary.

`crates/core/src/compact.rs` · collect_annotated_user_messages

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

## The exact shape after local compaction {#context-rebuild}

build_compacted_history selects users newest-first within 20,000 estimated tokens, truncates a boundary message when necessary, reverses the selection, and appends a user-role summary. The retained-user budget excludes the summary itself.

An illustrative [env, user1, call1, result1, assistant1, user2, call2, result2] becomes [user1, env, user2, user(summary)] mid-turn. The summary is not an assistant message.

With DoNotInject, pre-turn compaction initially creates [user1, user2, user(summary)]; run_turn then appends environment and the incoming user. BeforeLastUserMessage inserts the environment before the latest real user, or before the summary when none exists.

## Remote V2: how the request signals compaction {#context-remote}

The signal is not compact=true or a summary prompt. run_remote_compact_v2_attempt appends ResponseItem::CompactionTrigger, serialized as type=compaction_trigger, to normal Responses input with current instructions and tools.

Before sending, it rewrites only contiguous trailing tool outputs within the usable window, stopping at a non-output item. The server returns a compaction item with encrypted_content. The client replays it without decrypting.

Collection requires response.completed and exactly one Compaction. Only validated complete output is installed. Real users are retained newest-first within 64,000 estimated tokens, with the encrypted item appended last.

Compaction usage and response ID travel with the attempt but do not become the replacement history baseline or persisted metadata in this subset. Installation recomputes the baseline.

::ContextTrace{id="remote"}

## TokenBudget: install a fresh window {#context-budget}

TokenBudget requests neither local summarization nor server compaction. start_new_context_window advances identity, resets reminder/fallback flags, rebuilds environment and developer metadata, replaces history, then recomputes usage.

The first/current IDs are recorded initially; later windows also include previous ID while preserving first ID. Session instructions remain. Old users, assistants, calls, and outputs are cleared with no hidden summary.

Pre-turn rollover appends the new user message afterward. Mid-turn rollover resumes with initial context only, clearing the old task too. Upstream has persistence extensions; this mini-codex subset does not promise cross-window task continuity.

::ContextTrace{id="budget"}

## Configure reminders and a fallback buffer {#context-budget-config}

The file is $MINI_CODEX_HOME/config.toml, defaulting to ~/.mini-codex/config.toml. Enable with token_budget=true under [features], or use the detailed table below. Do not declare the same key twice. Window values are illustrative.

reminder_threshold_tokens is remaining capacity, not window size. maybe_record runs after sampling and collecting tools, once per window. A fallback prompt is recorded at zero remaining base tokens when rollover is not yet forced.

With a 90,000 automatic limit, 2,000 buffer, and 95,000 full cap, wrap-up can happen at 90,000 and rollover is forced at 92,000. The full cap always wins if reached earlier.

Enabling the feature without any model or configured limit does not trigger automatic rollover. The unsupported history/notes extension is explicitly rejected.

`config.toml · 示例 / example`

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

## Failure and installation boundaries {#context-failure}

Local summarization records completed output items before installing replacement history. A later failure prevents installation but does not roll back every write. Pre-turn failure still records incoming input before Error.

Remote V2 holds partial output in the attempt. Incomplete or invalid output never replaces history. Stream closure may retry up to twice within provider limits; missing or duplicate Compaction is Fatal. Unclassified HTTP/SSE errors return directly.

TokenBudget has no summarization request. This subset also omits upstream hooks, cancellation, and persisted checkpoints.

## Read it again with breakpoints {#context-practice}

Start at Session::spawn, then follow record_items and clone().for_prompt() in run_turn. Inspect history.rs for boundaries and normalize.rs for pairing repairs.

Experiment 1: scripted usage 2100, limit 1000. With TokenBudget off and V2 unsupported, inspect the summary request. Turn TokenBudget on and verify no extra request, old messages removed, and previous window ID present.

Experiment 2: server 1000 plus a two-token tool output gives 1002; the next reported 1200 replaces the baseline while cumulative usage reaches 2200. Experiment 3: remove c1 output and add an orphan, then compare raw history with the normalized copy.

Use tool_harness.rs, history_tests.rs, compact_tests.rs, compact_remote_v2_tests.rs, auto_compact_window_tests.rs, and config_tests.rs. These validate offline behavior, not live service capabilities.

## Implementation boundaries {#context-limits}

Implemented: structured history, truncation, pairing repair, server usage plus tail estimates, Chinese local summaries, Remote V2, and automatic TokenBudget rollover with reminders and a fallback buffer.

Omitted: full SessionState/envelopes, prefix scope, post-turn compaction, model-owned defaults, subscription experiments, persistent history/notes, explicit rollover tools, manual /compact, lifecycle events and hooks, media, cancellation, and rollout recovery. Window identity lives in a Session Mutex; reminders make no persistence promise.

The source button opens the code included in this build. See the repository tutorial for source mappings and explicit deviations.
