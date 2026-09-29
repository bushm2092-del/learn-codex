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
    pub(crate) model_client: Arc<dyn ModelClient>,
    pub(crate) tool_router: Arc<ToolRouter>,
    pub(crate) history: Mutex<ContextManager>,
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
    ) -> Arc<CodexThread> {
        let (submission_tx, submission_rx) = mpsc::channel(32);
        let (event_tx, event_rx) = mpsc::channel(128);
        let user_shell = Arc::new(default_user_shell());
        let history = ContextManager::with_items(initial_world_state(&cwd, &user_shell));
        let session = Arc::new(Self {
            model_client,
            tool_router,
            history: Mutex::new(history),
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

    pub(crate) fn user_shell(&self) -> Arc<Shell> {
        Arc::clone(&self.user_shell)
    }
}
