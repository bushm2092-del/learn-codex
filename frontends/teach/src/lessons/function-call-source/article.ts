export type ArticleBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; language: string; code: string }
  | { kind: "table"; header: string[]; rows: string[][] };

// 页面标题已经在课头展示，正文从第一个二级标题开始。
export function articleBody(markdown: string) {
  const start = markdown.search(/^## /m);
  return start < 0 ? markdown : markdown.slice(start);
}

export function parseArticle(markdown: string): ArticleBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ArticleBlock[] = [];
  const paragraph: string[] = [];
  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph.length = 0;
    if (text) blocks.push({ kind: "paragraph", text });
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      flushParagraph();
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: "code", language, code: code.join("\n") });
      index += 1;
      continue;
    }
    if (line.startsWith("|")) {
      flushParagraph();
      const rows: string[][] = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      const [header, separator, ...body] = rows;
      if (header && separator?.every(cell => /^:?-{3,}:?$/.test(cell))) blocks.push({ kind: "table", header, rows: body });
      continue;
    }
    const heading = /^(#{2,6}) (.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2).trim());
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }
    paragraph.push(line.trim());
    index += 1;
  }
  flushParagraph();
  return blocks;
}

function splitRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

// 只把快照里真实存在的 crates 路径变成可打开的源码入口。
export function sourceTarget(code: string, paths: ReadonlySet<string> | undefined) {
  if (!paths || !code.startsWith("crates/")) return;
  if (paths.has(code)) return code;
  if (!code.endsWith("/")) return;
  const dir = code.slice(0, -1);
  for (const path of paths) if (path.startsWith(`${dir}/`)) return code;
}
