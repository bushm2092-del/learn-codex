mod context_window;
mod handlers;
mod session;
mod thread_settings;
pub(crate) mod turn;
pub(crate) mod world_state;

pub(crate) use session::Session;

impl Session {
    pub(crate) async fn get_total_token_usage(&self) -> i64 {
        let history = self.history.lock().await;
        history.get_total_token_usage(
            self.server_reasoning_included
                .load(std::sync::atomic::Ordering::Relaxed),
        )
    }
    pub(crate) fn set_server_reasoning_included(&self, included: bool) {
        self.server_reasoning_included
            .store(included, std::sync::atomic::Ordering::Relaxed);
    }
    pub(crate) async fn update_token_usage_info(
        &self,
        usage: Option<&mini_codex_protocol::TokenUsage>,
    ) {
        if let Some(usage) = usage {
            let context_window = self.model_info().await.usable_context_window();
            self.history
                .lock()
                .await
                .update_token_info(usage, context_window);
        }
    }
    pub(crate) async fn recompute_token_usage(&self) {
        let history = self.history.lock().await.clone();
        let Some(estimated_total_tokens) =
            history.estimate_token_count_with_base_instructions(&self.instructions)
        else {
            return;
        };
        let context_window = self.model_info().await.usable_context_window();
        let mut history = self.history.lock().await;
        let mut info = history
            .token_info()
            .unwrap_or(mini_codex_protocol::TokenUsageInfo {
                total_token_usage: mini_codex_protocol::TokenUsage::default(),
                last_token_usage: mini_codex_protocol::TokenUsage::default(),
                model_context_window: None,
            });
        info.last_token_usage = mini_codex_protocol::TokenUsage {
            total_tokens: estimated_total_tokens.max(0),
            ..mini_codex_protocol::TokenUsage::default()
        };
        if let Some(context_window) = context_window {
            info.model_context_window = Some(context_window);
        }
        history.set_token_info(Some(info));
    }
}

mod token_budget;
impl Session {
    pub(crate) async fn start_new_context_window(&self) -> u64 {
        let (window_number, ids) = self.auto_compact_window.lock().await.advance();
        let mut context_items = world_state::initial_world_state(&self.cwd, &self.user_shell());
        context_items.extend(crate::context::token_budget_context::initial_context(
            ids,
            self.config.token_budget.as_ref(),
        ));
        self.history.lock().await.replace(context_items);
        self.recompute_token_usage().await;
        window_number
    }
}
