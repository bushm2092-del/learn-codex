use crate::context_manager::{ContextManager, estimate_item_token_count};
use mini_codex_protocol::models::{
    FunctionCallOutputBody, FunctionCallOutputPayload, ResponseItem,
};
use mini_codex_utils_output_truncation::approx_token_count;
const CONTEXT_WINDOW_TRUNCATED_OUTPUT_MESSAGE: &str =
    "Output exceeded the available model context and was truncated";

// 当前文本协议没有附属图片 notice；每个历史项对应上游一个 HistoryItemGroup。
pub(crate) fn trim_function_call_history_to_fit_context_window(
    history: &mut ContextManager,
    context_window: Option<i64>,
    instructions: &str,
) -> (usize, i64) {
    let Some(context_window) = context_window else {
        return (0, 0);
    };
    let base_tokens = i128::try_from(approx_token_count(instructions)).unwrap_or(i128::MAX);
    let original_items = history.raw_items();
    let mut estimated_tokens = original_items
        .iter()
        .map(|item| i128::from(estimate_item_token_count(item)))
        .fold(base_tokens, i128::saturating_add);
    let initial_estimated_tokens = i64::try_from(estimated_tokens).unwrap_or(i64::MAX);
    let mut rewritten_items = Vec::new();
    let mut consumed_items: usize = 0;
    for item in original_items.iter().rev() {
        if i64::try_from(estimated_tokens).unwrap_or(i64::MAX) <= context_window {
            break;
        }
        let Some(rewritten_item) = rewritten_output_for_context_window(item) else {
            break;
        };
        estimated_tokens = estimated_tokens
            .saturating_sub(i128::from(estimate_item_token_count(item)))
            .saturating_add(i128::from(estimate_item_token_count(&rewritten_item)));
        consumed_items += 1;
        rewritten_items.push(rewritten_item);
    }
    let rewritten_outputs = rewritten_items.len();
    if rewritten_outputs > 0 {
        let retained_len = original_items.len() - consumed_items;
        let mut items = original_items[..retained_len].to_vec();
        items.extend(rewritten_items.into_iter().rev());
        history.replace(items);
    }
    let final_estimated_tokens = i64::try_from(estimated_tokens).unwrap_or(i64::MAX);
    (
        rewritten_outputs,
        initial_estimated_tokens.saturating_sub(final_estimated_tokens),
    )
}
fn rewritten_output_for_context_window(item: &ResponseItem) -> Option<ResponseItem> {
    Some(match item {
        ResponseItem::FunctionCallOutput {
            id,
            call_id,
            name,
            namespace,
            output,
        } => ResponseItem::FunctionCallOutput {
            id: id.clone(),
            call_id: call_id.clone(),
            name: name.clone(),
            namespace: namespace.clone(),
            output: truncated_output_payload(output),
        },
        ResponseItem::ToolSearchOutput {
            id,
            call_id,
            status,
            execution,
            ..
        } => ResponseItem::ToolSearchOutput {
            id: id.clone(),
            call_id: call_id.clone(),
            status: status.clone(),
            execution: execution.clone(),
            tools: Vec::new(),
        },
        _ => return None,
    })
}
fn truncated_output_payload(output: &FunctionCallOutputPayload) -> FunctionCallOutputPayload {
    FunctionCallOutputPayload {
        body: FunctionCallOutputBody::Text(CONTEXT_WINDOW_TRUNCATED_OUTPUT_MESSAGE.into()),
        success: output.success,
    }
}
#[cfg(test)]
#[path = "compact_remote_history_tests.rs"]
mod tests;
