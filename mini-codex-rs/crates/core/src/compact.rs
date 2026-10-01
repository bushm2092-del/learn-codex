use crate::session::Session;
use crate::session::turn::get_last_assistant_message_from_turn;
use crate::session::world_state::initial_world_state;
use crate::{Prompt, ResponseEvent};
use anyhow::Result;
use futures::StreamExt;
use mini_codex_prompts::{SUMMARIZATION_PROMPT, SUMMARY_PREFIX};
use mini_codex_protocol::models::{ContentItem, ResponseItem};
use mini_codex_utils_output_truncation::{TruncationPolicy, approx_token_count, truncate_text};
use std::sync::Arc;
const COMPACT_USER_MESSAGE_MAX_TOKENS: usize = 20_000;

pub(crate) enum InitialContextInjection {
    DoNotInject,
    BeforeLastUserMessage,
}

pub(crate) async fn run_inline_auto_compact_task(
    sess: Arc<Session>,
    injection: InitialContextInjection,
) -> Result<()> {
    run_compact_task_inner_impl(sess, injection).await
}
async fn run_compact_task_inner_impl(
    sess: Arc<Session>,
    injection: InitialContextInjection,
) -> Result<()> {
    let model_info = sess.model_info().await;
    let mut history = sess.history.lock().await.clone();
    history.record_items(
        &[ResponseItem::Message {
            id: None,
            role: "user".to_string(),
            content: vec![ContentItem::InputText {
                text: SUMMARIZATION_PROMPT.to_string(),
            }],
            phase: None,
        }],
        model_info.truncation_policy,
    );
    let prompt = Prompt {
        input: history.for_prompt(),
        instructions: sess.instructions.clone(),
        tools: Vec::new(),
        parallel_tool_calls: false,
    };
    drain_to_completed(&sess, prompt).await?;

    let history_snapshot = sess.history.lock().await.clone();

    let summary_suffix =
        get_last_assistant_message_from_turn(history_snapshot.raw_items()).unwrap_or_default();

    let summary_text = format!("{SUMMARY_PREFIX}\n{summary_suffix}");

    let user_messages = collect_annotated_user_messages(history_snapshot.raw_items());

    let mut new_history = build_compacted_history(Vec::new(), &user_messages, &summary_text);

    if matches!(injection, InitialContextInjection::BeforeLastUserMessage) {
        new_history = insert_initial_context_before_last_real_user_or_summary(
            new_history,
            initial_world_state(&sess.cwd, &sess.user_shell()),
        );
    }

    sess.history.lock().await.replace(new_history);

    sess.recompute_token_usage().await;

    Ok(())
}

#[derive(Clone)]
struct CompactedUserMessage {
    id: Option<String>,
    message: String,
}
pub(crate) fn user_message(item: &ResponseItem) -> Option<String> {
    let ResponseItem::Message { role, content, .. } = item else {
        return None;
    };
    if role != "user" {
        return None;
    }
    // 当前本地环境上下文没有上游 fragment metadata，按固定环境标签排除。
    let message = content
        .iter()
        .map(|part| match part {
            ContentItem::InputText { text } | ContentItem::OutputText { text } => text.as_str(),
        })
        .collect::<Vec<_>>()
        .join("\n");
    if content.iter().any(|part| {
        let text = match part {
            ContentItem::InputText { text } | ContentItem::OutputText { text } => text,
        };
        text.trim_start()
            .get(.."<environment_context>".len())
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("<environment_context>"))
    }) {
        return None;
    }
    Some(message)
}
fn collect_annotated_user_messages(items: &[ResponseItem]) -> Vec<CompactedUserMessage> {
    items
        .iter()
        .filter_map(|item| {
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
        })
        .collect()
}
pub(crate) fn is_summary_message(message: &str) -> bool {
    message.starts_with(format!("{SUMMARY_PREFIX}\n").as_str())
}
pub(crate) fn insert_initial_context_before_last_real_user_or_summary(
    mut history: Vec<ResponseItem>,
    initial: Vec<ResponseItem>,
) -> Vec<ResponseItem> {
    let mut last_user_or_summary_index = None;
    let mut last_real_user_index = None;
    for (i, item) in history.iter().enumerate().rev() {
        let Some(message) = user_message(item) else {
            continue;
        };
        last_user_or_summary_index.get_or_insert(i);
        if !is_summary_message(&message) {
            last_real_user_index = Some(i);
            break;
        }
    }
    if let Some(index) = last_real_user_index.or(last_user_or_summary_index) {
        history.splice(index..index, initial);
    } else {
        history.extend(initial);
    }
    history
}
fn build_compacted_history(
    initial: Vec<ResponseItem>,
    messages: &[CompactedUserMessage],
    summary: &str,
) -> Vec<ResponseItem> {
    build_compacted_history_with_limit(initial, messages, summary, COMPACT_USER_MESSAGE_MAX_TOKENS)
}
fn build_compacted_history_with_limit(
    mut history: Vec<ResponseItem>,
    messages: &[CompactedUserMessage],
    summary: &str,
    max_tokens: usize,
) -> Vec<ResponseItem> {
    let mut selected_messages = Vec::new();
    if max_tokens > 0 {
        let mut remaining = max_tokens;
        for message in messages.iter().rev() {
            if remaining == 0 {
                break;
            }
            let tokens = approx_token_count(&message.message);
            if tokens <= remaining {
                selected_messages.push(message.clone());
                remaining = remaining.saturating_sub(tokens);
            } else {
                selected_messages.push(CompactedUserMessage {
                    id: message.id.clone(),
                    message: truncate_text(&message.message, TruncationPolicy::Tokens(remaining)),
                });
                break;
            }
        }
        selected_messages.reverse();
    }
    for message in &selected_messages {
        history.push(ResponseItem::Message {
            id: message.id.clone(),
            role: "user".to_string(),
            content: vec![ContentItem::InputText {
                text: message.message.clone(),
            }],
            phase: None,
        });
    }
    let summary = if summary.is_empty() {
        "(no summary available)"
    } else {
        summary
    };
    history.push(ResponseItem::Message {
        id: None,
        role: "user".to_string(),
        content: vec![ContentItem::InputText {
            text: summary.to_string(),
        }],
        phase: None,
    });
    history
}
async fn drain_to_completed(sess: &Session, prompt: Prompt) -> Result<()> {
    let model = sess.settings.lock().await.model.clone();
    let mut stream = sess.model_client.stream(prompt, model).await?;
    loop {
        let Some(event) = stream.next().await else {
            anyhow::bail!("stream closed before response.completed");
        };
        match event? {
            ResponseEvent::OutputItemDone(item) => {
                let policy = sess.model_info().await.truncation_policy;
                sess.history.lock().await.record_items(&[item], policy);
            }
            ResponseEvent::Completed { token_usage, .. } => {
                sess.update_token_usage_info(token_usage.as_ref()).await;
                return Ok(());
            }
            ResponseEvent::ServerReasoningIncluded(included) => {
                sess.set_server_reasoning_included(included)
            }
            ResponseEvent::OutputTextDelta(_) => {}
        }
    }
}

#[cfg(test)]
#[path = "compact_tests.rs"]
mod tests;
