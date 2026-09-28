use crate::common::{ScriptedModelClient, TestServer, text_reply};
use anyhow::Result;
use mini_codex_core::ResponseEvent;
use pretty_assertions::assert_eq;
use serde_json::json;

fn script(index: usize) -> Result<Vec<ResponseEvent>> {
    if index == 3 {
        anyhow::bail!("fake upstream error including secret");
    }
    if index == 1 {
        return Ok(vec![
            ResponseEvent::OutputItemDone(serde_json::from_value(
                json!({"type": "function_call", "call_id": "call-1", "name": "exec_command", "arguments": "{\"cmd\":\"printf tool-ok\"}"}),
            )?),
            ResponseEvent::Completed,
        ]);
    }
    Ok(text_reply("你好"))
}

#[tokio::test]
async fn turn_start_streams_tools_and_recovers_after_failure() -> Result<()> {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        let model = ScriptedModelClient::new(script);
        let mut server = TestServer::start(model.clone(), "").await?;
        // 握手前的请求与非法 JSON 由 TestServer::start 之外单独覆盖：这里验证已就绪后的行为。
        server.send(json!({"id": 0, "method": "turn/interrupt", "params": {}})).await?;
        assert_eq!(server.recv().await?, json!({"id": 0, "error": {"code": -32601, "message": "Method not found"}}));
        server.writer_raw(b"not-json\n").await?;
        assert_eq!(server.recv().await?, json!({"id": null, "error": {"code": -32700, "message": "Parse error"}}));

        let thread_id = server.start_thread(1).await?;
        for (id, status) in [(2, "completed"), (3, "failed"), (4, "completed")] {
            server.send(json!({"id": id, "method": "turn/start", "params": {"threadId": thread_id, "input": [{"type": "text", "text": "你好"}]}})).await?;
            let response = server.recv().await?;
            assert_eq!(response["id"], id);
            let turn_id = response["result"]["turn"]["id"].clone();
            if id == 2 {
                server.send(json!({"id": 99, "method": "turn/start", "params": {"threadId": thread_id, "input": [{"type": "text", "text": "duplicate"}]}})).await?;
            }
            let mut rejected_busy = false;
            let mut methods = vec![];
            loop {
                let event = server.recv().await?;
                if event["id"] == 99 {
                    assert_eq!(event, json!({"id": 99, "error": {"code": -32600, "message": "Thread already has an active turn"}}));
                    rejected_busy = true;
                    continue;
                }
                assert_eq!(event["params"]["threadId"], thread_id);
                assert_eq!(event["params"]["turnId"], turn_id);
                methods.push(event["method"].as_str().unwrap().to_owned());
                if event["method"] == "item/completed" && event["params"]["item"]["type"] == "commandExecution" {
                    assert_eq!(event["params"]["item"]["command"], "printf tool-ok");
                    assert!(event["params"]["item"]["aggregatedOutput"].as_str().unwrap().contains("tool-ok"));
                }
                if event["method"] == "turn/completed" {
                    assert_eq!(event["params"]["turn"]["status"], status);
                    assert!(!event.to_string().contains("secret"));
                    break;
                }
            }
            if id == 2 {
                assert!(rejected_busy);
                assert_eq!(methods, vec!["turn/started", "item/started", "item/completed", "item/started", "item/agentMessage/delta", "item/completed", "turn/completed"]);
            }
        }
        server.send(json!({"id": 5, "method": "turn/start", "params": {"threadId": "missing", "input": [{"type": "text", "text": "hello"}]}})).await?;
        assert_eq!(server.recv().await?, json!({"id": 5, "error": {"code": -32602, "message": "Thread not found"}}));
        server.shutdown().await?;
        let prompts = model.prompts.lock().unwrap();
        assert!(prompts[1].input.iter().any(|item| {
            let item = serde_json::to_value(item).unwrap();
            item["type"] == "function_call_output" && item["call_id"] == "call-1"
        }));
        assert!(prompts[3].input.len() > prompts[1].input.len());
        // 未配置 model 时使用目录默认模型。
        assert_eq!(model.models.lock().unwrap()[0], "deepseek-flash");
        Ok::<(), anyhow::Error>(())
    }).await??;
    Ok(())
}
