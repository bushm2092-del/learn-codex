use std::sync::Arc;
use std::sync::atomic::AtomicU64;
use std::sync::atomic::Ordering;

use anyhow::Context;
use anyhow::Result;
use mini_codex_protocol::Event;
use mini_codex_protocol::Op;
use mini_codex_protocol::Submission;
use mini_codex_protocol::ThreadSettingsOverrides;
use tokio::sync::Mutex;
use tokio::sync::mpsc;

static NEXT_SUBMISSION_ID: AtomicU64 = AtomicU64::new(1);

/// 双向前端边界，对应真实仓库中 `CodexThread` 的职责。
pub struct CodexThread {
    submissions: mpsc::Sender<Submission>,
    events: Mutex<mpsc::Receiver<Event>>,
}

impl CodexThread {
    pub(crate) fn new(
        submissions: mpsc::Sender<Submission>,
        events: mpsc::Receiver<Event>,
    ) -> Arc<Self> {
        Arc::new(Self {
            submissions,
            events: Mutex::new(events),
        })
    }

    pub async fn start_turn(&self, text: String) -> Result<String> {
        self.submit(Op::UserTurn { text }).await
    }

    /// 提交会话设置更新；结果通过 `EventMsg::ThreadSettingsApplied` 返回。
    pub async fn update_thread_settings(
        &self,
        thread_settings: ThreadSettingsOverrides,
    ) -> Result<String> {
        self.submit(Op::ThreadSettings { thread_settings }).await
    }

    pub async fn shutdown(&self) -> Result<()> {
        self.submit(Op::Shutdown).await?;
        Ok(())
    }

    pub async fn next_event(&self) -> Option<Event> {
        self.events.lock().await.recv().await
    }

    async fn submit(&self, op: Op) -> Result<String> {
        let id = NEXT_SUBMISSION_ID
            .fetch_add(1, Ordering::Relaxed)
            .to_string();
        self.submissions
            .send(Submission { id: id.clone(), op })
            .await
            .context("session 循环已经停止")?;
        Ok(id)
    }
}
