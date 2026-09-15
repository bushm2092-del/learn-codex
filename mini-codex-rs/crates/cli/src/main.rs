use std::env;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use anyhow::Result;
use mini_codex_core::ExecCommandTool;
use mini_codex_core::OpenAiResponsesClient;
use mini_codex_core::PromptCatalog;
use mini_codex_core::ThreadManager;
use mini_codex_core::ToolRouter;
use mini_codex_protocol::EventMsg;
use tokio::io::AsyncBufReadExt;

#[tokio::main]
async fn main() -> Result<()> {
    let api_key = env::var("DEEPSEEK_API_KEY")
        .or_else(|_| env::var("OPENAI_API_KEY"))
        .context("必须设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY")?;
    let model = env::var("MINI_CODEX_MODEL").unwrap_or_else(|_| "deepseek-v4-flash".to_string());
    let base_url =
        env::var("MINI_CODEX_BASE_URL").unwrap_or_else(|_| "https://api.deepseek.com".to_string());
    let catalog = PromptCatalog::new();
    let cwd = env::current_dir()?;
    let client = Arc::new(OpenAiResponsesClient::with_base_url(
        api_key, model, base_url,
    ));
    let tools = ToolRouter::default().register(ExecCommandTool);
    let manager = ThreadManager::new(
        client,
        tools,
        catalog.system_prompt(&cwd.display().to_string()),
    );
    let thread = manager.start_thread(PathBuf::from(&cwd));
    let mut lines = tokio::io::BufReader::new(tokio::io::stdin()).lines();

    println!("{}", catalog.welcome());
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
                    println!("{}", catalog.tool_started(&name))
                }
                EventMsg::ToolCallCompleted {
                    output, success, ..
                } => println!("{}", catalog.tool_completed(success, &output)),
                EventMsg::TurnCompleted { .. } => {
                    println!();
                    break;
                }
                EventMsg::Error(error) => {
                    eprintln!("{}: {error}", catalog.error_prefix());
                    break;
                }
                EventMsg::TurnStarted | EventMsg::AgentMessage(_) | EventMsg::ShutdownComplete => {}
            }
        }
    }

    thread.shutdown().await?;
    Ok(())
}
