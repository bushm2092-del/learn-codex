// 按行匹配保留的 JSON；新增或替换的行高亮，数组追加不会误标整个对象。
export function ChangedJson({ value, previous, unset }: { value: unknown; previous: unknown; unset: string }) {
  const current = (JSON.stringify(value, null, 2) ?? unset).split("\n");
  const old = (JSON.stringify(previous, null, 2) ?? unset).split("\n");
  const lengths = Array.from({ length: old.length + 1 }, () => new Uint32Array(current.length + 1));
  for (let i = old.length - 1; i >= 0; i--) {
    for (let j = current.length - 1; j >= 0; j--) {
      lengths[i]![j] = old[i] === current[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }
  const unchanged = new Set<number>();
  let i = 0, j = 0;
  while (i < old.length && j < current.length) {
    if (old[i] === current[j]) { unchanged.add(j); i++; j++; }
    else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) i++;
    else j++;
  }
  return <pre>{current.map((line, index) => <span key={index} style={!unchanged.has(index) ? { background: "var(--change-bg)", color: "var(--change-ink)" } : undefined}>{line}{index < current.length - 1 ? "\n" : ""}</span>)}</pre>;
}
