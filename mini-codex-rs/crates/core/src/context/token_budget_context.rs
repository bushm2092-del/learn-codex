use crate::config::TokenBudgetConfig;
use crate::state::auto_compact_window::AutoCompactWindowIds;
use mini_codex_protocol::models::{ContentItem, ResponseItem};

// 教学内核尚无 ContextualUserFragment/envelope；保留 developer 角色和源文本结构。
pub(crate) fn developer_message(text: String) -> ResponseItem {
    ResponseItem::Message {
        id: None,
        role: "developer".into(),
        content: vec![ContentItem::InputText { text }],
        phase: None,
    }
}
pub(crate) fn initial_context(
    ids: AutoCompactWindowIds,
    config: Option<&TokenBudgetConfig>,
) -> Vec<ResponseItem> {
    let first_window_id = ids.first_window_id;
    let window_id = ids.window_id;
    let mut lines = vec![
        "Agent name: root".to_string(),
        format!("First context window id: {first_window_id}"),
        format!("Current context window id: {window_id}"),
    ];
    if let Some(previous_window_id) = ids.previous_window_id {
        lines.push(format!("Previous context window id: {previous_window_id}"));
    }
    let mut items = vec![developer_message(format!(
        "<context_window>\n{}\n</context_window>",
        lines.join("\n")
    ))];
    if let Some(message) = config.and_then(|c| c.guidance_message.as_ref()) {
        items.push(developer_message(format!(
            "<context_window_guidance>\n{message}\n</context_window_guidance>"
        )));
    }
    items
}
