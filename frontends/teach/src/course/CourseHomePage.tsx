import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { lessons } from "./catalog";
import { useLocale } from "../i18n/useLocale";
import { DirectoryComparison } from "../ui/DirectoryComparison";
import { sourceComparison } from "./sourceComparison";
import { ChapterTags } from "../community/ChapterTags";
import { ImageZoom } from "../ui/ImageZoom";
import resultImage from "./assets/mini-codex-preview.png";
import "./CourseHomePage.css";

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
      <section className="course-hero course-hero--preview" aria-labelledby="course-title">
        <div className="course-hero__copy">
        <h1 id="course-title" data-home-reveal>Learn Codex</h1>
        <p className="course-hero__note" data-home-reveal>
          {copy.home.note}
        </p>
        <Link className="primary-action" to="/lessons/agent-loop" data-home-reveal>
          {copy.home.start} <span aria-hidden="true">→</span>
        </Link>
        </div>
        <figure className="course-result__figure" data-home-reveal>
          <ImageZoom src={resultImage} alt={copy.home.resultAlt} width={1536} height={1024}
            zoomLabel={copy.home.resultZoom} zoomHint={copy.home.resultZoomHint} closeLabel={copy.home.resultClose} />
          <figcaption><span>{copy.home.resultTitle}</span><span>{copy.home.resultCaption}</span></figcaption>
        </figure>
      </section>

      <section className="core-pattern" id="core-pattern" aria-labelledby="source-approach-title" data-home-reveal>
        <div className="section-heading">
          <h2 id="source-approach-title">{copy.home.sourceTitle}</h2>
          <p>{copy.home.sourceDescription}</p>
          <p>{copy.home.sourceStructure}</p>
          <p>{copy.home.sourceLanguage}</p>
          <p>{copy.home.sourceNext}</p>
        </div>
        <DirectoryComparison {...sourceComparison[locale]} />
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
              <span className="lesson-card__meta"><ChapterTags chapter={lesson.id} status={lesson.status} available={lesson.available !== false} /></span>
              <span className="lesson-card__body">
                <strong>{lesson.title[locale]}</strong>
                <small>
                  {lesson.description[locale]}
                </small>
              </span>
              {lesson.status !== "planned" && lesson.available !== false && <span className="lesson-card__arrow" aria-hidden="true">→</span>}
              </>
            );
            return lesson.status === "planned" || lesson.available === false ? (
              <div className="lesson-card" key={lesson.id} data-status={lesson.status}>{content}</div>
            ) : (
              <Link className="lesson-card" key={lesson.id} to={lesson.path} data-status={lesson.status}>{content}</Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
