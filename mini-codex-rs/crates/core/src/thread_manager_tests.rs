use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use anyhow::Result;
use mini_codex_config::ConfigToml;
use mini_codex_features::FeaturesToml;

use super::*;
use crate::ResponseStream;
use crate::config::ConfigOverrides;

struct UnusedModelClient;

impl ModelClient for UnusedModelClient {
    fn stream(
        &self,
        _prompt: crate::Prompt,
        _model: String,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>> {
        Box::pin(async { unreachable!("model is not called by registry tests") })
    }
}

fn manager_with_unified_exec(enabled: bool) -> ThreadManager {
    let cwd = std::env::temp_dir();
    let config = Config::load_from_base_config_with_overrides(
        ConfigToml {
            features: Some(FeaturesToml {
                unified_exec: Some(enabled),
                unified_exec_tty: Some(true),
                ..Default::default()
            }),
            ..Default::default()
        },
        ConfigOverrides {
            cwd: Some(cwd.clone()),
            ..Default::default()
        },
        cwd,
    )
    .unwrap();
    ThreadManager::new(config, Arc::new(UnusedModelClient), "test".to_string())
}

#[test]
fn unified_exec_registers_exec_and_write_stdin() {
    let manager = manager_with_unified_exec(true);
    let specs = manager.tool_router.model_visible_specs();
    let names = specs.iter().map(|tool| tool.name()).collect::<Vec<_>>();
    assert_eq!(names, vec!["exec_command", "write_stdin"]);
}

#[test]
fn disabled_unified_exec_registers_one_shot_only() {
    let manager = manager_with_unified_exec(false);
    let specs = manager.tool_router.model_visible_specs();
    assert_eq!(specs.len(), 1);
    assert_eq!(specs[0].name(), "exec_command");
    let mini_codex_tools::ToolSpec::Function(tool) = &specs[0] else {
        panic!("expected function")
    };
    assert!(tool.parameters["properties"].get("timeout_ms").is_some());
    assert!(tool.parameters["properties"].get("yield_time_ms").is_none());
}
