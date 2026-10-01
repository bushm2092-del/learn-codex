use std::path::PathBuf;
use std::sync::Arc;

use mini_codex_features::Feature;
use mini_codex_models_manager::ModelsManager;
use mini_codex_protocol::openai_models::ModelPreset;

use crate::CodexThread;
use crate::ModelClient;
use crate::config::Config;
use crate::session::Session;
use crate::tools::ExecCommandHandler;
use crate::tools::ExecCommandHandlerOptions;
use crate::tools::ToolRegistry;
use crate::tools::ToolRouter;
use crate::tools::WriteStdinHandler;

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
        let exec_options = ExecCommandHandlerOptions {
            allow_login_shell: false,
            allow_tty: config.features.enabled(Feature::UnifiedExecTty),
            include_windows_shell_guidance: cfg!(windows),
        };
        if config.features.enabled(Feature::UnifiedExec) {
            let exec_command_handler = ExecCommandHandler::new(exec_options);
            let write_stdin_handler = WriteStdinHandler;
            tool_registry.add(exec_command_handler);
            tool_registry.add(write_stdin_handler);
        } else {
            let exec_command_handler = ExecCommandHandler::one_shot(exec_options);
            tool_registry.add(exec_command_handler);
        }
        // 当前静态 DeepSeek 目录未声明原生搜索能力，provider 也不假定支持 namespace。
        // 工具方案按已注册 runtime 的 exposure 统一生成，避免规格与注册表各维护一份。
        let catalog = mini_codex_models_manager::bundled_models_response()
            .expect("bundled models.json must be valid");
        let model = config.model.as_deref().unwrap_or("deepseek-flash");
        let model_info = catalog
            .models
            .iter()
            .find(|info| info.slug == model)
            .unwrap_or(&catalog.models[0]);
        let tool_router = crate::tools::spec_plan::finalize_tool_router(
            model_info,
            &mini_codex_model_provider::ProviderCapabilities {
                namespace_tools: false,
                ..mini_codex_model_provider::ProviderCapabilities::default()
            },
            tool_registry,
            &crate::tools::handlers::tool_search::ToolSearchHandlerCache::default(),
        );
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
            Arc::clone(&self.config),
        )
    }
}

#[cfg(test)]
#[path = "thread_manager_tests.rs"]
mod tests;
