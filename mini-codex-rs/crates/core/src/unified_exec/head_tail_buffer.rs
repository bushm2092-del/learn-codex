use std::collections::VecDeque;

use crate::unified_exec::UNIFIED_EXEC_OUTPUT_MAX_BYTES;
use crate::unified_exec::format_output_omission_marker;

/// 有界输出缓冲：稳定保留前半段和最后半段，超限时只丢弃中间内容。
#[derive(Debug)]
pub(crate) struct HeadTailBuffer<const MAX_BYTES: usize = UNIFIED_EXEC_OUTPUT_MAX_BYTES> {
    head: Vec<u8>,
    tail: VecDeque<u8>,
    omitted_bytes: usize,
}

impl<const MAX_BYTES: usize> Default for HeadTailBuffer<MAX_BYTES> {
    fn default() -> Self {
        Self {
            head: Vec::new(),
            tail: VecDeque::new(),
            omitted_bytes: 0,
        }
    }
}

impl<const MAX_BYTES: usize> HeadTailBuffer<MAX_BYTES> {
    const HEAD_BUDGET: usize = MAX_BYTES / 2;
    const TAIL_BUDGET: usize = MAX_BYTES.saturating_sub(Self::HEAD_BUDGET);

    pub(crate) fn retained_bytes(&self) -> usize {
        self.head.len().saturating_add(self.tail.len())
    }

    pub(crate) fn omitted_bytes(&self) -> usize {
        self.omitted_bytes
    }

    pub(crate) fn total_bytes(&self) -> usize {
        self.retained_bytes().saturating_add(self.omitted_bytes)
    }

    pub(crate) fn push_chunk(&mut self, chunk: &[u8]) {
        let remaining_head = Self::HEAD_BUDGET.saturating_sub(self.head.len());
        let split = remaining_head.min(chunk.len());
        self.head.extend_from_slice(&chunk[..split]);
        self.push_tail(&chunk[split..]);
    }

    fn push_tail(&mut self, chunk: &[u8]) {
        let remaining_tail = Self::TAIL_BUDGET.saturating_sub(self.tail.len());
        let excess_tail = chunk.len().saturating_sub(remaining_tail);
        self.omitted_bytes = self.omitted_bytes.saturating_add(excess_tail);
        let chunk = match excess_tail.checked_sub(self.tail.len()) {
            None => {
                self.tail.drain(..excess_tail);
                chunk
            }
            Some(skip) => {
                self.tail.clear();
                &chunk[skip..]
            }
        };
        self.tail.extend(chunk);
    }

    pub(crate) fn to_bytes_with_omission_marker(&self) -> Vec<u8> {
        let marker =
            (self.omitted_bytes > 0).then(|| format_output_omission_marker(self.omitted_bytes));
        let extra = marker.as_ref().map_or(0, |marker| marker.len() + 2);
        let mut output = Vec::with_capacity(self.retained_bytes().saturating_add(extra));
        output.extend_from_slice(&self.head);
        if let Some(marker) = marker {
            output.push(b'\n');
            output.extend_from_slice(marker.as_bytes());
            output.push(b'\n');
        }
        output.extend(self.tail.iter().copied());
        output
    }
}

#[cfg(test)]
#[path = "head_tail_buffer_tests.rs"]
mod tests;
