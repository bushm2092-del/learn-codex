use crate::compact::InitialContextInjection;
use crate::session::Session;
use anyhow::Result;
use std::sync::Arc;

// 对照源实现：不生成摘要，直接安装新窗口。hooks、TurnItem 与 rollout 尚未移植。
pub(crate) async fn run_inline_auto_compact_task(
    sess: Arc<Session>,
    _injection: InitialContextInjection,
) -> Result<()> {
    sess.start_new_context_window().await;
    Ok(())
}
