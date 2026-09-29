import { CourseSidebar } from "../../ui/CourseSidebar";
import { useLocale } from "../../i18n/useLocale";
import "./AgentLoopPage.css";
import { ManualCopyDemo } from "./ManualCopyDemo";
import { agentLoopArchitecture } from "../../i18n/agentLoopArchitecture";
import { AutomatedLoopDemo } from "./AutomatedLoopDemo";
import { CodeBlock } from "../../ui/CodeBlock";
import { agentLoopCode } from "../../i18n/agentLoopCode";
import { agentLoopFunctions } from "../../i18n/agentLoopFunctions";
import { ChapterCommunity } from "../../community/ChapterCommunity";
import { LessonRepositoryNote } from "../../ui/LessonRepositoryNote";

export function AgentLoopPage() {
  const { copy, locale } = useLocale();
  const architecture = agentLoopArchitecture[locale];
  const code = agentLoopCode[locale];
  const functions = agentLoopFunctions[locale];

  return (
    <main className="lesson-layout">
      <CourseSidebar />

      <article className="lesson-page">
        <header className="lesson-heading">
          <div className="lesson-title-row">
            <span className="lesson-index">s01</span>
            <h1>{copy.lesson.title}</h1>
            <span className="topic-badge">{copy.lesson.topic}</span>
          </div>
          <p className="lesson-kicker">{copy.lesson.kicker}</p>
          <div className="lesson-meta">
            <span>{copy.lesson.session}</span>
            <span>{copy.lesson.interactive}</span>
          </div>
          <p className="lesson-summary">
            {copy.lesson.summary}
          </p>
        </header>

        <section className="lesson-section agent-loop-intro" aria-labelledby="agent-loop-intro-title">
          <h2 id="agent-loop-intro-title">{copy.lesson.introTitle}</h2>
          <p>{copy.lesson.introOpening}</p>
          <ol>
            {copy.lesson.manualSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p>{copy.lesson.introComplexity}</p>
          <p>{copy.lesson.turnExplanation}</p>
          <p>{copy.lesson.introAutomation}</p>
        </section>

        <ManualCopyDemo />
        <section className="lesson-section agent-loop-intro" aria-labelledby="agent-loop-architecture-title">
          <h2 id="agent-loop-architecture-title">{architecture.title}</h2>
          <p>{architecture.opening}</p>
          <p>{architecture.tools}</p>
          <h3>{architecture.modulesTitle}</h3>
          <ol>{architecture.modules.map((module) => <li key={module.title}><strong>{module.title}</strong><br/>{module.body}</li>)}</ol>
          <p>{architecture.loop}</p>
          <p>{architecture.ending}</p>
        </section>
        <section className="lesson-section agent-loop-intro" aria-labelledby="agent-loop-code-title">
          <h2 id="agent-loop-code-title">{code.title}</h2>
          <p>{code.intro}</p>
          {functions.sections.map((section) => <section key={section.label}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
            <CodeBlock code={section.code} label={section.label} />
          </section>)}
          <h3>{functions.title}</h3>
          <CodeBlock code={code.code} label={code.label} />
        </section>
        <AutomatedLoopDemo />
        <LessonRepositoryNote />
        <ChapterCommunity chapter="agent-loop" />
      </article>
    </main>
  );
}
