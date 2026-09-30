import { Link } from "react-router-dom";
import { lessons } from "../../course/catalog";
import { contextLesson } from "../../i18n/context";
import { useLocale } from "../../i18n/useLocale";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { CodeBlock } from "../../ui/CodeBlock";
import { LessonRepositoryNote } from "../../ui/LessonRepositoryNote";
import { ChapterCommunity } from "../../community/ChapterCommunity";

export function ContextPage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === "context")!;
  const content = contextLesson[locale];
  return <main className="lesson-layout">
    <CourseSidebar />
    <article className="lesson-page">
      <header className="lesson-heading">
        <div className="lesson-title-row"><span className="lesson-index">s05</span><h1>{lesson.title[locale]}</h1><span className="lesson-status-badge" data-status={lesson.status}>{copy.home.draft}</span></div>
        <p className="lesson-kicker">{lesson.description[locale]}</p>
        <p className="lesson-summary">{content.summary}</p>
      </header>
      {content.sections.map(section => <section className="lesson-section" key={section.title}>
        <h2>{section.title}</h2>
        {section.paragraphs.map(text => <p key={text}>{text}</p>)}
        {section.code && section.label && <CodeBlock code={section.code} label={section.label} />}
      </section>)}
      <p><Link to="/lessons/function-call-source">{content.back}</Link></p>
      <LessonRepositoryNote /><ChapterCommunity chapter={lesson.id} />
    </article>
  </main>;
}
