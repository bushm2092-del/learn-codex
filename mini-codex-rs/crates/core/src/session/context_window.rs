use super::Session;

pub(crate) struct ContextWindowTokenStatus {
    pub(crate) token_limit_reached: bool,
    pub(crate) base_window_tokens_remaining: Option<i64>,
}

// 只保留上游 FullContext scope；用服务端基线加尚未覆盖的新增项估算。
pub(crate) async fn context_window_token_status(sess: &Session) -> ContextWindowTokenStatus {
    let model_info = sess.model_info().await;

    let active_context_tokens = sess.get_total_token_usage().await;

    let auto_compact_scope_tokens = active_context_tokens;

    let auto_compact_scope_limit = model_info.auto_compact_token_limit();

    let full_context_window_limit = model_info.usable_context_window();

    let full_context_window_limit_reached =
        full_context_window_limit.is_some_and(|limit| active_context_tokens >= limit);

    let base_window_tokens_remaining = [auto_compact_scope_limit, full_context_window_limit]
        .into_iter()
        .flatten()
        .map(|limit| limit.saturating_sub(active_context_tokens).max(0))
        .min();
    let buffer = sess
        .config
        .token_budget
        .as_ref()
        .map_or(0, crate::config::TokenBudgetConfig::fallback_buffer_tokens);
    let token_limit_reached = auto_compact_scope_limit
        .map(|limit| limit.saturating_add(buffer))
        .is_some_and(|limit| auto_compact_scope_tokens >= limit)
        || full_context_window_limit_reached;

    ContextWindowTokenStatus {
        token_limit_reached,
        base_window_tokens_remaining,
    }
}
