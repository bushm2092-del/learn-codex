import { useLocale } from "../../i18n/useLocale";
import { functionCallSource } from "../../i18n/functionCallSource";
import { LessonPage } from "../../ui/LessonPage";
import { articleBody } from "../../ui/lessonMarkdown";
import article from "./article.md?raw";

export function FunctionCallSourcePage() {
  const { locale } = useLocale();
  const content = functionCallSource[locale];
  return <LessonPage lesson="function-call-source" summary={content.overview} markdown={articleBody(article)}
    previous={{ to: "/lessons/function-call", label: content.back }}
    actions={<a className="lesson-document__external" href="https://github.com/bushm2092-del/mini-codex/tree/lesson/function-call-source/mini-codex-rs" target="_blank" rel="noopener noreferrer" aria-label={`${content.debugSource} · GitHub${content.opensNewTab}`}>
      {content.debugSource}<span>GitHub</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M6 6h8v8" /></svg>
    </a>} />;
}
