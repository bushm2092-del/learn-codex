use indexmap::IndexMap;
use std::sync::Arc;

use mini_codex_tools::ToolExecutor;
use mini_codex_tools::ToolName;

use crate::function_tool::FunctionCallError;
use crate::tools::context::ToolInvocation;
use crate::tools::context::ToolOutput;
use crate::tools::context::ToolPayload;

pub(crate) trait CoreToolRuntime: ToolExecutor<ToolInvocation> {
    fn immutable_spec(&self) -> Option<&Arc<mini_codex_tools::ToolSpec>> {
        None
    }
}

impl<T> CoreToolRuntime for T where T: ToolExecutor<ToolInvocation> {}

pub(crate) struct AnyToolResult {
    pub(crate) call_id: String,
    pub(crate) payload: ToolPayload,
    pub(crate) result: Box<dyn ToolOutput>,
}

#[derive(Default)]
pub(crate) struct ToolRegistry {
    tools: IndexMap<ToolName, RegisteredTool>,
}

pub(crate) struct RegisteredTool {
    pub(crate) runtime: Arc<dyn CoreToolRuntime>,
    pub(crate) exposure: mini_codex_tools::ToolExposure,
}

impl ToolRegistry {
    pub(crate) fn add<T>(&mut self, handler: T)
    where
        T: CoreToolRuntime + 'static,
    {
        self.register_trusted(Arc::new(handler));
    }

    pub(crate) fn register_trusted(&mut self, runtime: Arc<dyn CoreToolRuntime>) {
        let exposure = runtime.exposure();
        self.register_trusted_with_exposure(runtime, exposure);
    }

    pub(crate) fn register_trusted_with_exposure(
        &mut self,
        runtime: Arc<dyn CoreToolRuntime>,
        exposure: mini_codex_tools::ToolExposure,
    ) {
        let tool_name = runtime.tool_name().with_default_namespace();
        assert!(
            self.tools
                .insert(tool_name.clone(), RegisteredTool { runtime, exposure })
                .is_none(),
            "tool {tool_name} already registered"
        );
    }

    pub(crate) fn entries(&self) -> impl Iterator<Item = &RegisteredTool> {
        self.tools.values()
    }

    pub(crate) fn tool(&self, name: &ToolName) -> Option<Arc<dyn CoreToolRuntime>> {
        self.tools
            .get(&name.clone().with_default_namespace())
            .map(|tool| Arc::clone(&tool.runtime))
    }

    pub(crate) fn supports_parallel_tool_calls(&self, name: &ToolName) -> Option<bool> {
        self.tool(name)
            .map(|tool| tool.supports_parallel_tool_calls())
    }

    pub(crate) async fn dispatch_any_with_state(
        &self,
        invocation: ToolInvocation,
    ) -> Result<AnyToolResult, FunctionCallError> {
        let tool = self.tool(&invocation.tool_name).ok_or_else(|| {
            FunctionCallError::RespondToModel(format!("unsupported call: {}", invocation.tool_name))
        })?;
        let call_id = invocation.call_id.clone();
        let payload = invocation.payload.clone();
        let result = tool.handle(invocation).await?;
        Ok(AnyToolResult {
            call_id,
            payload,
            result,
        })
    }
}
