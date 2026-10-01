import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { lessons } from "../course/catalog";
import { useLocale } from "../i18n/useLocale";
import { CourseSidebar } from "./CourseSidebar";
import { LessonSourceButton, type LocalLessonSource } from "./LessonSourceButton";
import { LessonArticle, type ArticleComponents } from "./LessonArticle";
import { LessonRepositoryNote } from "./LessonRepositoryNote";
import { ChapterCommunity } from "../community/ChapterCommunity";
import "./LessonPage.css";

export function LessonPage({ lesson: id, summary, markdown, localSource, components, showContents, actions, previous }: {
  lesson: string; summary: string; markdown: string; localSource?: LocalLessonSource; components?: ArticleComponents;
  showContents?: boolean; actions?: ReactNode; previous?: { to: string; label: string };
}) {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === id);
  if (!lesson) throw new Error(`Unknown lesson: ${id}`);
  return <main className="lesson-layout">
    <CourseSidebar />
    <article className="lesson-page lesson-document">
      <header className="lesson-heading">
        <div className="lesson-title-row"><span className="lesson-index">s{String(lesson.order).padStart(2, "0")}</span><h1>{lesson.title[locale]}</h1></div>
        <p className="lesson-kicker">{lesson.description[locale]}</p>
        <div className="lesson-document__actions">
          <span className="lesson-status-badge" data-status={lesson.status}>{lesson.status === "ready" ? copy.home.ready : copy.home.draft}</span>
          <LessonSourceButton lesson={id} localSource={localSource} />{actions}
        </div>
        <p className="lesson-summary">{summary}</p>
      </header>
      <LessonArticle lesson={id} markdown={markdown} localSource={localSource} components={components} showContents={showContents} />
      {previous && <p className="lesson-document__back"><Link to={previous.to}>{previous.label}</Link></p>}
      <LessonRepositoryNote /><ChapterCommunity chapter={id} />
    </article>
  </main>;
}
