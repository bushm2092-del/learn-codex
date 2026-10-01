use super::*;
use futures::stream;
use pretty_assertions::assert_eq;
fn message(role: &str, text: &str) -> ResponseItem {
    ResponseItem::Message {
        id: None,
        role: role.into(),
        content: vec![ContentItem::InputText { text: text.into() }],
        phase: None,
    }
}
fn compact() -> ResponseItem {
    ResponseItem::Compaction {
        id: Some("cmp-1".into()),
        encrypted_content: "opaque".into(),
    }
}
#[tokio::test]
async fn collect_validates_completion_and_exactly_one_compaction() {
    let result = collect_compaction_output(Box::pin(stream::iter(vec![
        Ok(ResponseEvent::OutputItemDone(compact())),
        Ok(ResponseEvent::Completed {
            response_id: "r".into(),
            token_usage: None,
        }),
    ])))
    .await
    .unwrap();
    assert_eq!(
        (result.response_id, result.compaction_output),
        ("r".into(), compact())
    );
    for count in [0, 2] {
        let mut events = (0..count)
            .map(|_| Ok(ResponseEvent::OutputItemDone(compact())))
            .collect::<Vec<_>>();
        events.push(Ok(ResponseEvent::Completed {
            response_id: "r".into(),
            token_usage: None,
        }));
        let error = collect_compaction_output(Box::pin(stream::iter(events)))
            .await
            .err()
            .unwrap();
        assert!(matches!(
            error.downcast_ref::<CodexErr>(),
            Some(CodexErr::Fatal(_))
        ));
    }
    let error = collect_compaction_output(Box::pin(stream::iter(vec![Ok(
        ResponseEvent::OutputItemDone(compact()),
    )])))
    .await
    .err()
    .unwrap();
    assert!(matches!(
        error.downcast_ref::<CodexErr>(),
        Some(CodexErr::Stream(_))
    ));
}
#[test]
fn installed_history_retains_real_users_and_new_compaction_last() {
    let user = message("user", "task");
    assert_eq!(
        build_v2_compacted_history(
            vec![
                message("user", "<environment_context>env"),
                user.clone(),
                message("assistant", "answer"),
                compact(),
                message("developer", "instructions")
            ],
            compact()
        ),
        vec![user, compact()]
    );
}
#[test]
fn retention_keeps_newest_and_truncates_one_boundary_message() {
    let latest = message("user", "abcd");
    let earlier = message("user", "efgh");
    assert_eq!(
        truncate_retained_messages(vec![earlier, latest.clone()], 1),
        vec![latest]
    );
    assert!(truncate_retained_messages(vec![message("user", "task")], 0).is_empty());
}
