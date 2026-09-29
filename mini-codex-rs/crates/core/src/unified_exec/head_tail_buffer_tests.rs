use pretty_assertions::assert_eq;

use super::HeadTailBuffer;

#[test]
fn preserves_head_and_tail_when_capacity_is_exceeded() {
    let mut buffer = HeadTailBuffer::<8>::default();
    buffer.push_chunk(b"abcdefghijkl");
    assert_eq!(buffer.retained_bytes(), 8);
    assert_eq!(buffer.omitted_bytes(), 4);
    assert_eq!(
        String::from_utf8(buffer.to_bytes_with_omission_marker()).unwrap(),
        "abcd\n... 4 bytes omitted ...\nijkl"
    );
}
