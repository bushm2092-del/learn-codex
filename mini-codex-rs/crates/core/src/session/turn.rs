use std::sync::Arc;

use anyhow::Context;
use anyhow::Result;
use futures::StreamExt;
use mini_codex_protocol::Event;
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::FunctionCall;
use serde_json::Value;

use crate::Prompt;
use crate::ResponseEvent;
use crate::session::Session;

const MAX_SAMPLING_STEPS: usize = 32;

/// 中层 agent 循环：采样、执行模型请求的工具、追加输出，然后重复。
pub(crate) async fn run_turn(
    session: Arc<Session>,
    submission_id: &str,
    user_text: String,
) -> Result<()> {
    session
        .send_event(Event {
            submission_id: submission_id.to_string(),
            msg: EventMsg::TurnStarted,
        })
        .await;
    session.history.lock().await.record(serde_json::json!({
        "role": "user",
        "content": [{"type": "input_text", "text": user_text}]
    }));

    let mut last_agent_message = None;
    for _step in 0..MAX_SAMPLING_STEPS {
        let prompt = Prompt {
            input: session.history.lock().await.for_prompt(),
            tools: session.tool_router.model_visible_specs(),
            instructions: session.instructions.clone(),
        };
        let mut stream = session.model_client.stream(prompt).await?;
        let mut needs_follow_up = false;

        while let Some(event) = stream.next().await {
            match event? {
                ResponseEvent::OutputTextDelta(delta) => {
                    session
                        .send_event(Event {
                            submission_id: submission_id.to_string(),
                            msg: EventMsg::AgentMessageDelta(delta),
                        })
                        .await;
                }
                ResponseEvent::OutputItemDone(item) => {
                    session.history.lock().await.record(item.clone());
                    match item.get("type").and_then(Value::as_str) {
                        Some("function_call") => {
                            let call: FunctionCall =
                                serde_json::from_value(item).context("function_call 响应项无效")?;
                            let call_id = call.call_id.clone();
                            let name = call.name.clone();
                            let arguments: Value = serde_json::from_str(&call.arguments)
                                .context("工具参数不是有效的 JSON")?;
                            session
                                .send_event(Event {
                                    submission_id: submission_id.to_string(),
                                    msg: EventMsg::ToolCallStarted {
                                        call_id: call_id.clone(),
                                        name: name.clone(),
                                        arguments: arguments.clone(),
                                    },
                                })
                                .await;
                            let result = session
                                .tool_router
                                .dispatch(&name, arguments, &session.cwd)
                                .await;
                            let output = result.output;
                            let success = result.success;
                            session.history.lock().await.record(serde_json::json!({
                                "type": "function_call_output",
                                "call_id": call_id,
                                "output": output
                            }));
                            session
                                .send_event(Event {
                                    submission_id: submission_id.to_string(),
                                    msg: EventMsg::ToolCallCompleted {
                                        call_id,
                                        name,
                                        output,
                                        success,
                                    },
                                })
                                .await;
                            needs_follow_up = true;
                        }
                        Some("message") => {
                            if let Some(text) = output_text(&item) {
                                last_agent_message = Some(text.clone());
                                session
                                    .send_event(Event {
                                        submission_id: submission_id.to_string(),
                                        msg: EventMsg::AgentMessage(text),
                                    })
                                    .await;
                            }
                        }
                        _ => {}
                    }
                }
                ResponseEvent::Completed => break,
            }
        }

        if !needs_follow_up {
            session
                .send_event(Event {
                    submission_id: submission_id.to_string(),
                    msg: EventMsg::TurnCompleted { last_agent_message },
                })
                .await;
            return Ok(());
        }
    }

    anyhow::bail!("本轮超过 {MAX_SAMPLING_STEPS} 次模型采样上限")
}

fn output_text(item: &Value) -> Option<String> {
    let content = item.get("content")?.as_array()?;
    let text = content
        .iter()
        .filter(|part| part.get("type").and_then(Value::as_str) == Some("output_text"))
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<String>();
    (!text.is_empty()).then_some(text)
}
