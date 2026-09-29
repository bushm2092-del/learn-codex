import { Link } from "react-router-dom";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { LessonSourceButton } from "../../ui/LessonSourceButton";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";
import { modelProtocols, curlExample, chatRequest, chatResponse, chatToolRequest, chatToolResponse, chatToolFollowup, responsesProtocol, responsesRequest, responsesResponse, responsesToolRequest, responsesToolResponse, responsesToolFollowup } from "../../i18n/modelProtocols";
import { JsonCodeBlock } from "../../ui/JsonOutput";
import { CodeBlock } from "../../ui/CodeBlock";
import { rustSandbox } from "../../i18n/rustSandbox";
import { ImageZoom } from "../../ui/ImageZoom";
import { RustSandbox } from "./RustSandbox";
import { ChapterCommunity } from "../../community/ChapterCommunity";
import { LessonRepositoryNote } from "../../ui/LessonRepositoryNote";

export function ModelProtocolsPage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === "model-protocols")!;
  const t = modelProtocols[locale];
  const responses = responsesProtocol[locale];
  const sandbox = rustSandbox[locale];
  return <main className="lesson-layout">
    <CourseSidebar />
    <article className="lesson-page">
      <header className="lesson-heading">
        <div className="lesson-title-row">
          <span className="lesson-index">s02</span>
          <h1>{lesson.title[locale]}</h1>
          <span className="lesson-status-badge" data-status={lesson.status}>{lesson.status === "ready" ? copy.home.ready : copy.home.draft}</span>
          <LessonSourceButton lesson={lesson.id} />
        </div>
        <p className="lesson-kicker">{lesson.description[locale]}</p>
        <p className="lesson-summary">{t.overview}</p>
      </header>
      {t.sections.map((title, index) => <section className="lesson-section" key={title}>
        <h2>{title}</h2>
        {index === 1 && <JsonCodeBlock output={chatRequest} label={t.requestLabel} />}
        {t.paragraphs[index].map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {index === 2 && <>
          <ul>{t.fields.map(field => <li key={field}>{field}</li>)}</ul>
          <JsonCodeBlock output={chatResponse} label={t.responseLabel} />
          {t.chatDetails.map((part, detailIndex) => <section key={part.title}>
            <h3>{part.title}</h3>
            <ul>{part.items.map(item => <li key={item}>{item}</li>)}</ul>
            {detailIndex === 3 && [chatToolRequest, chatToolResponse, chatToolFollowup].map((output, exampleIndex) =>
              <JsonCodeBlock output={output} label={t.toolExampleLabels[exampleIndex]} key={exampleIndex} />)}
          </section>)}
        </>}
        {index === 0 && <figure className="protocol-docs">
          <ImageZoom src="/deepseek-docs.png" alt={sandbox.alt} width={1647} height={817} zoomLabel={sandbox.zoom} zoomHint={sandbox.zoomHint} closeLabel={sandbox.close} />
          <figcaption><a href="https://api-docs.deepseek.com/zh-cn/" target="_blank" rel="noreferrer">{sandbox.docs}</a></figcaption>
        </figure>}
        {index === 0 && <CodeBlock code={curlExample} label={t.curlLabel} language="bash" />}
        {index === 0 && <p>{t.contextNote}</p>}
        {index === 0 && <RustSandbox />}
      </section>)}
      <section className="lesson-section">
        <h2>{responses.title}</h2>
        <h3>{responses.whyTitle}</h3>
        {responses.why.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <p>{responses.note}</p>
        <JsonCodeBlock output={responsesRequest} label={responses.requestLabel} />
        <JsonCodeBlock output={responsesResponse} label={responses.responseLabel} />
        {responses.parts.map((part, partIndex) => <section key={part.title}>
          {partIndex === 2 && <p>{responses.chatComparison}</p>}
          <h3>{part.title}</h3>
          <ul>{part.items.map(item => <li key={item}>{item}</li>)}</ul>
          {partIndex === 1 && [responsesToolRequest, responsesToolResponse, responsesToolFollowup].map((output, exampleIndex) =>
            <JsonCodeBlock output={output} label={responses.toolExampleLabels[exampleIndex]} key={exampleIndex} />)}
        </section>)}
        <p><a href="https://developers.openai.com/blog/responses-api" target="_blank" rel="noreferrer">{responses.reference}</a></p>
      </section>
      <section className="lesson-section">
        <p><a href="https://developers.openai.com/api/reference/resources/chat" target="_blank" rel="noreferrer">{t.reference}</a></p>
        <p><a href="https://developers.openai.com/api/docs/guides/migrate-to-responses" target="_blank" rel="noreferrer">OpenAI Responses API</a>{" · "}<a href="https://platform.claude.com/docs/en/api/messages" target="_blank" rel="noreferrer">Anthropic Messages API</a></p>
        <Link to="/lessons/agent-loop">{t.back}</Link>
      </section>
      <LessonRepositoryNote />
      <ChapterCommunity chapter="model-protocols" />
    </article>
  </main>;
}
