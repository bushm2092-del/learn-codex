use super::Session;
use mini_codex_features::Feature;
pub(super) async fn maybe_record(
    sess: &Session,
    base_window_tokens_remaining: Option<i64>,
    allow_auto_compact_fallback: bool,
) {
    if !sess.config.features.enabled(Feature::TokenBudget) {
        return;
    }
    let Some(base_window_tokens_remaining) = base_window_tokens_remaining else {
        return;
    };

    let Some(config) = sess.config.token_budget.as_ref() else {
        return;
    };

    if config
        .reminder_threshold_tokens
        .is_some_and(|threshold| base_window_tokens_remaining <= threshold)
    {
        let reminder_due = {
            let mut state = sess.auto_compact_window.lock().await;
            state.claim_token_budget_reminder()
        };
        if reminder_due {
            let response_item = crate::context::token_budget_context::developer_message(
                config
                    .reminder_message_template
                    .replace("{n_remaining}", &base_window_tokens_remaining.to_string()),
            );
            sess.history
                .lock()
                .await
                .record_items(&[response_item], sess.model_info().await.truncation_policy);
        }
    }

    if !allow_auto_compact_fallback || base_window_tokens_remaining != 0 {
        return;
    }
    let Some(prompt) = config.auto_compact_fallback_prompt.as_deref() else {
        return;
    };

    let fallback_due = {
        let mut state = sess.auto_compact_window.lock().await;
        state.claim_auto_compact_fallback()
    };
    if !fallback_due {
        return;
    }

    let response_item = crate::context::token_budget_context::developer_message(prompt.to_string());
    sess.history
        .lock()
        .await
        .record_items(&[response_item], sess.model_info().await.truncation_policy);
}
