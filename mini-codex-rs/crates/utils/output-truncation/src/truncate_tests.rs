use super::*;
use pretty_assertions::assert_eq;

#[test]
fn content_items_share_budget_and_preserve_success() {
    let mut output = FunctionCallOutputPayload {
        body: FunctionCallOutputBody::ContentItems(vec![
            FunctionCallOutputContentItem::InputText {
                text: String::new(),
            },
            FunctionCallOutputContentItem::InputText {
                text: "中文".into(),
            },
            FunctionCallOutputContentItem::InputText {
                text: "abcd".into(),
            },
            FunctionCallOutputContentItem::InputText {
                text: "last".into(),
            },
        ]),
        success: Some(false),
    };
    truncate_function_output_payload(&mut output, TruncationPolicy::Bytes(6));
    assert_eq!(
        output,
        FunctionCallOutputPayload {
            body: FunctionCallOutputBody::ContentItems(vec![
                FunctionCallOutputContentItem::InputText {
                    text: "中文".into()
                },
                FunctionCallOutputContentItem::InputText {
                    text: "[omitted 2 text items ...]".into()
                },
            ]),
            success: Some(false),
        }
    );
}
