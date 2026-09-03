use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mini_codex_protocol::ToolSpec;
use serde_json::Value;

use crate::tools::Tool;
use crate::tools::ToolResult;

#[derive(Default)]
pub struct ToolRouter {
    tools: BTreeMap<String, Arc<dyn Tool>>,
}

impl ToolRouter {
    pub fn register(mut self, tool: impl Tool + 'static) -> Self {
        let tool = Arc::new(tool);
        self.tools.insert(tool.spec().name.clone(), tool);
        self
    }

    pub(crate) fn model_visible_specs(&self) -> Vec<ToolSpec> {
        self.tools.values().map(|tool| tool.spec()).collect()
    }

    pub(crate) async fn dispatch(&self, name: &str, arguments: Value, cwd: &Path) -> ToolResult {
        match self.tools.get(name) {
            Some(tool) => tool.execute(arguments, cwd).await,
            None => ToolResult {
                output: format!("未知工具：{name}"),
                success: false,
            },
        }
    }
}
