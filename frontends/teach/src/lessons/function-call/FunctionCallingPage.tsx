import { Link } from "react-router-dom";

import { ChapterCommunity } from "../../community/ChapterCommunity";
import { lessons } from "../../course/catalog";
import { functionCalling, functionCallingRustExample, functionCallItem, functionCallResponse, functionCallResult, toolDispatchRustExample, weatherToolsDefinition } from "../../i18n/functionCalling";
import { useLocale } from "../../i18n/useLocale";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { LessonSourceButton } from "../../ui/LessonSourceButton";
import { JsonCodeBlock } from "../../ui/JsonOutput";
import { LessonRepositoryNote } from "../../ui/LessonRepositoryNote";
import { RustSandbox } from "../model-protocols/RustSandbox";
import { ToolExecutionFlow } from "./ToolExecutionFlow";
import "./FunctionCallingPage.css";

export function FunctionCallingPage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find((item) => item.id === "function-call")!;
  const content = functionCalling[locale];
  const examples = [
    { id: "weather-request", label: content.rustTitle, code: functionCallingRustExample, runnable: true },
    { id: "weather-tools", label: content.toolDefinitionLabel, code: weatherToolsDefinition },
    { id: "weather-response", label: content.callLabel, code: functionCallResponse },
    { id: "weather-call", label: content.callItemLabel, code: functionCallItem },
    { id: "weather-result", label: content.toolResultLabel, code: functionCallResult },
    { id: "weather-loop", label: content.dispatchExampleTitle, code: toolDispatchRustExample, runnable: true },
  ];

  return (
    <main className="lesson-layout">
      <CourseSidebar />
      <article className="lesson-page">
        <header className="lesson-heading">
          <div className="lesson-title-row">
            <span className="lesson-index">s03</span>
            <h1>{lesson.title[locale]}</h1>
            <span className="lesson-status-badge" data-status={lesson.status}>{copy.home.ready}</span>
            <LessonSourceButton lesson={lesson.id} />
          </div>
          <p className="lesson-kicker">{lesson.description[locale]}</p>
          <p className="lesson-summary">{content.overview}</p>
        </header>

        <section className="lesson-section" aria-labelledby="function-calling-intro-title">
          <h2 id="function-calling-intro-title">{content.introTitle}</h2>
          {content.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <RustSandbox
            initialSource={functionCallingRustExample}
            examples={examples} exampleId="weather-request"
            lessonPath="/lessons/function-call"
            title={content.rustTitle}
            intro={content.rustIntro}
            empty={content.rustEmpty}
          />
        </section>

        <p>{content.toolDefinitionIntro}</p>
        <JsonCodeBlock output={weatherToolsDefinition} label={content.toolDefinitionLabel} />
        <dl className="tool-field-guide">
          {content.toolFields.map((item) => <div key={item.field}>
            <dt><code>{item.field}</code></dt>
            <dd>{item.text}</dd>
          </div>)}
        </dl>
        <p>{content.toolDefinitionSummary}</p>
        <p>{content.responsePrintIntro}</p>
        <JsonCodeBlock output={functionCallResponse} label={content.callLabel} />
        <p>{content.callItemIntro}</p>
        <JsonCodeBlock output={functionCallItem} label={content.callItemLabel} />
        <p>{content.callItemSummary}</p>
        <p>{content.toolResultIntro}</p>
        <JsonCodeBlock output={functionCallResult} label={content.toolResultLabel} />
        <p>{content.toolResultSummary}</p>
        <p>{content.responseExplanation}</p>
        <RustSandbox
          initialSource={toolDispatchRustExample}
          examples={examples} exampleId="weather-loop"
          lessonPath="/lessons/function-call"
          title={content.dispatchExampleTitle}
          intro={content.dispatchExampleIntro}
          empty={content.dispatchExampleEmpty}
        />

        <section className="lesson-section" aria-labelledby="tool-execution-title">
          <h2 id="tool-execution-title">{content.executionTitle}</h2>
          {content.executionIntro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <ToolExecutionFlow label={content.flowLabel} steps={content.flowSteps} />

          <p className="tool-reference"><a href="https://developers.openai.com/api/docs/guides/function-calling" target="_blank" rel="noreferrer">{content.reference}</a></p>
          <p><Link to="/lessons/model-protocols">{content.back}</Link></p>
          <p><Link to="/lessons/function-call-source">{content.next}</Link></p>
        </section>

        <LessonRepositoryNote />
        <ChapterCommunity chapter="function-call" />
      </article>
    </main>
  );
}
