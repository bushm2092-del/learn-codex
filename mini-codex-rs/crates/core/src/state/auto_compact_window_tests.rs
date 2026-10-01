use super::*;
use pretty_assertions::assert_eq;

#[test]
fn advancing_preserves_lineage_and_resets_once_per_window_claims() {
    let first = AutoCompactWindowIds::new_initial();
    let mut window = AutoCompactWindow::new_with_ids(first);
    assert!(window.claim_token_budget_reminder());
    assert!(!window.claim_token_budget_reminder());
    assert!(window.claim_auto_compact_fallback());
    assert!(!window.claim_auto_compact_fallback());
    let (number, second) = window.advance();
    assert_eq!(number, 1);
    assert_eq!(second.first_window_id, first.first_window_id);
    assert_eq!(second.previous_window_id, Some(first.window_id));
    assert_ne!(second.window_id, first.window_id);
    assert!(window.claim_token_budget_reminder());
    assert!(window.claim_auto_compact_fallback());
    let (number, third) = window.advance();
    assert_eq!(number, 2);
    assert_eq!(third.first_window_id, first.first_window_id);
    assert_eq!(third.previous_window_id, Some(second.window_id));
}
