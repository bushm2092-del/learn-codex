use pretty_assertions::assert_eq;

use super::CommandToolOptions;
use super::create_exec_command_tool;
use super::create_write_stdin_tool;
use mini_codex_tools::ToolSpec;

#[test]
fn exec_command_schema_matches_interactive_shape() {
    let ToolSpec::Function(tool) = create_exec_command_tool(CommandToolOptions {
        allow_login_shell: false,
        include_windows_shell_guidance: false,
    }) else {
        panic!("expected function")
    };
    assert_eq!(tool.name, "exec_command");
    assert_eq!(tool.strict, false);
    assert_eq!(tool.parameters["required"], serde_json::json!(["cmd"]));
    assert!(tool.parameters["properties"].get("tty").is_some());
    assert!(tool.parameters["properties"].get("yield_time_ms").is_some());
    assert!(tool.parameters["properties"].get("timeout_ms").is_none());
    assert!(tool.output_schema.is_some());
    let serialized = serde_json::to_value(&tool).unwrap();
    assert_eq!(serialized.get("output_schema"), None);
}

#[test]
fn write_stdin_schema_requires_session_id() {
    let ToolSpec::Function(tool) = create_write_stdin_tool() else {
        panic!("expected function")
    };
    assert_eq!(
        tool.parameters["required"],
        serde_json::json!(["session_id"])
    );
}
