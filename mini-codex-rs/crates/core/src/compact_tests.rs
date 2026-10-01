use super::*;
use pretty_assertions::assert_eq;
#[test]
fn compacted_history_keeps_recent_user_messages_and_summary_last() {
    let messages = vec![
        CompactedUserMessage {
            id: Some("old".into()),
            message: "12345678".into(),
        },
        CompactedUserMessage {
            id: Some("new".into()),
            message: "abcd".into(),
        },
    ];
    let history = build_compacted_history_with_limit(Vec::new(), &messages, "summary", 1);
    assert_eq!(
        history,
        vec![
            ResponseItem::Message {
                id: Some("new".into()),
                role: "user".into(),
                content: vec![ContentItem::InputText {
                    text: "abcd".into()
                }],
                phase: None
            },
            ResponseItem::Message {
                id: None,
                role: "user".into(),
                content: vec![ContentItem::InputText {
                    text: "summary".into()
                }],
                phase: None
            }
        ]
    );
}
#[test]
fn reinjection_precedes_latest_real_user_and_does_not_collect_old_summaries() {
    let history = build_compacted_history(
        Vec::new(),
        &[CompactedUserMessage {
            id: None,
            message: "task".into(),
        }],
        &format!("{SUMMARY_PREFIX}\nsummary"),
    );
    let environment = ResponseItem::Message {
        id: None,
        role: "user".into(),
        content: vec![ContentItem::InputText {
            text: "<environment_context>env</environment_context>".into(),
        }],
        phase: None,
    };
    let result = insert_initial_context_before_last_real_user_or_summary(
        history.clone(),
        vec![environment.clone()],
    );
    assert_eq!(
        result,
        vec![environment, history[0].clone(), history[1].clone()]
    );
    let messages = collect_annotated_user_messages(&result);
    assert_eq!(
        messages
            .iter()
            .map(|message| message.message.as_str())
            .collect::<Vec<_>>(),
        vec!["task"]
    );
}
