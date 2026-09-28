use std::collections::VecDeque;
use std::pin::Pin;
use std::sync::Arc;

use anyhow::Result;
use futures::Future;
use futures::stream;
use mini_codex_config::ConfigToml;
use mini_codex_core::ModelClient;
use mini_codex_core::Prompt;
use mini_codex_core::ResponseEvent;
use mini_codex_core::ResponseStream;
use mini_codex_core::ThreadManager;
use mini_codex_core::config::Config;
use mini_codex_core::config::ConfigOverrides;
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::models::ResponseItem;
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

fn response_item(value: serde_json::Value) -> ResponseItem {
    serde_json::from_value(value).unwrap()
}

fn test_config() -> Result<(Config, std::path::PathBuf)> {
    let cwd = std::env::temp_dir();
    let config = Config::load_from_base_config_with_overrides(
        ConfigToml::default(),
        ConfigOverrides {
            cwd: Some(cwd.clone()),
            ..Default::default()
        },
        cwd.clone(),
    )?;
    Ok((config, cwd))
}

impl ModelClient for ScriptedModelClient {
    fn stream(
        &self,
        prompt: Prompt,
        _model: String,
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
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "function_call",
                "call_id": "call-1",
                "name": "exec_command",
                "arguments": "{\"cmd\":\"echo tool-harness\"}"
            }))),
            ResponseEvent::Completed,
        ],
        vec![
            ResponseEvent::OutputTextDelta("完成".to_string()),
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "完成"}]
            }))),
            ResponseEvent::Completed,
        ],
    ]));
    let temp_dir = std::env::temp_dir();
    let config = Config::load_from_base_config_with_overrides(
        ConfigToml::default(),
        ConfigOverrides {
            cwd: Some(temp_dir.clone()),
            ..Default::default()
        },
        temp_dir.clone(),
    )?;
    let manager = ThreadManager::new(config, model.clone(), "你是一个测试代理。".to_string());
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
        .map(|item| serde_json::to_value(item).unwrap())
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

#[tokio::test]
async fn invalid_arguments_are_returned_to_the_model() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "function_call",
                "call_id": "call-invalid",
                "name": "exec_command",
                "arguments": "{not-json"
            }))),
            ResponseEvent::Completed,
        ],
        vec![
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "参数已修正"}]
            }))),
            ResponseEvent::Completed,
        ],
    ]));
    let (config, cwd) = test_config()?;
    let manager = ThreadManager::new(config, model.clone(), "test".to_string());
    let thread = manager.start_thread(cwd);
    let turn_id = thread.start_turn("运行命令".to_string()).await?;

    while let Some(event) = thread.next_event().await {
        if event.submission_id == turn_id && matches!(event.msg, EventMsg::TurnCompleted { .. }) {
            break;
        }
    }

    let prompts = model.prompts.lock().await;
    let output = prompts[1]
        .input
        .iter()
        .map(|item| serde_json::to_value(item).unwrap())
        .find(|item| item["type"] == "function_call_output" && item["call_id"] == "call-invalid")
        .expect("非法参数应产生 function_call_output");
    assert!(
        output["output"]
            .as_str()
            .unwrap()
            .contains("failed to parse")
    );
    Ok(())
}

#[tokio::test]
async fn multiple_tool_outputs_keep_model_call_order() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "function_call", "call_id": "call-1", "name": "exec_command",
                "arguments": "{\"cmd\":\"sleep 0.5; printf first\"}"
            }))),
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "function_call", "call_id": "call-2", "name": "exec_command",
                "arguments": "{\"cmd\":\"sleep 0.5; printf second\"}"
            }))),
            ResponseEvent::Completed,
        ],
        vec![
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "message", "role": "assistant",
                "content": [{"type": "output_text", "text": "完成"}]
            }))),
            ResponseEvent::Completed,
        ],
    ]));
    let (config, cwd) = test_config()?;
    let manager = ThreadManager::new(config, model.clone(), "test".to_string());
    let thread = manager.start_thread(cwd);
    let started = std::time::Instant::now();
    let turn_id = thread.start_turn("运行两个命令".to_string()).await?;
    while let Some(event) = thread.next_event().await {
        if event.submission_id == turn_id && matches!(event.msg, EventMsg::TurnCompleted { .. }) {
            break;
        }
    }
    assert!(
        started.elapsed() < std::time::Duration::from_millis(900),
        "声明支持并行的工具应并发执行"
    );

    let prompts = model.prompts.lock().await;
    let call_ids = prompts[1]
        .input
        .iter()
        .filter_map(|item| {
            let item = serde_json::to_value(item).unwrap();
            (item["type"] == "function_call_output")
                .then(|| item["call_id"].as_str().unwrap().to_string())
        })
        .collect::<Vec<_>>();
    assert_eq!(call_ids, vec!["call-1", "call-2"]);
    Ok(())
}

#[tokio::test]
async fn stream_closed_before_completed_fails_the_turn() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![vec![
        ResponseEvent::OutputItemDone(response_item(serde_json::json!({
            "type": "message", "role": "assistant",
            "content": [{"type": "output_text", "text": "不完整"}]
        }))),
    ]]));
    let (config, cwd) = test_config()?;
    let manager = ThreadManager::new(config, model, "test".to_string());
    let thread = manager.start_thread(cwd);
    let turn_id = thread.start_turn("测试断流".to_string()).await?;

    while let Some(event) = thread.next_event().await {
        if event.submission_id == turn_id {
            if let EventMsg::Error(message) = event.msg {
                assert!(message.contains("stream closed before response.completed"));
                return Ok(());
            }
        }
    }
    anyhow::bail!("断流应产生 Error 事件")
}
