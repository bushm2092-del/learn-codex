use super::*;
use pretty_assertions::assert_eq;
fn item(value: serde_json::Value) -> ResponseItem {
    serde_json::from_value(value).unwrap()
}
#[test]
fn missing_outputs_are_inserted_after_calls_without_mutating_history() {
    let calls = vec![
        item(
            serde_json::json!({"type":"function_call", "id":"fc1", "name":"exec_command", "arguments":"{}", "call_id":"c1"}),
        ),
        item(
            serde_json::json!({"type":"tool_search_call", "call_id":"s1", "execution":"client", "arguments":{"query":"files"}}),
        ),
    ];
    let history = ContextManager::with_items(calls.clone());
    let prompt = history.clone().for_prompt();
    assert_eq!(history.raw_items(), calls);
    assert_eq!(prompt[0], calls[0]);
    let ResponseItem::FunctionCallOutput { id, .. } = &prompt[1] else {
        panic!("missing output");
    };
    assert_eq!(
        prompt[1],
        item(
            serde_json::json!({"type":"function_call_output", "id":id, "call_id":"c1", "output":"aborted"})
        )
    );
    assert!(id.as_deref().unwrap().starts_with("fco_"));
    assert_eq!(
        prompt[2..],
        [
            calls[1].clone(),
            item(
                serde_json::json!({"type":"tool_search_output", "call_id":"s1", "status":"completed", "execution":"client", "tools":[]})
            )
        ]
    );
    assert_eq!(prompt, history.for_prompt());
}
#[test]
fn paired_and_standalone_outputs_survive_normalization() {
    let call = item(
        serde_json::json!({"type":"function_call", "name":"read", "arguments":"{}", "call_id":"c"}),
    );
    let paired =
        item(serde_json::json!({"type":"function_call_output", "call_id":"c", "output":"ok"}));
    let external =
        item(serde_json::json!({"type":"function_call_output", "name":"external", "output":"ok"}));
    let server = item(
        serde_json::json!({"type":"tool_search_output", "call_id":"server", "status":"completed", "execution":"server", "tools":[]}),
    );
    let orphan = item(
        serde_json::json!({"type":"function_call_output", "call_id":"missing", "output":"bad"}),
    );
    let orphan_search = item(
        serde_json::json!({"type":"tool_search_output", "call_id":"missing", "status":"completed", "execution":"client", "tools":[]}),
    );
    let history = ContextManager::with_items(vec![
        orphan,
        call.clone(),
        paired.clone(),
        external.clone(),
        server.clone(),
        orphan_search,
    ]);
    assert_eq!(history.for_prompt(), vec![call, paired, external, server]);
}
#[test]
fn recording_filters_and_truncates_without_losing_success() {
    let mut output = item(
        serde_json::json!({"type":"function_call_output", "call_id":"c", "output":"中文内容".repeat(50)}),
    );
    if let ResponseItem::FunctionCallOutput { output, .. } = &mut output {
        output.success = Some(true);
    }
    let mut history = ContextManager::default();
    history.record_items(
        &[
            ResponseItem::Other,
            item(serde_json::json!({"type":"message","role":"system","content":[]})),
            output.clone(),
        ],
        TruncationPolicy::Bytes(20),
    );
    let mut expected = output;
    let ResponseItem::FunctionCallOutput { output, .. } = &mut expected else {
        unreachable!()
    };
    output.body = FunctionCallOutputBody::Text(mini_codex_utils_output_truncation::truncate_text(
        output.text_content().unwrap(),
        TruncationPolicy::Bytes(24),
    ));
    assert_eq!(history.raw_items(), &[expected]);
}
#[test]
fn token_estimate_charges_content_not_transport_ids_or_json_escaping() {
    let a = item(
        serde_json::json!({"type":"message", "role":"user", "id":"short", "content":[{"type":"input_text","text":"中文\n\""}]}),
    );
    let b = item(
        serde_json::json!({"type":"message", "role":"user", "id":"x".repeat(1000), "content":[{"type":"input_text","text":"中文\n\""}]}),
    );
    assert_eq!(estimate_item_token_count(&a), 2);
    assert_eq!(estimate_item_token_count(&a), estimate_item_token_count(&b));
    assert_eq!(
        ContextManager::with_items(vec![a]).estimate_token_count_with_base_instructions("12345"),
        Some(4)
    );
}

#[test]
fn token_estimate_preserves_call_namespace_and_encrypted_reasoning_rules() {
    let call = item(
        serde_json::json!({"type":"function_call","name":"read","arguments":"{}","call_id":"ignored","id":"ignored"}),
    );
    let namespaced = item(
        serde_json::json!({"type":"function_call","name":"read","namespace":"x","arguments":"{}","call_id":"ignored"}),
    );
    assert_eq!(
        (
            estimate_item_token_count(&call),
            estimate_item_token_count(&namespaced)
        ),
        (4, 2)
    );
    let plaintext =
        item(serde_json::json!({"type":"reasoning","summary":[{"text":"x".repeat(10000)}]}));
    let encrypted =
        item(serde_json::json!({"type":"reasoning","encrypted_content":"x".repeat(1000)}));
    assert_eq!(
        (
            estimate_item_token_count(&plaintext),
            estimate_item_token_count(&encrypted)
        ),
        (0, 25)
    );
}

#[test]
fn server_usage_counts_only_local_items_after_the_latest_model_output() {
    let mut history = ContextManager::with_items(vec![
        item(
            serde_json::json!({"type":"message","role":"user","content":[{"type":"input_text","text":"task"}]}),
        ),
        item(
            serde_json::json!({"type":"function_call","name":"read","arguments":"{}","call_id":"c"}),
        ),
    ]);
    let first = TokenUsage {
        input_tokens: 900,
        output_tokens: 100,
        total_tokens: 1000,
        ..Default::default()
    };
    history.update_token_info(&first, Some(16000));
    assert_eq!(history.get_total_token_usage(true), 1000);
    history.record_items(
        &[item(
            serde_json::json!({"type":"function_call_output","call_id":"c","output":"abcd"}),
        )],
        TruncationPolicy::Bytes(10000),
    );
    assert_eq!(history.get_total_token_usage(true), 1002);
    history.record_items(&[item(serde_json::json!({"type":"message","role":"assistant","content":[{"type":"output_text","text":"answer"}]}))], TruncationPolicy::Bytes(10000));
    let second = TokenUsage {
        input_tokens: 1100,
        output_tokens: 100,
        total_tokens: 1200,
        ..Default::default()
    };
    history.update_token_info(&second, Some(16000));
    assert_eq!(history.get_total_token_usage(true), 1200);
    assert_eq!(
        history.token_info(),
        Some(TokenUsageInfo {
            total_token_usage: TokenUsage {
                input_tokens: 2000,
                output_tokens: 200,
                total_tokens: 2200,
                ..Default::default()
            },
            last_token_usage: second,
            model_context_window: Some(16000),
        })
    );
    history.record_items(&[item(serde_json::json!({"type":"message","role":"user","content":[{"type":"input_text","text":"next"}]}))], TruncationPolicy::Bytes(10000));
    assert_eq!(history.get_total_token_usage(true), 1201);
}

#[test]
fn historical_reasoning_is_added_only_when_the_server_does_not_include_it() {
    let mut history = ContextManager::with_items(vec![
        item(serde_json::json!({"type":"reasoning","encrypted_content":"r".repeat(872)})),
        item(
            serde_json::json!({"type":"message","role":"user","content":[{"type":"input_text","text":"task"}]}),
        ),
        item(serde_json::json!({"type":"reasoning","encrypted_content":"r".repeat(872)})),
        item(
            serde_json::json!({"type":"message","role":"assistant","content":[{"type":"output_text","text":"answer"}]}),
        ),
    ]);
    history.update_token_info(
        &TokenUsage {
            total_tokens: 100,
            ..Default::default()
        },
        None,
    );
    assert_eq!(
        (
            history.get_total_token_usage(false),
            history.get_total_token_usage(true)
        ),
        (101, 100)
    );
}

#[test]
fn missing_usage_keeps_the_upstream_zero_baseline_and_estimates_only_the_tail() {
    let initial = item(
        serde_json::json!({"type":"message","role":"user","content":[{"type":"input_text","text":"task"}]}),
    );
    let mut history = ContextManager::with_items(vec![initial.clone()]);
    assert_eq!(history.get_total_token_usage(true), 0);
    history.record_items(&[item(serde_json::json!({"type":"message","role":"assistant","content":[{"type":"output_text","text":"answer"}]})), initial], TruncationPolicy::Bytes(10000));
    assert_eq!(history.get_total_token_usage(true), 1);
    assert_eq!(history.token_info(), None);
}
