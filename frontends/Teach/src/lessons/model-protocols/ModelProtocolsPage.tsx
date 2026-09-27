import { Link } from "react-router-dom";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";
import { modelProtocols } from "../../i18n/modelProtocols";
import { rustSandbox } from "../../i18n/rustSandbox";
import { RustSandbox } from "./RustSandbox";

export function ModelProtocolsPage() {
  const { locale, copy } = useLocale();
  const lesson = lessons.find(item => item.id === "model-protocols")!;
  const t = modelProtocols[locale];
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
        {t.paragraphs[index].map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {index === 0 && <figure className="protocol-docs"><a href="https://api-docs.deepseek.com/zh-cn/" target="_blank" rel="noreferrer"><img src="/deepseek-docs.png" alt={rustSandbox[locale].alt} loading="lazy" width="1647" height="817" /></a><figcaption>{rustSandbox[locale].docs}</figcaption></figure>}
        {index === 0 && <RustSandbox />}
      </section>)}
      <section className="lesson-section">
        <p><a href="https://developers.openai.com/api/reference/resources/chat" target="_blank" rel="noreferrer">{t.reference}</a></p>
        <Link to="/lessons/agent-loop">{t.back}</Link>
      </section>
    </article>
  </main>;
}
