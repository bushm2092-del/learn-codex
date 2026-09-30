import { useEffect, useState, type ReactNode } from "react";
import type { ThemedToken } from "shiki/core";

import { loadSnapshot, useLessonSnapshot } from "../../course/sourceSnapshot";
import { sourceExplorer } from "../../i18n/sourceExplorer";
import { useLocale } from "../../i18n/useLocale";
import { CodeBlockFrame } from "../../ui/CodeBlockFrame";
import { openLessonSource } from "../../ui/lessonSource";
import { articleBody, parseArticle, sourceTarget, type ArticleBlock } from "./article";
import "./LessonArticle.css";

const highlighter = Promise.all([
  import("shiki/core"),
  import("shiki/engine/javascript"),
  import("shiki/langs/rust.mjs"),
  import("shiki/langs/json.mjs"),
  import("shiki/langs/jsonc.mjs"),
  import("shiki/themes/github-light.mjs"),
]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }, rust, json, jsonc, theme]) =>
  createHighlighterCore({
    langs: [rust.default, json.default, jsonc.default],
    themes: [theme.default],
    engine: createJavaScriptRegexEngine(),
  }));

const highlighted = new Set(["rust", "json", "jsonc"]);

function useSourcePaths(lesson: string) {
  const snapshot = useLessonSnapshot(lesson);
  const [paths, setPaths] = useState<ReadonlySet<string>>();
  useEffect(() => {
    if (!snapshot) return;
    let active = true;
    loadSnapshot(lesson).then(data => {
      if (active) setPaths(new Set(data.files.map(file => file.path)));
    }).catch(() => { /* 快照不可用时路径保持普通代码，不提供打不开的入口。 */ });
    return () => { active = false; };
  }, [lesson, snapshot]);
  return snapshot ? paths : undefined;
}

function renderInline(text: string, lesson: string, paths: ReadonlySet<string> | undefined, openLabel: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const code = match[1];
    if (code !== undefined) {
      const target = sourceTarget(code, paths);
      nodes.push(target
        ? <button key={key++} type="button" className="lesson-article__path" aria-label={`${openLabel} ${target}`} onClick={() => openLessonSource(lesson, target)}>{code}</button>
        : <code key={key++}>{code}</code>);
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={key++}>{renderInline(match[2], lesson, paths, openLabel)}</strong>);
    } else {
      nodes.push(<em key={key++}>{renderInline(match[3], lesson, paths, openLabel)}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function languageLabel(language: string, locale: "zh" | "en") {
  if (language === "rust") return "Rust";
  if (language === "json" || language === "jsonc") return "JSON";
  return locale === "zh" ? "代码" : "Code";
}

function ArticleCode({ code, language, locale }: { code: string; language: string; locale: "zh" | "en" }) {
  const [tokens, setTokens] = useState<ThemedToken[][]>();
  const lang = highlighted.has(language) ? language : undefined;
  useEffect(() => {
    if (!lang) return;
    let active = true;
    highlighter.then(instance => {
      const result = instance.codeToTokens(code, { lang, theme: "github-light" });
      if (active) setTokens(result.tokens);
    }).catch(() => { /* 高亮不可用时仍展示原始代码。 */ });
    return () => { active = false; };
  }, [code, lang]);
  const label = languageLabel(language, locale);
  return <CodeBlockFrame code={code} label={label}>
    <pre tabIndex={0} aria-label={label}><code>{tokens
      ? tokens.map((line, index) => <span key={index}>{line.map((token, i) =>
        <span key={i} style={{ color: token.color }}>{token.content}</span>)}{index < tokens.length - 1 ? "\n" : ""}</span>)
      : code}</code></pre>
  </CodeBlockFrame>;
}

const headings = { 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const;

function Block({ block, lesson, paths, openLabel, locale }: {
  block: ArticleBlock; lesson: string; paths: ReadonlySet<string> | undefined; openLabel: string; locale: "zh" | "en";
}) {
  const inline = (text: string) => renderInline(text, lesson, paths, openLabel);
  if (block.kind === "heading") {
    const Tag = headings[block.level as keyof typeof headings];
    return <Tag>{inline(block.text)}</Tag>;
  }
  if (block.kind === "list") return <ul>{block.items.map(item => <li key={item}>{inline(item)}</li>)}</ul>;
  if (block.kind === "code") return <ArticleCode code={block.code} language={block.language} locale={locale} />;
  if (block.kind === "table") return <div className="lesson-article__table"><table>
    <thead><tr>{block.header.map(cell => <th key={cell}>{inline(cell)}</th>)}</tr></thead>
    <tbody>{block.rows.map(row => <tr key={row.join("\0")}>{row.map((cell, index) => <td key={index}>{inline(cell)}</td>)}</tr>)}</tbody>
  </table></div>;
  return <p>{inline(block.text)}</p>;
}

export function LessonArticle({ lesson, markdown }: { lesson: string; markdown: string }) {
  const { locale } = useLocale();
  const paths = useSourcePaths(lesson);
  const openLabel = sourceExplorer[locale].openFile;
  const blocks = parseArticle(articleBody(markdown));
  return <div className="lesson-article">
    {blocks.map((block, index) => <Block key={index} block={block} lesson={lesson} paths={paths} openLabel={openLabel} locale={locale} />)}
  </div>;
}
