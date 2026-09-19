//! 对应 `codex-rs/core/src/session/thread_settings.rs`：处理 `Op::ThreadSettings`。
//!
//! 源项目会校验管理员约束、写入 rollout 并发出 `ThreadSettingsApplied`；
//! 本项目只更新会话设置并发出同名事件，约束与持久化是尚未支持的分支。

use std::sync::Arc;

use mini_codex_protocol::Event;
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::ThreadSettingsOverrides;
use mini_codex_protocol::ThreadSettingsSnapshot;

use super::session::Session;

pub(super) async fn update(
    session: &Arc<Session>,
    submission_id: String,
    overrides: ThreadSettingsOverrides,
) {
    let ThreadSettingsOverrides { model } = overrides;
    let snapshot = {
        let mut settings = session.settings.lock().await;
        if let Some(model) = model {
            settings.model = model;
        }
        ThreadSettingsSnapshot {
            model: settings.model.clone(),
        }
    };
    session
        .send_event(Event {
            submission_id,
            msg: EventMsg::ThreadSettingsApplied(snapshot),
        })
        .await;
}
