use pretty_assertions::assert_eq;

use super::normalize_event;
use crate::ResponseEvent;
use mini_codex_protocol::models::ResponseItem;

#[test]
fn normalizes_native_tool_search_item() {
    let item = serde_json::json!({"type":"tool_search_call","call_id":"search-1","execution":"client","arguments":{"query":"calendar","limit":2}});
    let event = serde_json::json!({"type":"response.output_item.done","item":item});
    assert_eq!(
        normalize_event(&event.to_string()).unwrap(),
        Some(ResponseEvent::OutputItemDone(
            serde_json::from_value(item).unwrap()
        ))
    );
}

#[test]
fn normalizes_function_call_item() {
    let event = normalize_event(
        r#"{"type":"response.output_item.done","item":{"type":"function_call","call_id":"call-1","name":"exec_command","arguments":"{\"cmd\":\"pwd\"}"}}"#,
    )
    .unwrap();

    assert_eq!(
        event,
        Some(ResponseEvent::OutputItemDone(
            serde_json::from_value::<ResponseItem>(serde_json::json!({
                "type": "function_call",
                "call_id": "call-1",
                "name": "exec_command",
                "arguments": "{\"cmd\":\"pwd\"}"
            }))
            .unwrap()
        ))
    );
}
