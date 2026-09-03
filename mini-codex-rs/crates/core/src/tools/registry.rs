use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use mini_codex_protocol::ToolSpec;
use serde_json::Value;

#[derive(Clone, Debug, PartialEq)]
pub struct ToolResult {
    pub output: String,
    pub success: bool,
}

pub type ToolFuture<'a> = Pin<Box<dyn Future<Output = ToolResult> + Send + 'a>>;

/// 模型可见工具定义中真正负责执行的部分。
pub trait Tool: Send + Sync {
    fn spec(&self) -> ToolSpec;
    fn execute<'a>(&'a self, arguments: Value, cwd: &'a Path) -> ToolFuture<'a>;
}
