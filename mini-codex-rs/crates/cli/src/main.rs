use std::env;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use mini_codex_core::ExecCommandTool;
use mini_codex_core::OpenAiResponsesClient;
use mini_codex_core::ThreadManager;
use mini_codex_core::ToolRouter;
use mini_codex_core::config::Config;
use mini_codex_core::config::ConfigOverrides;
use mini_codex_protocol::EventMsg;
use tokio::io::AsyncBufReadExt;

fn main() -> Result<()> {
    // 对应源项目 arg0_dispatch_or_else：先加载 `$MINI_CODEX_HOME/.env`，再创建运行时。
    mini_codex_arg0::load_dotenv();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(async_main())
}

async fn async_main() -> Result<()> {
    if env::args().nth(1).as_deref() == Some("app-server") {
        return mini_codex_app_server::run_main().await;
    }
    // 模型、provider 与 API key 全部来自 `$MINI_CODEX_HOME/config.toml` 和 provider 指定的
    // 环境变量；CLI 本身不再持有任何密钥或服务地址。
    let config = Config::load_with_cli_overrides_and_harness_overrides(
        Vec::new(),
        ConfigOverrides {
            cwd: Some(env::current_dir()?),
            ..Default::default()
        },
    )?;
    let client = Arc::new(OpenAiResponsesClient::from_config(&config)?);
    let cwd = config.cwd.clone();
    let tools = ToolRouter::default().register(ExecCommandTool);
    let manager = ThreadManager::new(
        config,
        client,
        tools,
        format!(
            "你是一个小型编程代理。请在 {} 目录中工作；需要时使用工具，最后用简洁的中文解释结果。",
            cwd.display()
        ),
    );
    let thread = manager.start_thread(PathBuf::from(&cwd));
    let mut lines: tokio::io::Lines<tokio::io::BufReader<tokio::io::Stdin>> =
        tokio::io::BufReader::new(tokio::io::stdin()).lines();

    println!("mini-codex：输入请求，或输入 /exit 退出");
    loop {
        print!("> ");
        std::io::stdout().flush()?;
        let Some(line) = lines.next_line().await? else {
            break;
        };
        if line.trim() == "/exit" {
            break;
        }
        if line.trim().is_empty() {
            continue;
        }

        let turn_id = thread.start_turn(line).await?;
        while let Some(event) = thread.next_event().await {
            if event.submission_id != turn_id {
                continue;
            }
            match event.msg {
                EventMsg::AgentMessageDelta(delta) => {
                    print!("{delta}");
                    std::io::stdout().flush()?;
                }
                EventMsg::ToolCallStarted { name, .. } => {
                    println!("\n[工具] {name}")
                }
                EventMsg::ToolCallCompleted {
                    output, success, ..
                } => {
                    let status = if success { "成功" } else { "失败" };
                    println!("[工具 {status}]\n{output}");
                }
                EventMsg::TurnCompleted { .. } => {
                    println!();
                    break;
                }
                EventMsg::Error(error) => {
                    eprintln!("错误: {error}");
                    break;
                }
                EventMsg::TurnStarted
                | EventMsg::AgentMessage(_)
                | EventMsg::ThreadSettingsApplied(_)
                | EventMsg::ShutdownComplete => {}
            }
        }
    }

    thread.shutdown().await?;
    Ok(())
}
