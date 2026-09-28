use std::path::PathBuf;
use std::sync::Arc;

use mini_codex_models_manager::ModelsManager;
use mini_codex_protocol::openai_models::ModelPreset;
use mini_codex_tools::ToolExecutor;

use crate::CodexThread;
use crate::ModelClient;
use crate::config::Config;
use crate::session::Session;
use crate::tools::ExecCommandHandler;
use crate::tools::ToolRegistry;
use crate::tools::ToolRouter;

/// 创建并持有新 Codex thread 共享的依赖。
///
/// 对应源项目 `ThreadManager::new(config, ...)`：配置与模型目录在这里集中持有，
/// 各入口不再自行决定默认模型。
pub struct ThreadManager {
    config: Arc<Config>,
    model_client: Arc<dyn ModelClient>,
    tool_router: Arc<ToolRouter>,
    models_manager: Arc<ModelsManager>,
    instructions: String,
}

impl ThreadManager {
    pub fn new(config: Config, model_client: Arc<dyn ModelClient>, instructions: String) -> Self {
        let models_manager = ModelsManager::new(
            mini_codex_models_manager::bundled_models_response()
                .expect("bundled models.json must be valid"),
        );
        let mut tool_registry = ToolRegistry::default();
        let exec_command_handler = ExecCommandHandler;
        let model_visible_specs = vec![exec_command_handler.spec()];
        tool_registry.add(exec_command_handler);
        let tool_router = ToolRouter::from_parts(tool_registry, model_visible_specs);
        Self {
            config: Arc::new(config),
            model_client,
            tool_router: Arc::new(tool_router),
            models_manager: Arc::new(models_manager),
            instructions,
        }
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    /// 列出可供选择的模型预设。
    pub fn list_models(&self) -> Vec<ModelPreset> {
        self.models_manager.list_models()
    }

    /// 解析新 thread 的初始模型：`config.toml` 的 `model`，否则目录默认模型。
    pub fn default_model(&self) -> String {
        self.config
            .model
            .clone()
            .unwrap_or_else(|| self.models_manager.get_default_model())
    }

    pub fn start_thread(&self, cwd: PathBuf) -> Arc<CodexThread> {
        Session::spawn(
            Arc::clone(&self.model_client),
            Arc::clone(&self.tool_router),
            self.instructions.clone(),
            cwd,
            self.default_model(),
        )
    }
}
