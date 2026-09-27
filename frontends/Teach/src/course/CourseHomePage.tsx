import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { lessons } from "./catalog";
import { useLocale } from "../i18n/useLocale";

gsap.registerPlugin(useGSAP);

export function CourseHomePage() {
  const pageRef = useRef<HTMLElement>(null);
  const { locale, copy } = useLocale();

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set("[data-home-reveal]", { autoAlpha: 1, y: 0 });
            return;
          }

          gsap
            .timeline({ defaults: { duration: 0.65, ease: "power3.out" } })
            .fromTo(
              "[data-home-reveal]",
              { autoAlpha: 0, y: 22 },
              { autoAlpha: 1, y: 0, stagger: 0.09 },
            );
        },
        pageRef.current ?? undefined,
      );
      return () => media.revert();
    },
    { scope: pageRef },
  );

  return (
    <main className="course-home" ref={pageRef}>
      <section className="course-hero" aria-labelledby="course-title">
        <h1 id="course-title" data-home-reveal>Learn Codex</h1>
        <p className="course-hero__note" data-home-reveal>
          {copy.home.note}
        </p>
        <Link className="primary-action" to="/lessons/agent-loop" data-home-reveal>
          {copy.home.start} <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="core-pattern" id="core-pattern" data-home-reveal>
        <div className="section-heading">
          <h2>{copy.home.coreTitle}</h2>
          <p>{copy.home.coreDescription}</p>
        </div>
        <div className="code-window" aria-label={copy.home.codeAria}>
          <div className="code-window__bar">
            <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>harness.rs</span>
          </div>
          <pre><code><span className="code-keyword">loop</span> {`{`}{"\n"}
{"  "}<span className="code-comment">{copy.home.codeComment}</span>{"\n"}
{"  "}<span className="code-call">run_turn</span>();{"\n"}
{`}`}</code></pre>
        </div>
      </section>

      <section className="timeline-preview" data-home-reveal>
        <div className="section-heading">
          <h2>{copy.home.timelineTitle}</h2>
          <p>{copy.home.timelineDescription}</p>
        </div>
        <div className="timeline-shell">
          <span className="timeline-shell__label">events[]</span>
          <span className="timeline-shell__count">len=0</span>
          <div className="timeline-shell__empty">{copy.home.waiting}</div>
        </div>
      </section>

      <section className="learning-path" id="learning-path" data-home-reveal>
        <div className="section-heading section-heading--left">
          <h2>{copy.home.pathTitle}</h2>
          <p>{copy.home.pathDescription}</p>
        </div>
        <div className="lesson-list" aria-label={copy.home.catalogAria}>
          {lessons.map((lesson) => {
            const content = (
              <>
              <span className="lesson-card__number">s{String(lesson.order).padStart(2, "0")}</span>
              <span className="lesson-card__meta">{lesson.status === "planned" ? copy.home.planned : copy.home.draft}</span>
              <span className="lesson-card__body">
                <strong>{lesson.title[locale]}</strong>
                <small>
                  {lesson.description[locale]}
                </small>
              </span>
              {lesson.status !== "planned" && <span className="lesson-card__arrow" aria-hidden="true">→</span>}
              </>
            );
            return lesson.status === "planned" ? (
              <div className="lesson-card" key={lesson.id} data-status="planned">{content}</div>
            ) : (
              <Link className="lesson-card" key={lesson.id} to={lesson.path} data-status={lesson.status}>{content}</Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
