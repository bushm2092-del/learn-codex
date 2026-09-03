use std::path::PathBuf;
use std::sync::Arc;

use crate::CodexThread;
use crate::ModelClient;
use crate::session::Session;
use crate::tools::ToolRouter;

/// 创建并持有新 Codex thread 共享的依赖。
pub struct ThreadManager {
    model_client: Arc<dyn ModelClient>,
    tool_router: Arc<ToolRouter>,
    instructions: String,
}

impl ThreadManager {
    pub fn new(
        model_client: Arc<dyn ModelClient>,
        tool_router: ToolRouter,
        instructions: String,
    ) -> Self {
        Self {
            model_client,
            tool_router: Arc::new(tool_router),
            instructions,
        }
    }

    pub fn start_thread(&self, cwd: PathBuf) -> Arc<CodexThread> {
        Session::spawn(
            Arc::clone(&self.model_client),
            Arc::clone(&self.tool_router),
            self.instructions.clone(),
            cwd,
        )
    }
}
