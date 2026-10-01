import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import GithubSlugger from "github-slugger";

interface MarkdownNode {
  type: string;
  value?: string;
  depth?: number;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: MarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
}
export interface ArticleHeading { id: string; text: string; level: number }
const textContent = (node: MarkdownNode): string => node.value ?? node.children?.map(textContent).join("") ?? "";

// Markdown 只声明注册组件的名称和字符串参数；不执行 HTML、JS 或任意 import。
export function remarkLessonMarkup() {
  return (tree: MarkdownNode) => {
    const slugger = new GithubSlugger();
    const visit = (node: MarkdownNode) => {
      if (node.type === "heading") {
        const last = node.children?.at(-1);
        const explicit = last?.type === "text" ? /\s+\{#([\w-]+)\}$/.exec(last.value ?? "") : null;
        if (explicit && last) last.value = last.value!.slice(0, -explicit[0].length);
        node.data = { ...node.data, hProperties: { id: explicit?.[1] ?? slugger.slug(textContent(node)) } };
      }
      if (node.type === "leafDirective" || node.type === "containerDirective") {
        node.data = { hName: "div", hProperties: { "data-lesson-component": node.name ?? "", ...Object.fromEntries(Object.entries(node.attributes ?? {}).map(([key, value]) => [`data-prop-${key}`, value ?? ""])) } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

export function sourceTarget(code: string, paths: ReadonlySet<string> | undefined) {
  if (!paths || !code.startsWith("crates/")) return;
  if (paths.has(code)) return code;
  if (code.endsWith("/") && [...paths].some(path => path.startsWith(code))) return code;
}

// 第四章旧 Markdown 的课头已经由通用壳层展示，迁移时保留原正文。
export function articleBody(markdown: string) {
  const start = markdown.search(/^## /m);
  return start < 0 ? markdown : markdown.slice(start);
}

export function articleHeadings(markdown: string): ArticleHeading[] {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkLessonMarkup);
  const tree = processor.runSync(processor.parse(markdown)) as MarkdownNode;
  return (tree.children ?? []).filter(node => node.type === "heading" && node.depth === 2).map(node => ({ id: node.data?.hProperties?.id ?? "", text: textContent(node), level: 2 }));
}
