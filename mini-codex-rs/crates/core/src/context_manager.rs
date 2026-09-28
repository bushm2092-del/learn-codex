use mini_codex_protocol::models::ResponseItem;

#[derive(Clone, Debug, Default)]
pub(crate) struct ContextManager {
    items: Vec<ResponseItem>,
}

impl ContextManager {
    pub(crate) fn record(&mut self, item: ResponseItem) {
        self.items.push(item);
    }

    pub(crate) fn for_prompt(&self) -> Vec<ResponseItem> {
        self.items.clone()
    }
}
