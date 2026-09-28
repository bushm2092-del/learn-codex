use std::sync::Arc;

use anyhow::Context;
use anyhow::Result;
use futures::StreamExt;
use futures::stream::FuturesOrdered;
use mini_codex_protocol::Event;
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::models::ContentItem;
use mini_codex_protocol::models::ResponseInputItem;
use mini_codex_protocol::models::ResponseItem;

use crate::Prompt;
use crate::ResponseEvent;
use crate::session::Session;
use crate::tools::parallel::ToolCallRuntime;
use crate::tools::router::ToolRouter;

type InFlightFuture = futures::future::BoxFuture<'static, Result<ResponseInputItem>>;

/// 中层 agent 循环：采样、收集工具 future、记录结果，再决定是否继续。
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
    session.history.lock().await.record(ResponseItem::Message {
        id: None,
        role: "user".to_string(),
        content: vec![ContentItem::InputText { text: user_text }],
        phase: None,
    });

    let mut last_agent_message = None;
    loop {
        let prompt = Prompt {
            input: session.history.lock().await.for_prompt(),
            tools: session.tool_router.model_visible_specs().to_vec(),
            parallel_tool_calls: true,
            instructions: session.instructions.clone(),
        };
        let model = session.settings.lock().await.model.clone();
        let mut stream = session.model_client.stream(prompt, model).await?;
        let tool_runtime = ToolCallRuntime::new(Arc::clone(&session), submission_id.to_string());
        let mut in_flight = FuturesOrdered::<InFlightFuture>::new();
        let mut needs_follow_up = false;
        let mut response_completed = false;

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
                    match ToolRouter::build_tool_call(item.clone()) {
                        Ok(Some(call)) => {
                            let runtime = tool_runtime.clone();
                            in_flight.push_back(Box::pin(async move {
                                runtime.handle_tool_call(call).await.map_err(Into::into)
                            }));
                            needs_follow_up = true;
                        }
                        Ok(None) => {
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
                        Err(error) => return Err(error.into()),
                    }
                }
                ResponseEvent::Completed => {
                    response_completed = true;
                    break;
                }
            }
        }

        if !response_completed {
            anyhow::bail!("stream closed before response.completed");
        }

        while let Some(result) = in_flight.next().await {
            let response = result.context("in-flight tool future failed during drain")?;
            session
                .history
                .lock()
                .await
                .record(ResponseItem::from(response));
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
}

fn output_text(item: &ResponseItem) -> Option<String> {
    let ResponseItem::Message { content, .. } = item else {
        return None;
    };
    let text = content
        .iter()
        .map(|part| match part {
            ContentItem::OutputText { text } => text.as_str(),
            ContentItem::InputText { .. } => "",
        })
        .collect::<String>();
    (!text.is_empty()).then_some(text)
}
