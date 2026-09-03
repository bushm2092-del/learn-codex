use serde_json::Value;

#[derive(Clone, Debug, Default)]
pub(crate) struct ContextManager {
    items: Vec<Value>,
}

impl ContextManager {
    pub(crate) fn record(&mut self, item: Value) {
        self.items.push(item);
    }

    pub(crate) fn for_prompt(&self) -> Vec<Value> {
        self.items.clone()
    }
}
