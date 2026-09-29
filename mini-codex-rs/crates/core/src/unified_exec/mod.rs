//! Unified Exec：可恢复命令进程及其输出缓冲。
//!
//! 源项目还在这一层编排 sandbox、approval、network proxy、hook、telemetry、远程
//! executor 和 turn cancellation。mini-codex 尚无这些上游服务，因此删除这些分支，
//! 保留进程创建、先等待后让出、会话存储、续写 stdin、轮询、OneShot 超时终止和
//! 输出限制的原始职责顺序。

use std::cmp::Reverse;
use std::collections::HashMap;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

use rand::Rng;
use tokio::sync::Mutex;

use crate::shell::ShellType;

mod errors;
mod head_tail_buffer;
mod oneshot;
mod process;
mod process_manager;

pub(crate) use errors::UnifiedExecError;
use process::UnifiedExecProcess;

pub(crate) const MIN_YIELD_TIME_MS: u64 = 250;
pub(crate) const WINDOWS_INITIAL_EXEC_YIELD_TIME_FLOOR_MS: u64 = 10_000;
pub(crate) const MIN_EMPTY_YIELD_TIME_MS: u64 = 5_000;
pub(crate) const MAX_YIELD_TIME_MS: u64 = 30_000;
pub(crate) const DEFAULT_MAX_BACKGROUND_TERMINAL_TIMEOUT_MS: u64 = 300_000;
pub(crate) const DEFAULT_MAX_OUTPUT_TOKENS: usize = 10_000;
pub(crate) const UNIFIED_EXEC_OUTPUT_MAX_BYTES: usize = 1024 * 1024;
pub(crate) const MAX_UNIFIED_EXEC_PROCESSES: usize = 64;

#[derive(Debug)]
pub(crate) struct ExecCommandRequest {
    pub(crate) command: Vec<String>,
    pub(crate) shell_type: ShellType,
    pub(crate) process_id: i32,
    pub(crate) yield_time_ms: u64,
    pub(crate) max_output_tokens: Option<usize>,
    pub(crate) cwd: PathBuf,
    pub(crate) tty: bool,
}

#[derive(Debug)]
pub(crate) struct WriteStdinRequest<'a> {
    pub(crate) process_id: i32,
    pub(crate) input: &'a str,
    pub(crate) yield_time_ms: u64,
    pub(crate) max_output_tokens: Option<usize>,
}

#[derive(Default)]
struct ProcessStore {
    processes: HashMap<i32, ProcessEntry>,
    reserved_process_ids: HashSet<i32>,
}

struct ProcessEntry {
    process: Arc<UnifiedExecProcess>,
    last_used: tokio::time::Instant,
}

pub(crate) struct UnifiedExecProcessManager {
    process_store: Mutex<ProcessStore>,
    max_write_stdin_yield_time_ms: u64,
}

impl UnifiedExecProcessManager {
    pub(crate) fn new(max_write_stdin_yield_time_ms: u64) -> Self {
        Self {
            process_store: Mutex::new(ProcessStore::default()),
            max_write_stdin_yield_time_ms: max_write_stdin_yield_time_ms
                .max(MIN_EMPTY_YIELD_TIME_MS),
        }
    }

    pub(crate) async fn allocate_process_id(&self) -> i32 {
        loop {
            let mut store = self.process_store.lock().await;
            let process_id = rand::rng().random_range(1_000..100_000);
            if store.reserved_process_ids.insert(process_id) {
                return process_id;
            }
        }
    }

    async fn release_process_id(&self, process_id: i32) -> Option<ProcessEntry> {
        let mut store = self.process_store.lock().await;
        store.remove(process_id)
    }

    fn prune_processes_if_needed(store: &mut ProcessStore) -> Option<ProcessEntry> {
        if store.processes.len() < MAX_UNIFIED_EXEC_PROCESSES {
            return None;
        }

        let mut meta: Vec<(i32, tokio::time::Instant, bool)> = store
            .processes
            .iter()
            .map(|(id, entry)| (*id, entry.last_used, entry.process.has_exited()))
            .collect();
        let process_id = Self::process_id_to_prune_from_meta(&mut meta)?;
        store.remove(process_id)
    }

    fn process_id_to_prune_from_meta(
        meta: &mut [(i32, tokio::time::Instant, bool)],
    ) -> Option<i32> {
        if meta.is_empty() {
            return None;
        }

        meta.sort_by_key(|(_, last_used, _)| Reverse(*last_used));
        let protected: HashSet<i32> = meta
            .iter()
            .take(8)
            .map(|(process_id, _, _)| *process_id)
            .collect();
        meta.sort_by_key(|(_, last_used, _)| *last_used);
        meta.iter()
            .find(|(process_id, _, exited)| !protected.contains(process_id) && *exited)
            .or_else(|| {
                meta.iter()
                    .find(|(process_id, _, _)| !protected.contains(process_id))
            })
            .map(|(process_id, _, _)| *process_id)
    }
}

impl ProcessStore {
    fn remove(&mut self, process_id: i32) -> Option<ProcessEntry> {
        self.reserved_process_ids.remove(&process_id);
        self.processes.remove(&process_id)
    }
}

impl Default for UnifiedExecProcessManager {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_BACKGROUND_TERMINAL_TIMEOUT_MS)
    }
}

pub(crate) fn clamp_yield_time(yield_time_ms: u64) -> u64 {
    let yield_time_ms = if cfg!(windows) {
        yield_time_ms.max(WINDOWS_INITIAL_EXEC_YIELD_TIME_FLOOR_MS)
    } else {
        yield_time_ms
    };
    yield_time_ms.clamp(MIN_YIELD_TIME_MS, MAX_YIELD_TIME_MS)
}

pub(crate) fn format_output_omission_marker(omitted_bytes: usize) -> String {
    format!("... {omitted_bytes} bytes omitted ...")
}

pub(crate) fn generate_chunk_id() -> String {
    let mut rng = rand::rng();
    (0..6)
        .map(|_| format!("{:x}", rng.random_range(0..16)))
        .collect()
}

#[cfg(test)]
#[cfg(unix)]
#[path = "mod_tests.rs"]
mod tests;
