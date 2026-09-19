//! 对应 `codex-rs/app-server-protocol/src/protocol/v2/model.rs`：`model/list`。
//!
//! 源项目的 `Model` 还携带推理档位、升级提示、输入模态等字段；本项目只保留选择器所需子集。

use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelListParams {
    /// 上一次调用返回的分页游标。
    pub cursor: Option<String>,
    /// 可选页大小；缺省时返回全部。
    pub limit: Option<u32>,
    /// 为 true 时包含默认不在选择器中显示的模型。
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub id: String,
    pub model: String,
    pub display_name: String,
    pub description: String,
    pub hidden: bool,
    pub is_default: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelListResponse {
    pub data: Vec<Model>,
    /// 传给下一次调用以继续读取的游标；为 None 表示没有更多条目。
    pub next_cursor: Option<String>,
}
