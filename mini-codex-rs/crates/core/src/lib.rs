//! 一个刻意保持精简、便于阅读的 Codex agent harness。

mod client;
mod client_common;
mod codex_thread;
mod compact;
mod compact_remote_history;
mod compact_remote_v2;
pub mod config;
mod context;
mod context_manager;
mod function_tool;
mod responses_retry;
mod session;
mod shell;
mod thread_manager;
pub mod tools;
mod unified_exec;

pub use client::OpenAiResponsesClient;
pub use client_common::ModelClient;
pub use client_common::Prompt;
pub use client_common::ResponseEvent;
pub use client_common::ResponseStream;
pub use codex_thread::CodexThread;
pub use thread_manager::ThreadManager;

mod compact_token_budget;
mod state;
