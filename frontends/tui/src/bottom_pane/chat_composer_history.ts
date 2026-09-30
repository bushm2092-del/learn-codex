// 移植 chat_composer_history.rs 的本地纯文本分支；不伪造跨进程持久化历史。
export class ChatComposerHistory {
  entries: string[] = [];
  private cursor: number | undefined;
  private lastText: string | undefined;
  record(text: string) {
    if (!text) return;
    this.reset();
    if (this.entries.at(-1) !== text) this.entries.push(text);
  }
  reset() { this.cursor = undefined; this.lastText = undefined; }
  shouldNavigate(text: string, atBoundary: boolean) {
    return this.entries.length > 0 && (!text || (atBoundary && text === this.lastText));
  }
  navigate(delta: -1 | 1): string | undefined {
    if (!this.entries.length) return;
    if (delta === -1) {
      if (this.cursor === 0) return;
      this.cursor = this.cursor === undefined ? this.entries.length - 1 : this.cursor - 1;
    } else {
      if (this.cursor === undefined) return;
      if (this.cursor + 1 >= this.entries.length) { this.reset(); return ''; }
      this.cursor++;
    }
    this.lastText = this.entries[this.cursor];
    return this.lastText;
  }
  matches(query: string) {
    return [...new Set([...this.entries].reverse())].filter(text => text.includes(query));
  }
}
