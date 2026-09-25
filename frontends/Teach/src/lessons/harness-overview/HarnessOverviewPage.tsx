import { useCallback, useRef } from "react";
import { NavLink } from "react-router-dom";

import { TimelineControls } from "../../animation/TimelineControls";
import {
  useLessonTimeline,
  type LessonTimelineContext,
} from "../../animation/useLessonTimeline";
import { lessons } from "../../course/catalog";
import { useLocale } from "../../i18n/useLocale";

export function HarnessOverviewPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { locale, copy } = useLocale();

  const buildTimeline = useCallback(
    ({ timeline, reduceMotion }: LessonTimelineContext) => {
      if (reduceMotion) {
        timeline.set("[data-animate='stage-item']", {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
        });
        return;
      }

      timeline
        .addLabel("stage-in")
        .fromTo(
          "[data-animate='stage-item']",
          { autoAlpha: 0, y: 18, scale: 0.98 },
          { autoAlpha: 1, y: 0, scale: 1, stagger: 0.08 },
          "stage-in",
        )
        .fromTo(
          "[data-animate='signal']",
          { autoAlpha: 0, scaleX: 0 },
          {
            autoAlpha: 1,
            scaleX: 1,
            duration: 0.8,
            ease: "power3.inOut",
            stagger: 0.1,
          },
          "stage-in+=0.18",
        );
    },
    [],
  );

  const controls = useLessonTimeline(stageRef, buildTimeline);

  return (
    <main className="lesson-layout">
      <aside className="lesson-sidebar" aria-label={copy.lesson.sidebarAria}>
        <p className="lesson-sidebar__group"><i aria-hidden="true" /> {copy.lesson.coreGroup}</p>
        <nav>
          {lessons.map((lesson) => (
            <NavLink key={lesson.id} to={lesson.path}>
              <span>s{String(lesson.order).padStart(2, "0")}</span>
              {lesson.title[locale]}
            </NavLink>
          ))}
        </nav>
        <p className="lesson-sidebar__group lesson-sidebar__group--muted">
          <i aria-hidden="true" /> {copy.lesson.comingNext}
        </p>
        <div className="lesson-sidebar__placeholder">{copy.lesson.comingPlaceholder}</div>
      </aside>

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
            <span className="draft-badge">{copy.lesson.draft}</span>
          </div>
          <p className="lesson-summary">
            {copy.lesson.summary}
          </p>
        </header>

        <section className="lesson-section">
          <h2>{copy.lesson.stageTitle}</h2>
          <p className="lesson-section__formula">turn → events → tool → result</p>

          <div className="lesson-workspace" ref={stageRef}>
            <div className="stage-toolbar" data-animate="stage-item">
              <span>execution_timeline</span>
              <span className="stage-toolbar__status">
                <i aria-hidden="true" /> {copy.lesson.stageStatus}
              </span>
            </div>

            <div className="animation-stage" aria-label={copy.lesson.stageAria}>
              <div className="stage-grid" aria-hidden="true" />
              <div className="stage-placeholder" data-animate="stage-item">
                <span className="stage-placeholder__index">01</span>
                <strong>{copy.lesson.stageWaiting}</strong>
                <small>{copy.lesson.stageDescription}</small>
              </div>
              <i className="stage-signal stage-signal--top" data-animate="signal" />
              <i className="stage-signal stage-signal--bottom" data-animate="signal" />
            </div>

            <footer className="stage-footer" data-animate="stage-item">
              <span>1 / 1</span>
              <div className="stage-progress" aria-hidden="true"><i /></div>
              <TimelineControls controls={controls} />
            </footer>
          </div>
        </section>
      </article>
    </main>
  );
}
