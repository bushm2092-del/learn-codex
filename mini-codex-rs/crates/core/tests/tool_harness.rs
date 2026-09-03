use std::collections::VecDeque;
use std::pin::Pin;
use std::sync::Arc;

use anyhow::Result;
use futures::Future;
use futures::stream;
use mini_codex_core::ExecCommandTool;
use mini_codex_core::ModelClient;
use mini_codex_core::Prompt;
use mini_codex_core::ResponseEvent;
use mini_codex_core::ResponseStream;
use mini_codex_core::ThreadManager;
use mini_codex_core::ToolRouter;
use mini_codex_protocol::EventMsg;
use pretty_assertions::assert_eq;
use tokio::sync::Mutex;

struct ScriptedModelClient {
    responses: Mutex<VecDeque<Vec<ResponseEvent>>>,
    prompts: Mutex<Vec<Prompt>>,
}

impl ScriptedModelClient {
    fn new(responses: Vec<Vec<ResponseEvent>>) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
            prompts: Mutex::new(Vec::new()),
        }
    }
}

impl ModelClient for ScriptedModelClient {
    fn stream(
        &self,
        prompt: Prompt,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>> {
        Box::pin(async move {
            self.prompts.lock().await.push(prompt);
            let events = self
                .responses
                .lock()
                .await
                .pop_front()
                .expect("scripted response");
            Ok(Box::pin(stream::iter(events.into_iter().map(Ok))) as ResponseStream)
        })
    }
}

#[tokio::test]
async fn tool_output_is_sent_back_to_the_model() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(serde_json::json!({
                "type": "function_call",
                "call_id": "call-1",
                "name": "exec_command",
                "arguments": "{\"cmd\":\"echo tool-harness\"}"
            })),
            ResponseEvent::Completed,
        ],
        vec![
            ResponseEvent::OutputTextDelta("完成".to_string()),
            ResponseEvent::OutputItemDone(serde_json::json!({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "完成"}]
            })),
            ResponseEvent::Completed,
        ],
    ]));
    let manager = ThreadManager::new(
        model.clone(),
        ToolRouter::default().register(ExecCommandTool),
        "你是一个测试代理。".to_string(),
    );
    let temp_dir = std::env::temp_dir();
    let thread = manager.start_thread(temp_dir);
    let turn_id = thread.start_turn("运行这个命令".to_string()).await?;

    let mut completed = None;
    while let Some(event) = thread.next_event().await {
        if event.submission_id == turn_id
            && let EventMsg::TurnCompleted { last_agent_message } = event.msg
        {
            completed = Some(last_agent_message);
            break;
        }
    }
    assert_eq!(completed, Some(Some("完成".to_string())));

    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 2);
    let tool_output = prompts[1]
        .input
        .iter()
        .find(|item| item["type"] == "function_call_output")
        .expect("第二次模型请求中应包含工具输出");
    assert_eq!(tool_output["call_id"], "call-1");
    assert!(
        tool_output["output"]
            .as_str()
            .unwrap()
            .contains("tool-harness")
    );

    Ok(())
}
