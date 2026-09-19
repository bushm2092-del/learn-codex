//! 对应 `codex-rs/models-manager`：模型目录的加载与选择器列表。
//!
//! 源项目会在线拉取 OpenAI 模型目录并落盘缓存；本项目只使用随 crate 打包的
//! `models.json`（DeepSeek 模型），对应源项目静态目录 `StaticModelsManager` 的分支。

pub mod manager;

pub use manager::ModelsManager;

/// 加载随 `mini-codex-models-manager` 一起打包的模型目录。
pub fn bundled_models_response()
-> std::result::Result<mini_codex_protocol::openai_models::ModelsResponse, serde_json::Error> {
    serde_json::from_str(include_str!("../models.json"))
}
