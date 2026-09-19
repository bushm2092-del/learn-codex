use serde_json::{Value, json};
use tokio::sync::mpsc;

#[derive(Clone)]
pub(crate) struct OutgoingMessage(pub mpsc::Sender<Value>);
impl OutgoingMessage {
    pub async fn response(&self, id: Value, result: Value) {
        let _ = self.0.send(json!({"id": id, "result": result})).await;
    }
    pub async fn error(&self, id: Value, code: i64, message: &str) {
        let _ = self
            .0
            .send(json!({"id": id, "error": {"code": code, "message": message}}))
            .await;
    }
    pub async fn notification(&self, method: &str, params: Value) {
        let _ = self
            .0
            .send(json!({"method": method, "params": params}))
            .await;
    }
}
