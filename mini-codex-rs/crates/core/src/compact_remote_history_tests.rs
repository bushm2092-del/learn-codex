use super::*;
use pretty_assertions::assert_eq;
fn output(text: &str) -> ResponseItem {
    ResponseItem::FunctionCallOutput {
        id: None,
        call_id: Some("c".into()),
        name: None,
        namespace: None,
        output: FunctionCallOutputPayload {
            body: FunctionCallOutputBody::Text(text.into()),
            success: Some(false),
        },
    }
}
#[test]
fn trim_rewrites_only_contiguous_tail_outputs_preserving_metadata() {
    let call: ResponseItem = serde_json::from_value(
        serde_json::json!({"type":"function_call","name":"read","arguments":"{}","call_id":"c"}),
    )
    .unwrap();
    let mut history = ContextManager::with_items(vec![call.clone(), output(&"x".repeat(20000))]);
    let (count, deleted) =
        trim_function_call_history_to_fit_context_window(&mut history, Some(1000), "instructions");
    assert_eq!(count, 1);
    assert!(deleted > 0);
    assert_eq!(
        history.raw_items(),
        &[call, output(CONTEXT_WINDOW_TRUNCATED_OUTPUT_MESSAGE)]
    );
    let mut no_window = ContextManager::with_items(vec![output("large")]);
    assert_eq!(
        trim_function_call_history_to_fit_context_window(&mut no_window, None, ""),
        (0, 0)
    );
}
