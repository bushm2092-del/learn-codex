use anyhow::Result;
use mini_codex_protocol::error::CodexErr;
#[derive(Default)]
pub(crate) struct ResponsesStreamRetryState {
    retries: u64,
}

// 保留上游有界 HTTPS Stream 重试；Fatal 和尚未分类的错误直接返回。
pub(crate) async fn handle_response_stream_error(
    state: &mut ResponsesStreamRetryState,
    max_retries: u64,
    err: anyhow::Error,
) -> Result<()> {
    let retry_count = state.retries.saturating_add(1);
    let Some(CodexErr::Stream(_)) = err.downcast_ref::<CodexErr>() else {
        return Err(err);
    };
    let delay = mini_codex_async_utils::backoff(retry_count);
    if state.retries < max_retries {
        state.retries = retry_count;
        tokio::time::sleep(delay).await;
        return Ok(());
    }
    Err(err)
}
