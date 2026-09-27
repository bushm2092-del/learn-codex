import { Link } from "react-router-dom";
import { CourseSidebar } from "../../ui/CourseSidebar";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";
import { modelProtocols } from "../../i18n/modelProtocols";

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
      <section className="lesson-section">
        <p>{t.note}</p>
        <Link to="/lessons/agent-loop">{t.back}</Link>
      </section>
    </article>
  </main>;
}
