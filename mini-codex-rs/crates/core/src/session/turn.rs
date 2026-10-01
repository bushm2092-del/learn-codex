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

use super::context_window::context_window_token_status;
use crate::Prompt;
use crate::ResponseEvent;
use crate::compact::{InitialContextInjection, run_inline_auto_compact_task};
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
    let model_info: mini_codex_protocol::openai_models::ModelInfo = session.model_info().await;
    if context_window_token_status(&session)
        .await
        .token_limit_reached
    {
        if let Err(error) =
            run_auto_compact(Arc::clone(&session), InitialContextInjection::DoNotInject).await
        {
            // 上游在采样前压缩失败时仍保存本次用户输入。
            session.history.lock().await.record_items(
                &[ResponseItem::Message {
                    id: None,
                    role: "user".to_string(),
                    content: vec![ContentItem::InputText { text: user_text }],
                    phase: None,
                }],
                model_info.truncation_policy,
            );
            return Err(error);
        }
        if !session
            .config
            .features
            .enabled(mini_codex_features::Feature::TokenBudget)
        {
            let initial =
                super::world_state::initial_world_state(&session.cwd, &session.user_shell());
            session
                .history
                .lock()
                .await
                .record_items(&initial, model_info.truncation_policy);
        }
    }
    session.history.lock().await.record_items(
        &[ResponseItem::Message {
            id: None,
            role: "user".to_string(),
            content: vec![ContentItem::InputText { text: user_text }],
            phase: None,
        }],
        model_info.truncation_policy,
    );

    let mut last_agent_message = None;
    loop {
        let prompt: Prompt = Prompt {
            input: session.history.lock().await.clone().for_prompt(),
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
                ResponseEvent::ServerReasoningIncluded(included) => {
                    session.set_server_reasoning_included(included)
                }
                ResponseEvent::OutputTextDelta(delta) => {
                    session
                        .send_event(Event {
                            submission_id: submission_id.to_string(),
                            msg: EventMsg::AgentMessageDelta(delta),
                        })
                        .await;
                }
                ResponseEvent::OutputItemDone(item) => {
                    session
                        .history
                        .lock()
                        .await
                        .record_items(&[item.clone()], model_info.truncation_policy);
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
                ResponseEvent::Completed { token_usage, .. } => {
                    session.update_token_usage_info(token_usage.as_ref()).await;
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
            session.history.lock().await.record_items(
                &[ResponseItem::from(response)],
                model_info.truncation_policy,
            );
        }

        let token_status = context_window_token_status(&session).await;
        let should_roll_over = needs_follow_up && token_status.token_limit_reached;
        super::token_budget::maybe_record(
            &session,
            token_status.base_window_tokens_remaining,
            !should_roll_over && !token_status.token_limit_reached,
        )
        .await;
        if should_roll_over {
            run_auto_compact(
                Arc::clone(&session),
                InitialContextInjection::BeforeLastUserMessage,
            )
            .await?;
            continue;
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

pub(crate) fn get_last_assistant_message_from_turn(items: &[ResponseItem]) -> Option<String> {
    items.iter().rev().find_map(|item| match item {
        ResponseItem::Message { role, .. } if role == "assistant" => output_text(item),
        _ => None,
    })
}

async fn run_auto_compact(session: Arc<Session>, injection: InitialContextInjection) -> Result<()> {
    if session
        .config
        .features
        .enabled(mini_codex_features::Feature::TokenBudget)
    {
        return crate::compact_token_budget::run_inline_auto_compact_task(session, injection).await;
    }
    use mini_codex_model_provider::{ConfiguredModelProvider, RemoteCompactionSupport};
    let provider = ConfiguredModelProvider::new(session.config.model_provider.clone());
    match provider.capabilities().remote_compaction {
        RemoteCompactionSupport::V2 => {
            crate::compact_remote_v2::run_inline_remote_auto_compact_task(session, injection).await
        }
        RemoteCompactionSupport::Unsupported => {
            run_inline_auto_compact_task(session, injection).await
        }
    }
}
