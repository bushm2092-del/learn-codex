use std::path::PathBuf;
use std::sync::Arc;

use mini_codex_protocol::Event;
use tokio::sync::Mutex;
use tokio::sync::mpsc;

use crate::CodexThread;
use crate::ModelClient;
use crate::context_manager::ContextManager;
use crate::session::handlers::submission_loop;
use crate::tools::ToolRouter;

pub(crate) struct Session {
    pub(crate) model_client: Arc<dyn ModelClient>,
    pub(crate) tool_router: Arc<ToolRouter>,
    pub(crate) history: Mutex<ContextManager>,
    pub(crate) events: mpsc::Sender<Event>,
    pub(crate) instructions: String,
    pub(crate) cwd: PathBuf,
}

impl Session {
    pub(crate) fn spawn(
        model_client: Arc<dyn ModelClient>,
        tool_router: Arc<ToolRouter>,
        instructions: String,
        cwd: PathBuf,
    ) -> Arc<CodexThread> {
        let (submission_tx, submission_rx) = mpsc::channel(32);
        let (event_tx, event_rx) = mpsc::channel(128);
        let session = Arc::new(Self {
            model_client,
            tool_router,
            history: Mutex::new(ContextManager::default()),
            events: event_tx,
            instructions,
            cwd,
        });

        tokio::spawn(submission_loop(session, submission_rx));
        CodexThread::new(submission_tx, event_rx)
    }

    pub(crate) async fn send_event(&self, event: Event) {
        let _ = self.events.send(event).await;
    }
}
