mod config_manager_service;
mod message_processor;
mod outgoing_message;
mod request_processors;
mod transport;

use anyhow::Result;
use message_processor::MessageProcessor;
use mini_codex_core::ThreadManager;
use outgoing_message::OutgoingMessage;
use tokio::{
    io::{AsyncBufReadExt, AsyncRead, AsyncWrite, BufReader},
    sync::mpsc,
};

/// 一个连接对应一个协议处理器；EOF 停止接收请求并等待当前回合收尾。
pub async fn run<R, W>(reader: R, writer: W, manager: ThreadManager) -> Result<()>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let (tx, rx) = mpsc::channel(128);
    let mut processor = MessageProcessor::new(manager, OutgoingMessage(tx));
    let incoming = async {
        let mut lines = BufReader::new(reader).lines();
        while let Some(line) = lines.next_line().await? {
            processor.process(&line).await;
        }
        processor.shutdown().await;
        Ok::<(), anyhow::Error>(())
    };
    tokio::try_join!(incoming, transport::write_messages(writer, rx))?;
    Ok(())
}

/// 从 `config.toml` 组装真实模型服务；CLI 子命令与独立二进制共用入口。
pub async fn run_main() -> anyhow::Result<()> {
    use mini_codex_core::config::{Config, ConfigOverrides};
    use mini_codex_core::{ExecCommandTool, OpenAiResponsesClient, ToolRouter};
    use std::sync::Arc;
    // 与 CLI 相同的装配点：模型与 provider 来自 `$MINI_CODEX_HOME/config.toml`，
    // API key 来自 provider 的 `env_key` 环境变量。
    let config = Config::load_with_cli_overrides_and_harness_overrides(
        Vec::new(),
        ConfigOverrides::default(),
    )?;
    let client = Arc::new(OpenAiResponsesClient::from_config(&config)?);
    let manager = ThreadManager::new(
        config,
        client,
        ToolRouter::default().register(ExecCommandTool),
        "你是一个小型编程代理。请在工具指定的工作目录中工作；需要时使用工具，最后用简洁的中文解释结果。".into(),
    );
    run(tokio::io::stdin(), tokio::io::stdout(), manager).await
}
