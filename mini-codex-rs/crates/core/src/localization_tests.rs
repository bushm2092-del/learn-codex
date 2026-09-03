use pretty_assertions::assert_eq;

use super::PromptCatalog;

#[test]
fn chinese_catalog_localizes_prompt_and_status() {
    let catalog = PromptCatalog::new();

    assert_eq!(
        catalog.system_prompt("/tmp/work"),
        "你是一个小型编程代理。请在 /tmp/work 目录中工作；需要时使用工具，最后用简洁的中文解释结果。"
    );
    assert_eq!(catalog.welcome(), "mini-codex：输入请求，或输入 /exit 退出");
    assert_eq!(
        catalog.tool_started("exec_command"),
        "\n[工具] exec_command"
    );
    assert_eq!(catalog.error_prefix(), "错误");
}
