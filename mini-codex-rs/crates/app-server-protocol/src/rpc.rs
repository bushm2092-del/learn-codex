use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum RequestId {
    String(String),
    Integer(i64),
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JSONRPCRequest {
    pub id: RequestId,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}
