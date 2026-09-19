use anyhow::Result;
use serde_json::Value;
use tokio::{
    io::{AsyncWrite, AsyncWriteExt},
    sync::mpsc,
};

// stdout 仅承载 JSONL；有界队列将慢客户端的背压传回生产者。
pub(crate) async fn write_messages<W: AsyncWrite + Unpin>(
    mut writer: W,
    mut messages: mpsc::Receiver<Value>,
) -> Result<()> {
    while let Some(message) = messages.recv().await {
        let mut bytes = serde_json::to_vec(&message)?;
        bytes.push(b'\n');
        writer.write_all(&bytes).await?;
        writer.flush().await?;
    }
    Ok(())
}
