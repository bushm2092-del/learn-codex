//! 对应 `codex-rs/app-server/tests/common/`：集成测试共享的假模型与服务装配。

use anyhow::Result;
use mini_codex_config::ConfigToml;
use mini_codex_core::config::{Config, ConfigOverrides};
use mini_codex_core::{ModelClient, Prompt, ResponseEvent, ResponseStream, ThreadManager};
use serde_json::{Value, json};
use std::{
    future::Future,
    path::Path,
    pin::Pin,
    sync::{Arc, Mutex},
};
use tempfile::TempDir;
use tokio::io::{
    AsyncBufReadExt, AsyncWriteExt, BufReader, DuplexStream, Lines, ReadHalf, WriteHalf,
};

/// 记录每次请求的 prompt 与模型名，并按调用次序返回脚本化响应。
pub struct ScriptedModelClient {
    pub prompts: Mutex<Vec<Prompt>>,
    pub models: Mutex<Vec<String>>,
    script: fn(usize) -> Result<Vec<ResponseEvent>>,
}

impl ScriptedModelClient {
    pub fn new(script: fn(usize) -> Result<Vec<ResponseEvent>>) -> Arc<Self> {
        Arc::new(Self {
            prompts: Mutex::new(Vec::new()),
            models: Mutex::new(Vec::new()),
            script,
        })
    }

    /// 每次都回复一句固定文本的最简脚本。
    pub fn echo() -> Arc<Self> {
        Self::new(|_| Ok(text_reply("你好")))
    }
}

pub fn text_reply(text: &str) -> Vec<ResponseEvent> {
    vec![
        ResponseEvent::OutputTextDelta(text.into()),
        ResponseEvent::OutputItemDone(
            serde_json::from_value(json!({"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]})).unwrap(),
        ),
        ResponseEvent::Completed,
    ]
}

impl ModelClient for ScriptedModelClient {
    fn stream(
        &self,
        prompt: Prompt,
        model: String,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>> {
        Box::pin(async move {
            let index = {
                let mut prompts = self.prompts.lock().unwrap();
                prompts.push(prompt);
                self.models.lock().unwrap().push(model);
                prompts.len()
            };
            tokio::time::sleep(std::time::Duration::from_millis(30)).await;
            let events = (self.script)(index)?;
            Ok(Box::pin(futures::stream::iter(events.into_iter().map(Ok))) as ResponseStream)
        })
    }
}

/// 用临时 codex_home 与给定 `config.toml` 内容构造 `Config`。
pub fn test_config(codex_home: &Path, config_toml: &str) -> Result<Config> {
    let cfg: ConfigToml = toml::from_str(config_toml)?;
    Ok(Config::load_from_base_config_with_overrides(
        cfg,
        ConfigOverrides {
            cwd: Some(codex_home.to_path_buf()),
            ..Default::default()
        },
        codex_home.to_path_buf(),
    )?)
}

/// 已完成 initialize 握手的 app-server 连接。
pub struct TestServer {
    pub codex_home: TempDir,
    pub writer: WriteHalf<DuplexStream>,
    pub lines: Lines<BufReader<ReadHalf<DuplexStream>>>,
    pub server: tokio::task::JoinHandle<Result<()>>,
}

impl TestServer {
    pub async fn start(model: Arc<ScriptedModelClient>, config_toml: &str) -> Result<Self> {
        let codex_home = TempDir::new()?;
        if !config_toml.is_empty() {
            std::fs::write(codex_home.path().join("config.toml"), config_toml)?;
        }
        let config = test_config(codex_home.path(), config_toml)?;
        let manager = ThreadManager::new(config, model, "test".into());
        let (client, server) = tokio::io::duplex(65536);
        let (reader, writer) = tokio::io::split(server);
        let server = tokio::spawn(mini_codex_app_server::run(reader, writer, manager));
        let (reader, writer) = tokio::io::split(client);
        let lines = BufReader::new(reader).lines();
        let mut this = Self {
            codex_home,
            writer,
            lines,
            server,
        };
        this.send(json!({"id": "init", "method": "initialize", "params": {"clientInfo": {"name": "test", "version": "1"}}}))
            .await?;
        let init = this.recv().await?;
        assert_eq!(init["id"], "init");
        this.send(json!({"method": "initialized"})).await?;
        Ok(this)
    }

    pub async fn send(&mut self, value: Value) -> Result<()> {
        self.writer
            .write_all(format!("{value}\n").as_bytes())
            .await?;
        Ok(())
    }

    /// 写入原始字节，用于验证非法 JSON 的处理。
    pub async fn writer_raw(&mut self, bytes: &[u8]) -> Result<()> {
        self.writer.write_all(bytes).await?;
        Ok(())
    }

    pub async fn recv(&mut self) -> Result<Value> {
        Ok(serde_json::from_str(
            &self.lines.next_line().await?.expect("message"),
        )?)
    }

    /// 发送请求并等待对应 id 的响应，途中收到的通知按顺序收集返回。
    pub async fn request(
        &mut self,
        id: i64,
        method: &str,
        params: Value,
    ) -> Result<(Value, Vec<Value>)> {
        self.send(json!({"id": id, "method": method, "params": params}))
            .await?;
        let mut notifications = Vec::new();
        loop {
            let message = self.recv().await?;
            if message["id"] == id {
                return Ok((message, notifications));
            }
            notifications.push(message);
        }
    }

    /// `thread/start` 并消费掉随后的 `thread/started` 通知，返回 thread id。
    pub async fn start_thread(&mut self, id: i64) -> Result<String> {
        let (response, _) = self.request(id, "thread/start", json!({})).await?;
        let thread_id = response["result"]["thread"]["id"]
            .as_str()
            .expect("thread id")
            .to_string();
        let started = self.recv().await?;
        assert_eq!(started["method"], "thread/started");
        Ok(thread_id)
    }

    pub async fn shutdown(mut self) -> Result<()> {
        self.writer.shutdown().await?;
        assert!(self.lines.next_line().await?.is_none());
        self.server.await??;
        Ok(())
    }
}
