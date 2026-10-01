// 与后台题目生成的四种规则一致，供即时反馈使用；最终成绩以后台为准。
export function nextSequenceNumber(numbers: number[]): number {
  const [a, b, c, d] = numbers;
  if (b - a === c - b && c - b === d - c) return d + (b - a);
  if (b === a * 2 && c === b * 2 && d === c * 2) return d * 2;
  if (c === a + b && d === b + c) return c + d;
  return d + (d - c) + 1;
}
export function reactionAverage(samples: number[]): number {
  return Math.round(samples.reduce((total, sample) => total + sample, 0) / samples.length);
}
export function timedScore(correct: number, wrong: number): number { return Math.max(0, correct - wrong); }
