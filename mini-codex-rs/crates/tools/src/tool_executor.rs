use std::future::Future;
use std::pin::Pin;

use crate::FunctionCallError;
use crate::ToolName;
use crate::ToolOutput;
use crate::ToolSearchInfo;
use crate::ToolSpec;

/// 只保留当前支持的直接、延迟与隐藏曝光；Code Mode 分支尚未移植。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ToolExposure {
    Direct,
    Deferred,
    Hidden,
}

impl ToolExposure {
    pub fn is_direct(self) -> bool {
        matches!(self, Self::Direct)
    }
    pub fn is_deferred(self) -> bool {
        matches!(self, Self::Deferred)
    }
}

pub type ToolExecutorFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Box<dyn ToolOutput>, FunctionCallError>> + Send + 'a>>;

pub trait ToolExecutor<Invocation>: Send + Sync {
    fn tool_name(&self) -> ToolName;
    fn spec(&self) -> ToolSpec;

    fn exposure(&self) -> ToolExposure {
        ToolExposure::Direct
    }

    fn search_info(&self) -> Option<ToolSearchInfo> {
        ToolSearchInfo::from_tool_spec(self.spec(), None)
    }

    fn supports_parallel_tool_calls(&self) -> bool {
        false
    }

    fn handle<'a>(&'a self, invocation: Invocation) -> ToolExecutorFuture<'a>
    where
        Invocation: 'a;
}
