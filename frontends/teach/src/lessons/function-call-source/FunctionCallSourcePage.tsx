import { Link } from "react-router-dom";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";
import { functionCallSource } from "../../i18n/functionCallSource";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { LessonSourceButton } from "../../ui/LessonSourceButton";
import { LessonRepositoryNote } from "../../ui/LessonRepositoryNote";
import { ChapterCommunity } from "../../community/ChapterCommunity";
import { LessonArticle } from "./LessonArticle";
import article from "./article.md?raw";
import "./FunctionCallSourcePage.css";

export function FunctionCallSourcePage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === "function-call-source")!;
  const content = functionCallSource[locale];
  return <main className="lesson-layout">
    <CourseSidebar />
    <article className="lesson-page source-walkthrough">
      <header className="lesson-heading">
        <div className="lesson-title-row"><span className="lesson-index">s04</span><h1>{lesson.title[locale]}</h1></div>
        <p className="lesson-kicker">{lesson.description[locale]}</p>
        <div className="source-walkthrough__tags">
          <span className="lesson-status-badge" data-status={lesson.status}>{copy.home.ready}</span>
          <LessonSourceButton lesson={lesson.id} />
          <a className="source-walkthrough__debug" href="https://github.com/bushm2092-del/mini-codex/tree/lesson/function-call-source/mini-codex-rs" target="_blank" rel="noopener noreferrer" aria-label={`${content.debugSource} · GitHub${content.opensNewTab}`}>
            {content.debugSource}
            <span className="source-walkthrough__debug-platform">GitHub</span>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M6 6h8v8" /></svg>
          </a>
        </div>
        <p className="lesson-summary">{content.overview}</p>
      </header>
      <LessonArticle lesson={lesson.id} markdown={article} />
      <p className="lesson-article__back"><Link to="/lessons/function-call">{content.back}</Link></p>
      <LessonRepositoryNote /><ChapterCommunity chapter={lesson.id} />
    </article>
  </main>;
}
