import { Link } from "react-router-dom";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";
import { modelProtocols, chatRequest, chatResponse, responsesProtocol, responsesRequest, responsesResponse } from "../../i18n/modelProtocols";
import { JsonOutput } from "../../ui/JsonOutput";
import "../../ui/CodeBlock.css";
import { rustSandbox } from "../../i18n/rustSandbox";
import { RustSandbox } from "./RustSandbox";

export function ModelProtocolsPage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === "model-protocols")!;
  const t = modelProtocols[locale];
  const responses = responsesProtocol[locale];
  return <main className="lesson-layout">
    <CourseSidebar />
    <article className="lesson-page">
      <header className="lesson-heading">
        <div className="lesson-title-row">
          <span className="lesson-index">s02</span>
          <h1>{lesson.title[locale]}</h1>
          <span className="draft-badge">{copy.home.draft}</span>
        </div>
        <p className="lesson-kicker">{lesson.description[locale]}</p>
      </header>
      {t.sections.map((title, index) => <section className="lesson-section" key={title}>
        <h2>{title}</h2>
        {index === 1 && <figure className="ui-code-block"><figcaption>{t.requestLabel}</figcaption><JsonOutput output={chatRequest} label={t.requestLabel} /></figure>}
        {t.paragraphs[index].map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {index === 2 && <>
          <ul>{t.fields.map(field => <li key={field}>{field}</li>)}</ul>
          <figure className="ui-code-block"><figcaption>{t.responseLabel}</figcaption><JsonOutput output={chatResponse} label={t.responseLabel} /></figure>
          {t.chatDetails.map(part => <section key={part.title}><h3>{part.title}</h3><ul>{part.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}
        </>}
        {index === 0 && <figure className="protocol-docs"><a href="https://api-docs.deepseek.com/zh-cn/" target="_blank" rel="noreferrer"><img src="/deepseek-docs.png" alt={rustSandbox[locale].alt} loading="lazy" width="1647" height="817" /></a><figcaption>{rustSandbox[locale].docs}</figcaption></figure>}
        {index === 0 && <p>{t.contextNote}</p>}
        {index === 0 && <RustSandbox />}
      </section>)}
      <section className="lesson-section">
        <h2>{responses.title}</h2>
        <h3>{responses.whyTitle}</h3>
        {responses.why.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <p>{responses.note}</p>
        <figure className="ui-code-block"><figcaption>{responses.requestLabel}</figcaption><JsonOutput output={responsesRequest} label={responses.requestLabel} /></figure>
        <figure className="ui-code-block"><figcaption>{responses.responseLabel}</figcaption><JsonOutput output={responsesResponse} label={responses.responseLabel} /></figure>
        {responses.parts.map(part => <section key={part.title}><h3>{part.title}</h3><ul>{part.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}
        <p><a href="https://developers.openai.com/blog/responses-api" target="_blank" rel="noreferrer">{responses.reference}</a></p>
      </section>
      <section className="lesson-section">
        <p><a href="https://developers.openai.com/api/reference/resources/chat" target="_blank" rel="noreferrer">{t.reference}</a></p>
        <p><a href="https://developers.openai.com/api/docs/guides/migrate-to-responses" target="_blank" rel="noreferrer">OpenAI Responses API</a>{" · "}<a href="https://platform.claude.com/docs/en/api/messages" target="_blank" rel="noreferrer">Anthropic Messages API</a></p>
        <Link to="/lessons/agent-loop">{t.back}</Link>
      </section>
    </article>
  </main>;
}
