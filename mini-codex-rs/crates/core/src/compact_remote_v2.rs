use crate::compact::{
    InitialContextInjection, insert_initial_context_before_last_real_user_or_summary, user_message,
};
use crate::responses_retry::{ResponsesStreamRetryState, handle_response_stream_error};
use crate::session::world_state::initial_world_state;
use crate::{Prompt, ResponseEvent, ResponseStream, session::Session};
use anyhow::Result;
use futures::StreamExt;
use mini_codex_protocol::error::CodexErr;
use mini_codex_protocol::models::{ContentItem, ResponseItem};
use mini_codex_utils_output_truncation::{TruncationPolicy, approx_token_count, truncate_text};
use std::sync::Arc;
#[path = "compact_remote_v2_attempt.rs"]
mod attempt;
use attempt::run_remote_compact_v2_attempt;
pub(crate) const RETAINED_MESSAGE_TOKEN_BUDGET: usize = 64_000;
const MAX_REMOTE_COMPACTION_V2_STREAM_RETRIES: u64 = 2;
struct RemoteCompactionV2Output {
    compaction_output: ResponseItem,
    response_id: String,
    token_usage: Option<mini_codex_protocol::TokenUsage>,
}

pub(crate) async fn run_inline_remote_auto_compact_task(
    sess: Arc<Session>,
    injection: InitialContextInjection,
) -> Result<()> {
    run_remote_compact_task_inner_impl(&sess, injection).await
}
async fn run_remote_compact_task_inner_impl(
    sess: &Arc<Session>,
    injection: InitialContextInjection,
) -> Result<()> {
    let attempt = run_remote_compact_v2_attempt(sess).await?;
    let _compaction_usage = attempt.token_usage;
    let _compaction_response_id = attempt.compaction_response_id;
    let mut new_history =
        build_v2_compacted_history(attempt.prompt_input, attempt.compaction_output);
    if matches!(injection, InitialContextInjection::BeforeLastUserMessage) {
        new_history = insert_initial_context_before_last_real_user_or_summary(
            new_history,
            initial_world_state(&sess.cwd, &sess.user_shell()),
        );
    }
    // 只有完整响应且结构校验成功才安装历史；失败不写入局部压缩输出。
    sess.history.lock().await.replace(new_history);
    sess.recompute_token_usage().await;
    Ok(())
}
async fn run_remote_compaction_request_v2(
    sess: &Session,
    prompt: &Prompt,
) -> Result<RemoteCompactionV2Output> {
    let max_retries = sess
        .config
        .model_provider
        .stream_max_retries()
        .min(MAX_REMOTE_COMPACTION_V2_STREAM_RETRIES);
    let mut retry_state = ResponsesStreamRetryState::default();
    loop {
        let model = sess.settings.lock().await.model.clone();
        let result = match sess.model_client.stream(prompt.clone(), model).await {
            Ok(stream) => collect_compaction_output(stream).await,
            Err(err) => Err(err),
        };
        match result {
            Ok(output) => return Ok(output),
            Err(err) => handle_response_stream_error(&mut retry_state, max_retries, err).await?,
        }
    }
}
async fn collect_compaction_output(mut stream: ResponseStream) -> Result<RemoteCompactionV2Output> {
    let mut output_item_count = 0usize;
    let mut compaction_count = 0usize;
    let mut compaction_output = None;
    let mut completed_response_id = None;
    let mut completed_token_usage = None;
    while let Some(event) = stream.next().await {
        match event? {
            ResponseEvent::OutputItemDone(item) => {
                output_item_count += 1;
                if let ResponseItem::Compaction { .. } = item {
                    compaction_count += 1;
                    if compaction_output.is_none() {
                        compaction_output = Some(item);
                    }
                }
            }
            ResponseEvent::Completed {
                response_id,
                token_usage,
            } => {
                completed_response_id = Some(response_id);
                completed_token_usage = token_usage;
                break;
            }
            ResponseEvent::OutputTextDelta(_) | ResponseEvent::ServerReasoningIncluded(_) => {}
        }
    }
    let Some(response_id) = completed_response_id else {
        return Err(CodexErr::Stream(
            "remote compaction v2 stream closed before response.completed".into(),
        )
        .into());
    };
    if compaction_count != 1 {
        return Err(CodexErr::Fatal(format!("remote compaction v2 expected exactly one compaction output item, got {compaction_count} from {output_item_count} output items")).into());
    }
    Ok(RemoteCompactionV2Output {
        compaction_output: compaction_output.expect("one compaction output"),
        response_id,
        token_usage: completed_token_usage,
    })
}
fn build_v2_compacted_history(input: Vec<ResponseItem>, output: ResponseItem) -> Vec<ResponseItem> {
    let retained = input
        .into_iter()
        .filter(is_retained_for_remote_compaction_v2)
        .collect();
    let mut retained = truncate_retained_messages(retained, RETAINED_MESSAGE_TOKEN_BUDGET);
    retained.push(output);
    retained
}
fn is_retained_for_remote_compaction_v2(item: &ResponseItem) -> bool {
    user_message(item).is_some_and(|text| !text.starts_with(mini_codex_prompts::SUMMARY_PREFIX))
}
fn truncate_retained_messages(items: Vec<ResponseItem>, max_tokens: usize) -> Vec<ResponseItem> {
    let mut remaining = max_tokens;
    let mut truncated_reversed = Vec::with_capacity(items.len());
    for item in items.into_iter().rev() {
        if remaining == 0 {
            continue;
        }
        let token_count = message_text_token_count(&item).max(1);
        if token_count <= remaining {
            truncated_reversed.push(item);
            remaining = remaining.saturating_sub(token_count);
        } else {
            let Some(item) = truncate_message_text_to_token_budget(item, remaining) else {
                continue;
            };
            truncated_reversed.push(item);
            remaining = 0;
        }
    }
    truncated_reversed.reverse();
    truncated_reversed
}
fn message_text_token_count(item: &ResponseItem) -> usize {
    let ResponseItem::Message { content, .. } = item else {
        return usize::try_from(crate::context_manager::estimate_item_token_count(item))
            .unwrap_or(usize::MAX);
    };
    content
        .iter()
        .map(|item| match item {
            ContentItem::InputText { text } | ContentItem::OutputText { text } => {
                approx_token_count(text)
            }
        })
        .sum()
}
fn truncate_message_text_to_token_budget(
    mut item: ResponseItem,
    max_tokens: usize,
) -> Option<ResponseItem> {
    let ResponseItem::Message { content, .. } = &mut item else {
        return None;
    };
    let mut remaining = max_tokens;
    let mut truncated_content = Vec::with_capacity(content.len());
    for mut content_item in std::mem::take(content) {
        let text = match &mut content_item {
            ContentItem::InputText { text } | ContentItem::OutputText { text } => text,
        };
        if remaining == 0 {
            continue;
        }
        let token_count = approx_token_count(text);
        if token_count <= remaining {
            remaining = remaining.saturating_sub(token_count);
        } else {
            *text = truncate_text(text, TruncationPolicy::Tokens(remaining));
            remaining = 0;
        }
        if !text.is_empty() {
            truncated_content.push(content_item);
        }
    }
    if truncated_content.is_empty() {
        return None;
    }
    *content = truncated_content;
    Some(item)
}
#[cfg(test)]
#[path = "compact_remote_v2_tests.rs"]
mod tests;
