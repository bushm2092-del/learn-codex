use uuid::Uuid;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AutoCompactWindowIds {
    pub(crate) first_window_id: Uuid,
    pub(crate) previous_window_id: Option<Uuid>,
    pub(crate) window_id: Uuid,
}

impl AutoCompactWindowIds {
    pub(crate) fn new_initial() -> Self {
        let window_id = Uuid::now_v7();
        Self {
            first_window_id: window_id,
            previous_window_id: None,
            window_id,
        }
    }
}

#[derive(Debug)]
pub(crate) struct AutoCompactWindow {
    window_number: u64,
    ids: AutoCompactWindowIds,
    token_budget_reminder_delivered: bool,
    auto_compact_fallback_delivered: bool,
}
impl AutoCompactWindow {
    pub(crate) fn new_with_ids(ids: AutoCompactWindowIds) -> Self {
        Self {
            window_number: 0,
            ids,
            token_budget_reminder_delivered: false,
            auto_compact_fallback_delivered: false,
        }
    }
    pub(crate) fn advance(&mut self) -> (u64, AutoCompactWindowIds) {
        self.window_number = self.window_number.saturating_add(1);
        self.ids.previous_window_id = Some(self.ids.window_id);
        self.ids.window_id = Uuid::now_v7();
        self.token_budget_reminder_delivered = false;
        self.auto_compact_fallback_delivered = false;
        (self.window_number, self.ids)
    }
    pub(crate) fn claim_token_budget_reminder(&mut self) -> bool {
        !std::mem::replace(&mut self.token_budget_reminder_delivered, true)
    }
    pub(crate) fn claim_auto_compact_fallback(&mut self) -> bool {
        !std::mem::replace(&mut self.auto_compact_fallback_delivered, true)
    }
}

#[cfg(test)]
#[path = "auto_compact_window_tests.rs"]
mod tests;
