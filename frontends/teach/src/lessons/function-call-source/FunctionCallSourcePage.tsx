import { Link } from "react-router-dom";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";
import { functionCallSource } from "../../i18n/functionCallSource";
import { toolArchitecture, toolTypeExcerpts } from "../../i18n/toolArchitecture";
import { CodeBlock } from "../../ui/CodeBlock";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { LessonSourceButton } from "../../ui/LessonSourceButton";
import { LessonRepositoryNote } from "../../ui/LessonRepositoryNote";
import { ChapterCommunity } from "../../community/ChapterCommunity";
import "./FunctionCallSourcePage.css";

export function FunctionCallSourcePage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === "function-call-source")!;
  const content = functionCallSource[locale];
  const architecture = toolArchitecture[locale];
  return <main className="lesson-layout">
    <CourseSidebar />
    <article className="lesson-page source-walkthrough">
      <header className="lesson-heading">
        <div className="lesson-title-row"><span className="lesson-index">s04</span><h1>{lesson.title[locale]}</h1><span className="lesson-status-badge" data-status={lesson.status}>{copy.home.draft}</span><LessonSourceButton lesson={lesson.id} /></div>
        <p className="lesson-kicker">{lesson.description[locale]}</p>
        <p className="lesson-summary">{content.overview}</p>
      </header>
      <section className="lesson-section"><h2>{architecture.title}</h2><p>{architecture.intro}</p><p>{content.version}</p></section>
      <section className="lesson-section"><h2>{architecture.mapTitle}</h2>
        <dl>{architecture.modules.map(module => <div key={module.name}><dt><code>{module.name}</code></dt><dd>{module.text}</dd></div>)}</dl>
      </section>
      <section className="lesson-section"><h2>{architecture.typesTitle}</h2>
        {architecture.types.map(type => <section key={type.name}>
          <h3>{type.name}</h3><p><code>{type.path}</code></p>
          {"code" in type && type.code && <CodeBlock label={architecture.excerpt} code={toolTypeExcerpts[type.code as keyof typeof toolTypeExcerpts]} />}
          <p>{type.text}</p><p>{type.why}</p>
        </section>)}
      </section>
      <section className="lesson-section"><h2>{architecture.boundaryTitle}</h2><p>{architecture.boundary}</p></section>
      <section className="lesson-section"><h2>{architecture.traceTitle}</h2><p>{architecture.trace}</p></section>
      <section className="lesson-section"><h2>{content.title}</h2><p>{content.intro}</p></section>
      {content.steps.map((step, index) => <section className="lesson-section" key={step.path}>
        <h2>{index + 1}. {step.title}</h2>
        <p><code>{step.path}</code></p><p><code>{step.symbol}</code></p>
        <p>{step.text}</p>
      </section>)}
      <section className="lesson-section"><h2>{content.resultTitle}</h2><p>{content.result}</p></section>
      <section className="lesson-section"><h2>{content.readTitle}</h2><p>{content.read}</p><Link to="/lessons/function-call">{content.back}</Link></section>
      <LessonRepositoryNote /><ChapterCommunity chapter={lesson.id} />
    </article>
  </main>;
}
