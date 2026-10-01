use super::run_remote_compaction_request_v2;
use crate::compact_remote_history::trim_function_call_history_to_fit_context_window;
use crate::{Prompt, session::Session};
use anyhow::Result;
use mini_codex_protocol::models::ResponseItem;
use std::sync::Arc;
pub(super) struct RemoteCompactV2Attempt {
    pub(super) prompt_input: Vec<ResponseItem>,
    pub(super) compaction_output: ResponseItem,
    pub(super) compaction_response_id: String,
    pub(super) token_usage: Option<mini_codex_protocol::TokenUsage>,
}
pub(super) async fn run_remote_compact_v2_attempt(
    sess: &Arc<Session>,
) -> Result<RemoteCompactV2Attempt> {
    let mut history = sess.history.lock().await.clone();
    let model_info = sess.model_info().await;
    trim_function_call_history_to_fit_context_window(
        &mut history,
        model_info.usable_context_window(),
        &sess.instructions,
    );
    let mut input = history.for_prompt();
    input.push(ResponseItem::CompactionTrigger {});
    let prompt = Prompt {
        input,
        tools: sess.tool_router.model_visible_specs().to_vec(),
        parallel_tool_calls: true,
        instructions: sess.instructions.clone(),
    };
    let result = run_remote_compaction_request_v2(sess, &prompt).await?;
    let mut prompt_input = prompt.input;
    prompt_input.pop();
    Ok(RemoteCompactV2Attempt {
        prompt_input,
        compaction_output: result.compaction_output,
        compaction_response_id: result.response_id,
        token_usage: result.token_usage,
    })
}
