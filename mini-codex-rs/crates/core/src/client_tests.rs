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

#[test]
fn remote_compaction_sse_and_completed_id_keep_wire_shape() {
    let item = serde_json::json!({"type":"compaction","id":"cmp","encrypted_content":"opaque"});
    assert_eq!(
        normalize_event(
            &serde_json::json!({"type":"response.output_item.done","item":item}).to_string()
        )
        .unwrap(),
        Some(ResponseEvent::OutputItemDone(
            serde_json::from_value(item).unwrap()
        ))
    );
    assert_eq!(
        normalize_event(r#"{"type":"response.completed","response":{"id":"resp-v2"}}"#).unwrap(),
        Some(ResponseEvent::Completed {
            response_id: "resp-v2".into(),
            token_usage: None
        })
    );
    assert_eq!(
        serde_json::to_value(ResponseItem::CompactionTrigger {}).unwrap(),
        serde_json::json!({"type":"compaction_trigger"})
    );
}

#[test]
fn completed_usage_keeps_native_counts_and_defaults_optional_details() {
    use mini_codex_protocol::TokenUsage;
    for (usage, expected) in [
        (
            serde_json::json!({"input_tokens":100,"input_tokens_details":{"cached_tokens":40,"cache_write_tokens":5},"output_tokens":30,"output_tokens_details":{"reasoning_tokens":20},"total_tokens":130}),
            TokenUsage {
                input_tokens: 100,
                cached_input_tokens: 40,
                cache_write_input_tokens: 5,
                output_tokens: 30,
                reasoning_output_tokens: 20,
                total_tokens: 130,
            },
        ),
        (
            serde_json::json!({"input_tokens":100,"output_tokens":30,"total_tokens":130}),
            TokenUsage {
                input_tokens: 100,
                output_tokens: 30,
                total_tokens: 130,
                ..Default::default()
            },
        ),
    ] {
        assert_eq!(normalize_event(&serde_json::json!({"type":"response.completed","response":{"id":"r","usage":usage}}).to_string()).unwrap(), Some(ResponseEvent::Completed { response_id:"r".into(),token_usage:Some(expected) }));
    }
}

#[tokio::test]
async fn reasoning_header_precedes_completed_usage() {
    use crate::{ModelClient, Prompt};
    use futures::StreamExt;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = vec![0; 8192];
        socket.read(&mut request).await.unwrap();
        let body = "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"r\",\"usage\":{\"input_tokens\":10,\"output_tokens\":2,\"total_tokens\":12}}}\n\n";
        socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nx-reasoning-included: false\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
    });
    let client = super::OpenAiResponsesClient::with_base_url(
        "test-only".into(),
        format!("http://{address}"),
    );
    let stream = client
        .stream(
            Prompt {
                input: vec![],
                tools: vec![],
                parallel_tool_calls: false,
                instructions: String::new(),
            },
            "custom-model".into(),
        )
        .await
        .unwrap();
    let events = stream
        .collect::<Vec<_>>()
        .await
        .into_iter()
        .collect::<anyhow::Result<Vec<_>>>()
        .unwrap();
    assert_eq!(
        events,
        vec![
            ResponseEvent::ServerReasoningIncluded(true),
            ResponseEvent::Completed {
                response_id: "r".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    input_tokens: 10,
                    output_tokens: 2,
                    total_tokens: 12,
                    ..Default::default()
                })
            }
        ]
    );
    server.await.unwrap();
}

#[test]
fn malformed_completed_usage_is_a_stream_error() {
    let error = normalize_event(
        r#"{"type":"response.completed","response":{"id":"r","usage":{"total_tokens":10}}}"#,
    )
    .unwrap_err();
    assert!(
        matches!(error.downcast_ref::<mini_codex_protocol::error::CodexErr>(), Some(mini_codex_protocol::error::CodexErr::Stream(message)) if message.starts_with("failed to parse ResponseCompleted:"))
    );
}
