use std::time::Duration;

use super::ExecCommandRequest;
use super::UnifiedExecError;
use super::UnifiedExecProcessManager;
use crate::tools::context::ExecCommandToolOutput;

impl UnifiedExecProcessManager {
    pub(crate) async fn exec_command_to_completion(
        &self,
        request: ExecCommandRequest,
        timeout: Duration,
    ) -> Result<ExecCommandToolOutput, UnifiedExecError> {
        self.exec_command_inner(request, Some(timeout)).await
    }
}
