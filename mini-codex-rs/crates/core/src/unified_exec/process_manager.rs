use std::num::NonZeroUsize;
use std::sync::Arc;
use std::time::Duration;

use tokio::time::Instant;

use super::ExecCommandRequest;
use super::MIN_EMPTY_YIELD_TIME_MS;
use super::ProcessEntry;
use super::UnifiedExecError;
use super::UnifiedExecProcess;
use super::UnifiedExecProcessManager;
use super::WriteStdinRequest;
use super::clamp_yield_time;
use super::generate_chunk_id;
use crate::tools::context::ExecCommandToolOutput;

impl UnifiedExecProcessManager {
    pub(crate) async fn exec_command(
        &self,
        request: ExecCommandRequest,
    ) -> Result<ExecCommandToolOutput, UnifiedExecError> {
        self.exec_command_inner(request, None).await
    }

    pub(super) async fn exec_command_inner(
        &self,
        request: ExecCommandRequest,
        completion_timeout: Option<Duration>,
    ) -> Result<ExecCommandToolOutput, UnifiedExecError> {
        let command = if matches!(request.shell_type, crate::shell::ShellType::PowerShell) {
            mini_codex_shell_command::powershell::prefix_powershell_script_with_utf8(
                &request.command,
            )
        } else {
            request.command.clone()
        };
        let process = match UnifiedExecProcess::spawn(&command, &request.cwd, request.tty) {
            Ok(process) => process,
            Err(error) => {
                self.release_process_id(request.process_id).await;
                return Err(error);
            }
        };
        let pruned_entry = {
            let mut store = self.process_store.lock().await;
            let pruned_entry = Self::prune_processes_if_needed(&mut store);
            store.processes.insert(
                request.process_id,
                ProcessEntry {
                    process: Arc::clone(&process),
                    last_used: Instant::now(),
                },
            );
            pruned_entry
        };
        if let Some(pruned_entry) = pruned_entry {
            // 淘汰旧进程失败不能把已经成功启动的新命令改写成失败结果。
            let _ = pruned_entry.process.terminate().await;
        }

        let start = Instant::now();
        let wait = completion_timeout
            .unwrap_or_else(|| Duration::from_millis(clamp_yield_time(request.yield_time_ms)));
        let deadline = start
            .checked_add(wait)
            .ok_or_else(|| UnifiedExecError::process_failed("timeout_ms is too large".into()))?;
        let mut exit_code = match wait_until_deadline(&process, deadline).await {
            Ok(exit_code) => exit_code,
            Err(error) => {
                self.release_process_id(request.process_id).await;
                let _ = process.terminate().await;
                return Err(error);
            }
        };
        if completion_timeout.is_some() && exit_code.is_none() {
            if let Err(error) = process.terminate().await {
                self.release_process_id(request.process_id).await;
                return Err(error);
            }
            exit_code = match wait_for_exit(&process, Duration::from_secs(2)).await {
                Ok(exit_code) => exit_code.or(Some(-1)),
                Err(error) => {
                    self.release_process_id(request.process_id).await;
                    return Err(error);
                }
            };
        }
        let wall_time = start.elapsed();
        let output = process.take_output();
        let original_token_count = output.total_bytes().div_ceil(4);
        let omitted = NonZeroUsize::new(output.omitted_bytes());
        let raw_output = output.to_bytes_with_omission_marker();
        let process_id = if exit_code.is_none() && completion_timeout.is_none() {
            Some(request.process_id)
        } else {
            self.release_process_id(request.process_id).await;
            None
        };

        Ok(ExecCommandToolOutput {
            chunk_id: generate_chunk_id(),
            wall_time,
            raw_output,
            max_output_tokens: request.max_output_tokens,
            process_id,
            exit_code,
            original_token_count: Some(original_token_count),
            output_omitted_bytes: omitted,
        })
    }

    pub(crate) async fn write_stdin(
        &self,
        request: WriteStdinRequest<'_>,
    ) -> Result<ExecCommandToolOutput, UnifiedExecError> {
        let process = {
            let mut store = self.process_store.lock().await;
            let entry = store.processes.get_mut(&request.process_id).ok_or(
                UnifiedExecError::UnknownProcessId {
                    process_id: request.process_id,
                },
            )?;
            entry.last_used = Instant::now();
            Arc::clone(&entry.process)
        };
        let _interaction_guard = process.interaction_lock().lock().await;
        if !request.input.is_empty() {
            process.write_stdin(request.input).await?;
        }
        let yield_time_ms = if request.input.is_empty() {
            request
                .yield_time_ms
                .clamp(MIN_EMPTY_YIELD_TIME_MS, self.max_write_stdin_yield_time_ms)
        } else {
            clamp_yield_time(request.yield_time_ms)
        };
        let start = Instant::now();
        let deadline = start
            .checked_add(Duration::from_millis(yield_time_ms))
            .ok_or_else(|| UnifiedExecError::process_failed("yield_time_ms is too large".into()))?;
        let exit_code = wait_until_deadline(&process, deadline).await?;
        let output = process.take_output();
        let original_token_count = output.total_bytes().div_ceil(4);
        let omitted = NonZeroUsize::new(output.omitted_bytes());
        let raw_output = output.to_bytes_with_omission_marker();
        let process_id = if exit_code.is_none() {
            Some(request.process_id)
        } else {
            self.release_process_id(request.process_id).await;
            None
        };
        Ok(ExecCommandToolOutput {
            chunk_id: generate_chunk_id(),
            wall_time: start.elapsed(),
            raw_output,
            max_output_tokens: request.max_output_tokens,
            process_id,
            exit_code,
            original_token_count: Some(original_token_count),
            output_omitted_bytes: omitted,
        })
    }
}

async fn wait_until_deadline(
    process: &UnifiedExecProcess,
    deadline: Instant,
) -> Result<Option<i32>, UnifiedExecError> {
    loop {
        if let Some(exit_code) = process.try_wait().await? {
            if process.readers_finished() {
                return Ok(Some(exit_code));
            }
        }
        let now = Instant::now();
        if now >= deadline {
            return process.try_wait().await;
        }
        let remaining = deadline.saturating_duration_since(now);
        tokio::select! {
            _ = process.output_notify().notified() => {}
            _ = tokio::time::sleep(remaining.min(Duration::from_millis(25))) => {}
        }
    }
}

async fn wait_for_exit(
    process: &UnifiedExecProcess,
    timeout: Duration,
) -> Result<Option<i32>, UnifiedExecError> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(exit_code) = process.try_wait().await? {
            return Ok(Some(exit_code));
        }
        if Instant::now() >= deadline {
            return Ok(None);
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}
