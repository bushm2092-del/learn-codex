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
    models: Mutex<Vec<String>>,
}

impl ScriptedModelClient {
    fn new(responses: Vec<Vec<ResponseEvent>>) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
            prompts: Mutex::new(Vec::new()),
            models: Mutex::new(Vec::new()),
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
        model: String,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>> {
        Box::pin(async move {
            self.models.lock().await.push(model);
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
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: None,
            },
        ],
        vec![
            ResponseEvent::OutputTextDelta("完成".to_string()),
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "完成"}]
            }))),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: None,
            },
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
    let environment_context = serde_json::to_value(&prompts[0].input[0]).unwrap();
    assert!(
        environment_context["content"][0]["text"]
            .as_str()
            .unwrap()
            .contains("<shell>")
    );
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
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: None,
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "参数已修正"}]
            }))),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: None,
            },
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
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: None,
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(response_item(serde_json::json!({
                "type": "message", "role": "assistant",
                "content": [{"type": "output_text", "text": "完成"}]
            }))),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: None,
            },
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

fn assistant_message(text: &str) -> ResponseItem {
    response_item(
        serde_json::json!({"type":"message","role":"assistant","content":[{"type":"output_text","text":text}]}),
    )
}
fn user_message(text: &str) -> ResponseItem {
    response_item(
        serde_json::json!({"type":"message","role":"user","content":[{"type":"input_text","text":text}]}),
    )
}
async fn finish_turn(thread: &mini_codex_core::CodexThread, text: &str) -> Result<EventMsg> {
    let id = thread.start_turn(text.to_string()).await?;
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let event = thread.next_event().await.expect("turn event");
            if event.submission_id == id
                && matches!(
                    event.msg,
                    EventMsg::TurnCompleted { .. } | EventMsg::Error(_)
                )
            {
                return event.msg;
            }
        }
    })
    .await
    .map_err(Into::into)
}
#[tokio::test]
async fn pre_turn_compaction_replaces_history_before_new_user_input() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(assistant_message(&"x".repeat(8000))),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("checkpoint")),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("done")),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
    ]));
    let (mut config, cwd) = test_config()?;
    config.model_auto_compact_token_limit = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    assert_eq!(
        finish_turn(&thread, "first").await?,
        EventMsg::TurnCompleted {
            last_agent_message: Some("x".repeat(8000))
        }
    );
    assert_eq!(
        finish_turn(&thread, "second").await?,
        EventMsg::TurnCompleted {
            last_agent_message: Some("done".into())
        }
    );
    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 3);
    assert!(prompts[1].tools.is_empty());
    assert!(!prompts[1].parallel_tool_calls);
    assert_eq!(
        prompts[1].input.last(),
        Some(&user_message(mini_codex_prompts::SUMMARIZATION_PROMPT))
    );
    assert_eq!(
        prompts[2].input,
        vec![
            user_message("first"),
            user_message(&format!(
                "{}\ncheckpoint",
                mini_codex_prompts::SUMMARY_PREFIX
            )),
            prompts[0].input[0].clone(),
            user_message("second")
        ]
    );
    Ok(())
}
#[tokio::test]
async fn mid_turn_compaction_keeps_summary_last_and_reinjects_environment() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(assistant_message(&"x".repeat(8000))),
            ResponseEvent::OutputItemDone(response_item(
                serde_json::json!({"type":"function_call","name":"unsupported","arguments":"{}","call_id":"c"}),
            )),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("tool failed; continue")),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("done")),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
    ]));
    let (mut config, cwd) = test_config()?;
    config.model_auto_compact_token_limit = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    assert_eq!(
        finish_turn(&thread, "task").await?,
        EventMsg::TurnCompleted {
            last_agent_message: Some("done".into())
        }
    );
    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 3);
    assert_eq!(
        prompts[2].input,
        vec![
            prompts[0].input[0].clone(),
            prompts[0].input[1].clone(),
            user_message(&format!(
                "{}\ntool failed; continue",
                mini_codex_prompts::SUMMARY_PREFIX
            ))
        ]
    );
    assert!(prompts[1].input.iter().any(|item| matches!(item, ResponseItem::FunctionCallOutput { call_id: Some(id), .. } if id == "c")));
    Ok(())
}
#[tokio::test]
async fn failed_pre_turn_compaction_preserves_history_and_incoming_input() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(assistant_message(&"x".repeat(8000))),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("checkpoint")),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("done")),
            ResponseEvent::Completed {
                response_id: "response-test".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
    ]));
    let (mut config, cwd) = test_config()?;
    config.model_auto_compact_token_limit = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    finish_turn(&thread, "first").await?;
    assert_eq!(
        finish_turn(&thread, "preserve me").await?,
        EventMsg::Error("stream closed before response.completed".into())
    );
    finish_turn(&thread, "third").await?;
    let prompts = model.prompts.lock().await;
    let mut retry_input = prompts[1].input.clone();
    retry_input.insert(retry_input.len() - 1, user_message("preserve me"));
    assert_eq!(prompts[2].input, retry_input);
    Ok(())
}

#[tokio::test]
async fn remote_v2_uses_configured_provider_and_installs_encrypted_history() -> Result<()> {
    let compaction = response_item(
        serde_json::json!({"type":"compaction","id":"cmp","encrypted_content":"encrypted-checkpoint"}),
    );
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(assistant_message(&"x".repeat(8000))),
            ResponseEvent::Completed {
                response_id: "first".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(compaction.clone()),
            ResponseEvent::Completed {
                response_id: "compact".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("done")),
            ResponseEvent::Completed {
                response_id: "final".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
    ]));
    let (mut config, cwd) = test_config()?;
    config.model_provider.name = "OpenAI".into();
    config.model_provider.base_url = Some("http://configured-provider.example/v1".into());
    config.model = Some("custom-model".into());
    config.model_auto_compact_token_limit = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    finish_turn(&thread, "first").await?;
    assert_eq!(
        finish_turn(&thread, "second").await?,
        EventMsg::TurnCompleted {
            last_agent_message: Some("done".into())
        }
    );
    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 3);
    assert_eq!(
        prompts[1].input.last(),
        Some(&ResponseItem::CompactionTrigger {})
    );
    assert_eq!(prompts[1].tools, prompts[0].tools);
    assert!(prompts[1].parallel_tool_calls);
    assert_eq!(
        prompts[2].input,
        vec![
            user_message("first"),
            compaction,
            prompts[0].input[0].clone(),
            user_message("second")
        ]
    );
    assert_eq!(*model.models.lock().await, vec!["custom-model"; 3]);
    Ok(())
}

#[tokio::test]
async fn remote_v2_invalid_output_preserves_history_and_input() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(assistant_message(&"x".repeat(8000))),
            ResponseEvent::Completed {
                response_id: "first".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("invalid plaintext")),
            ResponseEvent::Completed {
                response_id: "invalid".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(response_item(
                serde_json::json!({"type":"compaction","encrypted_content":"opaque"}),
            )),
            ResponseEvent::Completed {
                response_id: "retry".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("done")),
            ResponseEvent::Completed {
                response_id: "final".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
    ]));
    let (mut config, cwd) = test_config()?;
    config.model_provider.name = "Azure".into();
    config.model_auto_compact_token_limit = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    finish_turn(&thread, "first").await?;
    assert!(matches!(
        finish_turn(&thread, "preserve").await?,
        EventMsg::Error(_)
    ));
    finish_turn(&thread, "third").await?;
    let prompts = model.prompts.lock().await;
    let mut expected = prompts[1].input.clone();
    expected.insert(expected.len() - 1, user_message("preserve"));
    assert_eq!(prompts[2].input, expected);
    Ok(())
}

#[tokio::test]
async fn remote_v2_retries_incomplete_stream_without_installing_partial_output() -> Result<()> {
    let compact =
        response_item(serde_json::json!({"type":"compaction","encrypted_content":"opaque"}));
    let model = Arc::new(ScriptedModelClient::new(vec![
        vec![
            ResponseEvent::OutputItemDone(assistant_message(&"x".repeat(8000))),
            ResponseEvent::Completed {
                response_id: "r1".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![ResponseEvent::OutputItemDone(compact.clone())],
        vec![
            ResponseEvent::OutputItemDone(compact),
            ResponseEvent::Completed {
                response_id: "r2".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
        vec![
            ResponseEvent::OutputItemDone(assistant_message("done")),
            ResponseEvent::Completed {
                response_id: "r3".into(),
                token_usage: Some(mini_codex_protocol::TokenUsage {
                    total_tokens: 2100,
                    ..Default::default()
                }),
            },
        ],
    ]));
    let (mut config, cwd) = test_config()?;
    config.model_provider.name = "OpenAI".into();
    config.model_provider.stream_max_retries = Some(1);
    config.model_auto_compact_token_limit = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    finish_turn(&thread, "first").await?;
    assert_eq!(
        finish_turn(&thread, "second").await?,
        EventMsg::TurnCompleted {
            last_agent_message: Some("done".into())
        }
    );
    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 4);
    assert_eq!(prompts[1], prompts[2]);
    assert_eq!(
        prompts[3]
            .input
            .iter()
            .filter(|item| matches!(item, ResponseItem::Compaction { .. }))
            .count(),
        1
    );
    Ok(())
}

#[tokio::test]
async fn server_usage_triggers_compaction_and_replacement_rebases_the_next_tool_step() -> Result<()>
{
    for provider_name in ["DeepSeek", "OpenAI"] {
        let checkpoint = if provider_name == "OpenAI" {
            response_item(serde_json::json!({"type":"compaction","encrypted_content":"opaque"}))
        } else {
            assistant_message("checkpoint")
        };
        let model = Arc::new(ScriptedModelClient::new(vec![
            vec![
                ResponseEvent::OutputItemDone(assistant_message("tiny")),
                ResponseEvent::Completed {
                    response_id: "first".into(),
                    token_usage: Some(mini_codex_protocol::TokenUsage {
                        total_tokens: 1500,
                        ..Default::default()
                    }),
                },
            ],
            vec![
                ResponseEvent::OutputItemDone(checkpoint),
                ResponseEvent::Completed {
                    response_id: "compact".into(),
                    token_usage: Some(mini_codex_protocol::TokenUsage {
                        total_tokens: 9000,
                        ..Default::default()
                    }),
                },
            ],
            vec![
                ResponseEvent::OutputItemDone(response_item(
                    serde_json::json!({"type":"function_call","name":"unsupported","arguments":"{}","call_id":"c"}),
                )),
                ResponseEvent::Completed {
                    response_id: "tool".into(),
                    token_usage: None,
                },
            ],
            vec![
                ResponseEvent::OutputItemDone(assistant_message("done")),
                ResponseEvent::Completed {
                    response_id: "final".into(),
                    token_usage: Some(mini_codex_protocol::TokenUsage {
                        total_tokens: 200,
                        ..Default::default()
                    }),
                },
            ],
        ]));
        let (mut config, cwd) = test_config()?;
        config.model_provider.name = provider_name.into();
        config.model_auto_compact_token_limit = Some(1000);
        let thread =
            ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
        finish_turn(&thread, "first").await?;
        assert_eq!(
            finish_turn(&thread, "second").await?,
            EventMsg::TurnCompleted {
                last_agent_message: Some("done".into())
            }
        );
        let prompts = model.prompts.lock().await;
        assert_eq!(prompts.len(), 4);
        assert!(prompts[3].input.iter().any(|item| matches!(item, ResponseItem::FunctionCallOutput {call_id:Some(id),..} if id == "c")));
        assert!(
            !prompts[3]
                .input
                .iter()
                .any(|item| matches!(item, ResponseItem::CompactionTrigger {}))
        );
    }
    Ok(())
}

fn token_budget_config(config: &mut Config) {
    use mini_codex_features::{FeatureToml, Features, FeaturesToml};
    config.features = Features::from_config_toml(Some(&FeaturesToml {
        token_budget: Some(FeatureToml::Enabled(true)),
        ..Default::default()
    }));
    config.token_budget = Some(Default::default());
    config.model_context_window = Some(10000);
    config.model_auto_compact_token_limit = Some(1000);
}

fn budget_response(total_tokens: i64, with_tool: bool) -> Vec<ResponseEvent> {
    let mut events = vec![ResponseEvent::OutputItemDone(assistant_message("answer"))];
    if with_tool {
        events.push(ResponseEvent::OutputItemDone(response_item(serde_json::json!({
            "type":"function_call", "name":"unsupported", "arguments":"{}", "call_id":"budget-tool"
        }))));
    }
    events.push(ResponseEvent::Completed {
        response_id: "budget-response".into(),
        token_usage: Some(mini_codex_protocol::TokenUsage {
            total_tokens,
            ..Default::default()
        }),
    });
    events
}

fn input_text(item: &ResponseItem) -> String {
    match item {
        ResponseItem::Message { content, .. } => content
            .iter()
            .map(|part| match part {
                mini_codex_protocol::models::ContentItem::InputText { text }
                | mini_codex_protocol::models::ContentItem::OutputText { text } => text.as_str(),
            })
            .collect(),
        _ => String::new(),
    }
}

#[tokio::test]
async fn token_budget_pre_turn_rollover_skips_local_and_remote_summarization() -> Result<()> {
    // 开启后，支持 V2 与不支持 V2 的 provider 均不发送摘要请求。
    for remote in [false, true] {
        let model = Arc::new(ScriptedModelClient::new(vec![
            budget_response(2100, false),
            budget_response(100, false),
        ]));
        let (mut config, cwd) = test_config()?;
        token_budget_config(&mut config);
        if remote {
            config.model_provider.name = "OpenAI".into();
        }
        let thread =
            ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
        assert!(matches!(
            finish_turn(&thread, "first").await?,
            EventMsg::TurnCompleted { .. }
        ));
        assert!(matches!(
            finish_turn(&thread, "second").await?,
            EventMsg::TurnCompleted { .. }
        ));
        let prompts = model.prompts.lock().await;
        assert_eq!(prompts.len(), 2);
        assert_eq!(prompts[1].instructions, "instructions");
        assert!(!prompts[1].tools.is_empty());
        assert_eq!(prompts[1].input.len(), 3);
        assert_eq!(prompts[1].input[0], prompts[0].input[0]);
        assert_eq!(prompts[1].input.last(), Some(&user_message("second")));
        let first = input_text(&prompts[0].input[1]);
        let next = input_text(&prompts[1].input[1]);
        assert!(first.contains("First context window id:"));
        assert!(!first.contains("Previous context window id:"));
        assert!(next.contains("Previous context window id:"));
        assert_ne!(first, next);
        assert!(
            !prompts[1]
                .input
                .iter()
                .any(|item| input_text(item) == "first" || input_text(item) == "answer")
        );
    }
    Ok(())
}

#[tokio::test]
async fn token_budget_mid_turn_rollover_installs_only_initial_context() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        budget_response(2100, true),
        budget_response(100, false),
    ]));
    let (mut config, cwd) = test_config()?;
    token_budget_config(&mut config);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    assert!(matches!(
        finish_turn(&thread, "task").await?,
        EventMsg::TurnCompleted { .. }
    ));
    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 2);
    assert_eq!(prompts[1].input.len(), 2);
    assert_eq!(prompts[1].input[0], prompts[0].input[0]);
    assert!(input_text(&prompts[1].input[1]).contains("Previous context window id:"));
    Ok(())
}

#[tokio::test]
async fn token_budget_reminder_and_fallback_are_once_per_window() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        budget_response(1100, true),
        budget_response(1150, true),
        budget_response(2100, true),
        budget_response(100, false),
    ]));
    let (mut config, cwd) = test_config()?;
    token_budget_config(&mut config);
    let budget = config.token_budget.as_mut().unwrap();
    budget.reminder_threshold_tokens = Some(100);
    budget.reminder_message_template = "剩余 {n_remaining}".into();
    budget.auto_compact_fallback_prompt = Some("保存收尾信息".into());
    budget.auto_compact_fallback_buffer_tokens = Some(1000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    assert!(matches!(
        finish_turn(&thread, "task").await?,
        EventMsg::TurnCompleted { .. }
    ));
    let prompts = model.prompts.lock().await;
    assert_eq!(prompts.len(), 4);
    for index in [1, 2] {
        assert_eq!(
            prompts[index]
                .input
                .iter()
                .filter(|item| input_text(item) == "剩余 0")
                .count(),
            1
        );
        assert_eq!(
            prompts[index]
                .input
                .iter()
                .filter(|item| input_text(item) == "保存收尾信息")
                .count(),
            1
        );
    }
    assert_eq!(prompts[3].input.len(), 2);
    Ok(())
}

#[tokio::test]
async fn token_budget_fallback_buffer_does_not_extend_full_context_cap() -> Result<()> {
    let model = Arc::new(ScriptedModelClient::new(vec![
        budget_response(2100, true),
        budget_response(100, false),
    ]));
    let (mut config, cwd) = test_config()?;
    token_budget_config(&mut config);
    config.model_context_window = Some(2000);
    let budget = config.token_budget.as_mut().unwrap();
    budget.auto_compact_fallback_prompt = Some("收尾".into());
    budget.auto_compact_fallback_buffer_tokens = Some(10000);
    let thread = ThreadManager::new(config, model.clone(), "instructions".into()).start_thread(cwd);
    assert!(matches!(
        finish_turn(&thread, "task").await?,
        EventMsg::TurnCompleted { .. }
    ));
    assert_eq!(model.prompts.lock().await[1].input.len(), 2);
    Ok(())
}
