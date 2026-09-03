/// 集中管理用户可见文案和模型提示词。
///
/// 当前版本只提供中文。把文案留在 catalog 中，可以避免它们散落在 CLI 和 agent 循环里。
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct PromptCatalog;

impl PromptCatalog {
    pub fn new() -> Self {
        Self
    }

    pub fn system_prompt(self, cwd: &str) -> String {
        format!(
            "你是一个小型编程代理。请在 {cwd} 目录中工作；需要时使用工具，最后用简洁的中文解释结果。"
        )
    }

    pub fn welcome(self) -> &'static str {
        "mini-codex：输入请求，或输入 /exit 退出"
    }

    pub fn tool_started(self, name: &str) -> String {
        format!("\n[工具] {name}")
    }

    pub fn tool_completed(self, success: bool, output: &str) -> String {
        let status = if success { "成功" } else { "失败" };
        format!("[工具 {status}]\n{output}")
    }

    pub fn error_prefix(self) -> &'static str {
        "错误"
    }
}

#[cfg(test)]
#[path = "localization_tests.rs"]
mod tests;
