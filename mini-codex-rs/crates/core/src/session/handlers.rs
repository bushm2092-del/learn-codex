use std::sync::Arc;

use mini_codex_protocol::Event;
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::Op;
use mini_codex_protocol::Submission;
use tokio::sync::mpsc;

use crate::session::Session;
use crate::session::thread_settings;
use crate::session::turn::run_turn;

/// 外层 agent 循环。真实 Codex 会在这里处理更多 `Op` 变体。
pub(crate) async fn submission_loop(
    session: Arc<Session>,
    mut submissions: mpsc::Receiver<Submission>,
) {
    while let Some(submission) = submissions.recv().await {
        let submission_id = submission.id;
        match submission.op {
            Op::UserTurn { text } => {
                if let Err(error) = run_turn(Arc::clone(&session), &submission_id, text).await {
                    session
                        .send_event(Event {
                            submission_id,
                            msg: EventMsg::Error(format!("{error:#}")),
                        })
                        .await;
                }
            }
            Op::ThreadSettings { thread_settings } => {
                thread_settings::update(&session, submission_id, thread_settings).await;
            }
            Op::Shutdown => {
                session
                    .send_event(Event {
                        submission_id,
                        msg: EventMsg::ShutdownComplete,
                    })
                    .await;
                break;
            }
        }
    }
}
