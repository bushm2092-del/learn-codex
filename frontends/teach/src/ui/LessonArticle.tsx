import { Children, createContext, isValidElement, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { loadSnapshot, useLessonSnapshot } from "../course/sourceSnapshot";
import { lessonArticleCopy } from "../i18n/lessonArticle";
import { sourceExplorer } from "../i18n/sourceExplorer";
import { useLocale } from "../i18n/useLocale";
import { CodeBlock } from "./CodeBlock";
import { openLessonSource } from "./lessonSource";
import type { LocalLessonSource } from "./LessonSourceButton";
import { remarkLessonMarkup, sourceTarget, articleHeadings } from "./lessonMarkdown";
import "./LessonArticle.css";

export type ArticleComponents = Record<string, ComponentType<Record<string, string>>>;
const EMPTY_COMPONENTS: ArticleComponents = {};

function useSourcePaths(lesson: string, localSource?: LocalLessonSource) {
  const snapshot = useLessonSnapshot(lesson);
  const [paths, setPaths] = useState<{ lesson: string; values: ReadonlySet<string> }>();
  const localPaths = useMemo(() => localSource ? new Set(localSource.snapshot.files.map(file => file.path)) : undefined, [localSource]);
  useEffect(() => {
    if (!snapshot || localSource) return;
    let active = true;
    loadSnapshot(lesson).then(data => { if (active) setPaths({ lesson, values: new Set(data.files.map(file => file.path)) }); }).catch(() => {});
    return () => { active = false; };
  }, [lesson, snapshot, localSource]);
  return localPaths ?? (snapshot && paths?.lesson === lesson ? paths.values : undefined);
}

interface ArticleRenderState {
  lesson: string;
  paths?: ReadonlySet<string>;
  locale: "zh" | "en";
  openLabel: string;
  registry: ArticleComponents;
}
const ArticleRenderContext = createContext<ArticleRenderState | null>(null);
function useArticleRender() {
  const state = useContext(ArticleRenderContext);
  if (!state) throw new Error("Article renderer needs LessonArticle");
  return state;
}
// 渲染函数保持稳定的组件身份，避免更换语言时卸载嵌入的动画。
const renderers: Components = {
  code: function InlineCode({ children }) {
    const { lesson, paths, openLabel } = useArticleRender();
    const target = sourceTarget(String(children), paths);
    return target ? <button type="button" className="lesson-article__path" aria-label={`${openLabel} ${target}`} onClick={() => openLessonSource(lesson, target)}>{children}</button> : <code>{children}</code>;
  },
  pre: function FencedCode({ children }) {
    const { locale } = useArticleRender();
    const child = Children.toArray(children)[0];
    if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return <pre>{children}</pre>;
    const language = /language-([^\s]+)/.exec(child.props.className ?? "")?.[1] ?? "text";
    const code = String(child.props.children ?? "").replace(/\n$/, "");
    const label = language === "text" ? lessonArticleCopy[locale].code : language === "rust" ? "Rust" : language === "toml" ? "TOML" : language.startsWith("json") ? "JSON" : language;
    return <CodeBlock code={code} label={label} language={language} />;
  },
  table: function ArticleTable({ children }) { return <div className="lesson-article__table"><table>{children}</table></div>; },
  div: function EmbeddedComponent({ node, children }) {
    const { registry, locale } = useArticleRender();
    const name = node?.properties["data-lesson-component"];
    if (typeof name !== "string") return <div>{children}</div>;
    const Component = Object.hasOwn(registry, name) ? registry[name] : undefined;
    if (!Component) return <p className="lesson-article__missing" role="alert">{lessonArticleCopy[locale].missingComponent}: <code>{name}</code></p>;
    const props = Object.fromEntries(Object.entries(node?.properties ?? {}).filter(([key]) => key.startsWith("data-prop-")).map(([key, value]) => [key.slice(10), String(value)]));
    return <Component {...props} />;
  },
};

export function LessonArticle({ lesson, markdown, components: registry = EMPTY_COMPONENTS, localSource, showContents = false }: {
  lesson: string; markdown: string; components?: ArticleComponents; localSource?: LocalLessonSource; showContents?: boolean;
}) {
  const { locale } = useLocale();
  const paths = useSourcePaths(lesson, localSource);
  const headings = useMemo(() => articleHeadings(markdown), [markdown]);
  const state = useMemo(() => ({ lesson, paths, locale, openLabel: sourceExplorer[locale].openFile, registry }), [lesson, paths, locale, registry]);
  return <ArticleRenderContext.Provider value={state}><div className="lesson-article">
    {showContents && <details className="lesson-article__contents" open><summary>{lessonArticleCopy[locale].contents}</summary><ol>{headings.map(heading => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol></details>}
    <Markdown remarkPlugins={[remarkGfm, remarkDirective, remarkLessonMarkup]} components={renderers} skipHtml>{markdown}</Markdown>
  </div></ArticleRenderContext.Provider>;
}
