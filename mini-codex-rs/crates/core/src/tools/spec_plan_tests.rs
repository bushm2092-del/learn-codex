use super::*;
use crate::session::Session;
use crate::tools::context::ToolInvocation;
use crate::{ModelClient, Prompt, ResponseEvent, ResponseStream};
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::models::ResponseItem;
use mini_codex_tools::{
    FunctionToolOutput, ResponsesApiTool, ToolExecutor, ToolExecutorFuture, ToolExposure,
};
use pretty_assertions::assert_eq;
use serde_json::json;
use std::collections::VecDeque;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::Mutex;

struct TestTool {
    name: &'static str,
    exposure: ToolExposure,
}

impl ToolExecutor<ToolInvocation> for TestTool {
    fn tool_name(&self) -> ToolName {
        ToolName::plain(self.name)
    }
    fn spec(&self) -> ToolSpec {
        ToolSpec::Function(ResponsesApiTool {
            name: self.name.to_string(),
            description: format!("{} calendar appointments", self.name),
            strict: false,
            defer_loading: None,
            parameters: json!({"type":"object", "properties":{"city":{"type":"string", "description":"city name"}}}),
            output_schema: Some(json!({"type":"string"})),
        })
    }
    fn exposure(&self) -> ToolExposure {
        self.exposure
    }
    fn handle<'a>(&'a self, _invocation: ToolInvocation) -> ToolExecutorFuture<'a>
    where
        ToolInvocation: 'a,
    {
        Box::pin(async {
            Ok(Box::new(FunctionToolOutput::from_text(
                "found appointments".to_string(),
                Some(true),
            )) as Box<dyn mini_codex_tools::ToolOutput>)
        })
    }
}

fn registry() -> ToolRegistry {
    let mut registry = ToolRegistry::default();
    registry.add(TestTool {
        name: "direct",
        exposure: ToolExposure::Direct,
    });
    registry.add(TestTool {
        name: "calendar_lookup",
        exposure: ToolExposure::Deferred,
    });
    registry.add(TestTool {
        name: "hidden",
        exposure: ToolExposure::Hidden,
    });
    registry
}

fn model_info() -> ModelInfo {
    let mut model = mini_codex_models_manager::bundled_models_response()
        .unwrap()
        .models
        .remove(0);
    model.supports_search_tool = true;
    model
}

#[test]
fn exposure_filters_specs_and_search_requires_both_capabilities() {
    for supports_search in [false, true] {
        for namespace_tools in [false, true] {
            let mut model = model_info();
            model.supports_search_tool = supports_search;
            let router = finalize_tool_router(
                &model,
                &ProviderCapabilities {
                    namespace_tools,
                    ..ProviderCapabilities::default()
                },
                registry(),
                &ToolSearchHandlerCache::default(),
            );
            let expected = if supports_search && namespace_tools {
                vec!["direct", "tool_search"]
            } else {
                vec!["direct"]
            };
            assert_eq!(
                router
                    .model_visible_specs()
                    .iter()
                    .map(ToolSpec::name)
                    .collect::<Vec<_>>(),
                expected
            );
        }
    }
    let mut only_direct = ToolRegistry::default();
    only_direct.add(TestTool {
        name: "direct",
        exposure: ToolExposure::Direct,
    });
    let router = finalize_tool_router(
        &model_info(),
        &ProviderCapabilities {
            namespace_tools: true,
            ..ProviderCapabilities::default()
        },
        only_direct,
        &ToolSearchHandlerCache::default(),
    );
    assert_eq!(
        router
            .model_visible_specs()
            .iter()
            .map(ToolSpec::name)
            .collect::<Vec<_>>(),
        vec!["direct"]
    );
}

#[test]
fn cache_reuses_dynamic_metadata_and_rebuilds_after_registry_changes() {
    let cache = ToolSearchHandlerCache::default();
    let registry = registry();
    let first = cache.get_or_build(&registry, ToolSearchSourceListing::Omit);
    let second = cache.get_or_build(&registry, ToolSearchSourceListing::Omit);
    assert!(Arc::ptr_eq(&first, &second));
    let empty = cache.get_or_build(&ToolRegistry::default(), ToolSearchSourceListing::Omit);
    assert!(!Arc::ptr_eq(&first, &empty));
}

struct ScriptedModel {
    responses: Mutex<VecDeque<Vec<ResponseEvent>>>,
    prompts: Mutex<Vec<Prompt>>,
}
impl ModelClient for ScriptedModel {
    fn stream(
        &self,
        prompt: Prompt,
        _model: String,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<ResponseStream>> + Send + '_>> {
        Box::pin(async move {
            self.prompts.lock().await.push(prompt);
            let events = self
                .responses
                .lock()
                .await
                .pop_front()
                .expect("scripted response");
            Ok(Box::pin(futures::stream::iter(events.into_iter().map(Ok))) as ResponseStream)
        })
    }
}

fn item(value: serde_json::Value) -> ResponseEvent {
    ResponseEvent::OutputItemDone(serde_json::from_value(value).unwrap())
}

async fn run_script(responses: Vec<Vec<ResponseEvent>>) -> Vec<Prompt> {
    let model = Arc::new(ScriptedModel {
        responses: Mutex::new(responses.into()),
        prompts: Mutex::new(Vec::new()),
    });
    let router = finalize_tool_router(
        &model_info(),
        &ProviderCapabilities {
            namespace_tools: true,
            ..ProviderCapabilities::default()
        },
        registry(),
        &ToolSearchHandlerCache::default(),
    );
    let thread = Session::spawn(
        model.clone(),
        Arc::new(router),
        String::new(),
        std::env::temp_dir(),
        "test".to_string(),
        Arc::new(
            crate::config::Config::load_from_base_config_with_overrides(
                mini_codex_config::ConfigToml::default(),
                crate::config::ConfigOverrides::default(),
                std::env::temp_dir(),
            )
            .unwrap(),
        ),
    );
    thread
        .start_turn("Find my calendar appointments".to_string())
        .await
        .unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let event = thread.next_event().await.unwrap();
            match event.msg {
                EventMsg::TurnCompleted { .. } => break,
                EventMsg::Error(error) => panic!("{error}"),
                _ => {}
            }
        }
    })
    .await
    .unwrap();
    thread.shutdown().await.unwrap();
    model.prompts.lock().await.clone()
}

#[tokio::test]
async fn deferred_search_definitions_enter_history_then_tool_executes() {
    let prompts = run_script(vec![
        vec![item(json!({"type":"tool_search_call", "call_id":"search-1", "execution":"client", "arguments":{"query":"calendar", "limit":8}})), ResponseEvent::Completed { response_id: "response-test".into() , token_usage: None}],
        vec![item(json!({"type":"function_call", "call_id":"call-1", "namespace":"functions", "name":"calendar_lookup", "arguments":"{}"})), ResponseEvent::Completed { response_id: "response-test".into() , token_usage: None}],
        vec![ResponseEvent::Completed { response_id: "response-test".into() , token_usage: None}],
    ]).await;
    assert_eq!(prompts.len(), 3);
    assert!(
        !prompts[0]
            .tools
            .iter()
            .any(|tool| tool.name() == "calendar_lookup")
    );
    let discovered = prompts[1]
        .input
        .iter()
        .find(|item| matches!(item, ResponseItem::ToolSearchOutput { .. }))
        .unwrap();
    assert_eq!(
        serde_json::to_value(discovered).unwrap(),
        json!({
            "type":"tool_search_output", "call_id":"search-1", "status":"completed", "execution":"client",
            "tools":[{"type":"namespace", "name":"functions", "description":"", "tools":[{
                "type":"function", "name":"calendar_lookup", "description":"calendar_lookup calendar appointments",
                "strict":false, "defer_loading":true,
                "parameters":{"type":"object","properties":{"city":{"type":"string","description":"city name"}}}
            }]}]
        })
    );
    assert_eq!(prompts[0].tools, prompts[1].tools);
    let output = prompts[2]
        .input
        .iter()
        .find(|item| matches!(item, ResponseItem::FunctionCallOutput { .. }))
        .unwrap();
    assert_eq!(
        serde_json::to_value(output).unwrap(),
        json!({"type":"function_call_output","call_id":"call-1","output":"found appointments"})
    );
}

#[tokio::test]
async fn empty_queries_zero_limit_and_no_matches_return_empty_search_output() {
    for args in [
        json!({"query":" "}),
        json!({"query":"calendar", "limit":0}),
        json!({"query":"zzzzunmatchedtoken"}),
    ] {
        let prompts = run_script(vec![
            vec![item(json!({"type":"tool_search_call","call_id":"search-empty","execution":"client","arguments":args})), ResponseEvent::Completed { response_id: "response-test".into() , token_usage: None}],
            vec![ResponseEvent::Completed { response_id: "response-test".into() , token_usage: None}],
        ]).await;
        let output = prompts[1]
            .input
            .iter()
            .find(|item| matches!(item, ResponseItem::ToolSearchOutput { .. }))
            .unwrap();
        assert_eq!(
            serde_json::to_value(output).unwrap(),
            json!({"type":"tool_search_output","call_id":"search-empty","execution":"client","status":"completed","tools":[]})
        );
    }
}

#[test]
fn router_ignores_server_search_and_rejects_malformed_client_arguments() {
    let server: ResponseItem = serde_json::from_value(
        json!({"type":"tool_search_call","call_id":"s","execution":"server","arguments":{}}),
    )
    .unwrap();
    assert_eq!(ToolRouter::build_tool_call(server).unwrap(), None);
    let malformed: ResponseItem = serde_json::from_value(json!({"type":"tool_search_call","call_id":"s","execution":"client","arguments":{"query":5}})).unwrap();
    assert!(matches!(
        ToolRouter::build_tool_call(malformed),
        Err(crate::function_tool::FunctionCallError::RespondToModel(_))
    ));
}
