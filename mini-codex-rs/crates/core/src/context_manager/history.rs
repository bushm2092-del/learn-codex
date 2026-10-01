use super::normalize;
use mini_codex_protocol::DEFAULT_FUNCTION_NAMESPACE;
use mini_codex_protocol::models::{
    ContentItem, FunctionCallOutputBody, FunctionCallOutputContentItem, ResponseItem,
};
use mini_codex_protocol::{TokenUsage, TokenUsageInfo};
use mini_codex_utils_output_truncation::{
    TruncationPolicy, approx_token_count, approx_tokens_from_byte_count_i64,
    truncate_function_output_payload, with_serialization_allowance,
};

#[derive(Clone, Debug, Default)]
pub(crate) struct ContextManager {
    items: Vec<ResponseItem>,
    token_info: Option<mini_codex_protocol::TokenUsageInfo>,
}

impl ContextManager {
    pub(crate) fn update_token_info(
        &mut self,
        usage: &TokenUsage,
        model_context_window: Option<i64>,
    ) {
        self.token_info = TokenUsageInfo::new_or_append(
            &self.token_info,
            &Some(usage.clone()),
            model_context_window,
        );
    }

    fn get_non_last_reasoning_items_tokens(&self) -> i64 {
        // 只补算最后一次真实用户边界之前的加密 reasoning。
        let Some(last_user_index) = self
            .items
            .iter()
            .rposition(|item| is_user_turn_boundary(item))
        else {
            return 0;
        };

        self.items
            .iter()
            .take(last_user_index)
            .filter(|item| {
                matches!(
                    item,
                    ResponseItem::Reasoning {
                        encrypted_content: Some(_),
                        ..
                    }
                )
            })
            .map(|item| estimate_item_token_count(item))
            .fold(0i64, i64::saturating_add)
    }

    // 最新模型输出之后的本地新增项尚未计入服务端 last_token_usage。
    fn items_after_last_model_generated_item(
        &self,
    ) -> impl Clone + ExactSizeIterator<Item = &ResponseItem> + DoubleEndedIterator {
        let start = self
            .items
            .iter()
            .rposition(|item| is_model_generated_item(item))
            .map_or(self.items.len(), |index: usize| index.saturating_add(1));
        self.items[start..].iter()
    }

    // 服务端已计入历史 reasoning 时，不重复补算。
    pub(crate) fn get_total_token_usage(&self, server_reasoning_included: bool) -> i64 {
        let last_tokens = self
            .token_info
            .as_ref()
            .map(|info| info.last_token_usage.total_tokens)
            .unwrap_or(0);
        let items_after_last_model_generated_tokens = self
            .items_after_last_model_generated_item()
            .map(estimate_item_token_count)
            .fold(0i64, i64::saturating_add);
        if server_reasoning_included {
            last_tokens.saturating_add(items_after_last_model_generated_tokens)
        } else {
            last_tokens
                .saturating_add(self.get_non_last_reasoning_items_tokens())
                .saturating_add(items_after_last_model_generated_tokens)
        }
    }

    pub(crate) fn token_info(&self) -> Option<mini_codex_protocol::TokenUsageInfo> {
        self.token_info.clone()
    }
    pub(crate) fn set_token_info(&mut self, info: Option<mini_codex_protocol::TokenUsageInfo>) {
        self.token_info = info;
    }

    pub(crate) fn with_items(items: Vec<ResponseItem>) -> Self {
        Self {
            items,
            token_info: None,
        }
    }
    pub(crate) fn record_items(&mut self, items: &[ResponseItem], policy: TruncationPolicy) {
        for item in items {
            if !is_api_message(item) {
                continue;
            }
            let mut processed = item.clone();
            if let ResponseItem::FunctionCallOutput { output, .. } = &mut processed {
                truncate_function_output_payload(output, with_serialization_allowance(policy));
            }
            self.items.push(processed);
        }
    }
    // 在副本上整理模型输入，不把补齐项写回原始历史。
    pub(crate) fn for_prompt(mut self) -> Vec<ResponseItem> {
        normalize::ensure_call_outputs_present(&mut self.items);
        normalize::remove_orphan_outputs(&mut self.items);
        self.items
    }
    pub(crate) fn raw_items(&self) -> &[ResponseItem] {
        &self.items
    }
    pub(crate) fn replace(&mut self, items: Vec<ResponseItem>) {
        self.items = items;
    }
    pub(crate) fn estimate_token_count_with_base_instructions(
        &self,
        instructions: &str,
    ) -> Option<i64> {
        let base_tokens = i64::try_from(approx_token_count(instructions)).unwrap_or(i64::MAX);
        let items_tokens = self
            .items
            .iter()
            .map(estimate_item_token_count)
            .fold(0i64, i64::saturating_add);
        Some(base_tokens.saturating_add(items_tokens))
    }
}

fn is_api_message(item: &ResponseItem) -> bool {
    match item {
        ResponseItem::Message { role, .. } => role != "system",
        ResponseItem::Other | ResponseItem::CompactionTrigger {} => false,
        ResponseItem::FunctionCall { .. }
        | ResponseItem::FunctionCallOutput { .. }
        | ResponseItem::Compaction { .. }
        | ResponseItem::Reasoning { .. }
        | ResponseItem::ToolSearchCall { .. }
        | ResponseItem::ToolSearchOutput { .. } => true,
    }
}
fn text_bytes(text: &str) -> i64 {
    i64::try_from(text.len()).unwrap_or(i64::MAX)
}
fn json_content_bytes(value: &impl serde::Serialize) -> i64 {
    serde_json::to_vec(value)
        .map(|value| i64::try_from(value.len()).unwrap_or(i64::MAX))
        .unwrap_or_default()
}
fn estimate_reasoning_length(encoded_len: usize) -> usize {
    encoded_len
        .saturating_mul(3)
        .checked_div(4)
        .unwrap_or(0)
        .saturating_sub(650)
}
fn estimate_function_output_bytes(output: &FunctionCallOutputBody) -> i64 {
    match output {
        FunctionCallOutputBody::Text(text) => text_bytes(text),
        FunctionCallOutputBody::ContentItems(items) => items
            .iter()
            .map(|part| match part {
                FunctionCallOutputContentItem::InputText { text } => text_bytes(text),
            })
            .fold(0i64, i64::saturating_add),
    }
}
pub(crate) fn estimate_item_token_count(item: &ResponseItem) -> i64 {
    let model_visible_bytes = estimate_response_item_model_visible_bytes(item);
    approx_tokens_from_byte_count_i64(model_visible_bytes)
}

fn estimate_response_item_model_visible_bytes(item: &ResponseItem) -> i64 {
    match item {
        ResponseItem::Message { content, .. } => content
            .iter()
            .map(|part| match part {
                ContentItem::InputText { text } | ContentItem::OutputText { text } => {
                    text_bytes(text)
                }
            })
            .fold(0i64, i64::saturating_add),
        ResponseItem::Reasoning {
            encrypted_content: Some(content),
            ..
        }
        | ResponseItem::Compaction {
            encrypted_content: content,
            ..
        } => i64::try_from(estimate_reasoning_length(content.len())).unwrap_or(i64::MAX),
        ResponseItem::FunctionCall {
            name,
            namespace,
            arguments,
            ..
        } => text_bytes(name)
            .saturating_add(text_bytes(
                namespace.as_deref().unwrap_or(DEFAULT_FUNCTION_NAMESPACE),
            ))
            .saturating_add(text_bytes(arguments)),
        ResponseItem::FunctionCallOutput {
            call_id,
            name,
            namespace,
            output,
            ..
        } => estimate_function_output_bytes(&output.body)
            .saturating_add(text_bytes(call_id.as_deref().unwrap_or_default()))
            .saturating_add(text_bytes(name.as_deref().unwrap_or_default()))
            .saturating_add(text_bytes(namespace.as_deref().unwrap_or_default())),
        ResponseItem::ToolSearchCall { arguments, .. } => json_content_bytes(arguments),
        ResponseItem::ToolSearchOutput { tools, .. } => json_content_bytes(tools),
        ResponseItem::Reasoning {
            encrypted_content: None,
            ..
        }
        | ResponseItem::Other
        | ResponseItem::CompactionTrigger {} => 0,
    }
}

#[cfg(test)]
#[path = "history_tests.rs"]
mod tests;

fn is_model_generated_item(item: &ResponseItem) -> bool {
    match item {
        ResponseItem::Message { role, .. } => role == "assistant",
        ResponseItem::Reasoning { .. }
        | ResponseItem::FunctionCall { .. }
        | ResponseItem::ToolSearchCall { .. }
        | ResponseItem::Compaction { .. } => true,
        ResponseItem::CompactionTrigger { .. }
        | ResponseItem::FunctionCallOutput { .. }
        | ResponseItem::ToolSearchOutput { .. }
        | ResponseItem::Other => false,
    }
}

fn is_user_turn_boundary(item: &ResponseItem) -> bool {
    crate::compact::user_message(item)
        .is_some_and(|text| !crate::compact::is_summary_message(&text))
}
