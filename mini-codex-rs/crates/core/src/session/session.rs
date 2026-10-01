use std::path::PathBuf;
use std::sync::Arc;

use mini_codex_protocol::Event;
use tokio::sync::Mutex;
use tokio::sync::mpsc;

use crate::CodexThread;
use crate::ModelClient;
use crate::context_manager::ContextManager;
use crate::session::handlers::submission_loop;
use crate::session::world_state::initial_world_state;
use crate::shell::Shell;
use crate::shell::default_user_shell;
use crate::tools::ToolRouter;
use crate::unified_exec::UnifiedExecProcessManager;

/// 会话级可变设置。对应源项目 `SessionSettings`/`TurnContext` 中随 `Op::ThreadSettings`
/// 变化的部分；本项目当前只有模型。
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct SessionSettings {
    pub(crate) model: String,
}

pub(crate) struct Session {
    pub(crate) config: Arc<crate::config::Config>,
    pub(crate) model_client: Arc<dyn ModelClient>,
    pub(crate) tool_router: Arc<ToolRouter>,
    pub(crate) history: Mutex<ContextManager>,
    // 沿用既有 Session 边界保存独立标志；完整 SessionState 尚未移植。
    pub(crate) server_reasoning_included: std::sync::atomic::AtomicBool,
    pub(crate) auto_compact_window: Mutex<crate::state::auto_compact_window::AutoCompactWindow>,
    pub(crate) settings: Mutex<SessionSettings>,
    pub(crate) events: mpsc::Sender<Event>,
    pub(crate) instructions: String,
    pub(crate) cwd: PathBuf,
    user_shell: Arc<Shell>,
    pub(crate) unified_exec_manager: UnifiedExecProcessManager,
}

impl Session {
    pub(crate) fn spawn(
        model_client: Arc<dyn ModelClient>,
        tool_router: Arc<ToolRouter>,
        instructions: String,
        cwd: PathBuf,
        model: String,
        config: Arc<crate::config::Config>,
    ) -> Arc<CodexThread> {
        let (submission_tx, submission_rx) = mpsc::channel(32);
        let (event_tx, event_rx) = mpsc::channel(128);
        let user_shell = Arc::new(default_user_shell());
        let window_ids = crate::state::auto_compact_window::AutoCompactWindowIds::new_initial();
        let mut initial = initial_world_state(&cwd, &user_shell);
        if config
            .features
            .enabled(mini_codex_features::Feature::TokenBudget)
        {
            initial.extend(crate::context::token_budget_context::initial_context(
                window_ids,
                config.token_budget.as_ref(),
            ));
        }
        let history = ContextManager::with_items(initial);
        let session = Arc::new(Self {
            config,
            model_client,
            tool_router,
            history: Mutex::new(history),
            server_reasoning_included: std::sync::atomic::AtomicBool::new(false),
            auto_compact_window: Mutex::new(
                crate::state::auto_compact_window::AutoCompactWindow::new_with_ids(window_ids),
            ),
            settings: Mutex::new(SessionSettings { model }),
            events: event_tx,
            instructions,
            cwd,
            user_shell,
            unified_exec_manager: UnifiedExecProcessManager::default(),
        });

        tokio::spawn(submission_loop(session, submission_rx));
        CodexThread::new(submission_tx, event_rx)
    }

    pub(crate) async fn send_event(&self, event: Event) {
        let _ = self.events.send(event).await;
    }

    pub(crate) async fn model_info(&self) -> mini_codex_protocol::openai_models::ModelInfo {
        let model = self.settings.lock().await.model.clone();
        let catalog =
            mini_codex_models_manager::bundled_models_response().expect("bundled catalog");
        let mut info = catalog
            .models
            .iter()
            .find(|info| info.slug == model)
            .unwrap_or(&catalog.models[0])
            .clone();
        // 未知模型仅继承工具输出预算，不猜测上下文窗口。
        if info.slug != model {
            info.context_window = None;
            info.max_context_window = None;
            info.auto_compact_token_limit = None;
        }
        info.context_window = self.config.model_context_window.or(info.context_window);
        info.auto_compact_token_limit = self
            .config
            .model_auto_compact_token_limit
            .or(info.auto_compact_token_limit);
        info
    }

    pub(crate) fn user_shell(&self) -> Arc<Shell> {
        Arc::clone(&self.user_shell)
    }
}
