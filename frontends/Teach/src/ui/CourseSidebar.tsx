import { NavLink } from "react-router-dom";

import { lessons } from "../course/catalog";
import { useLocale } from "../i18n/useLocale";
import "./CourseSidebar.css";

// 课程导航负责目录绑定；每课页面只负责自己的讲解和场景。
export function CourseSidebar() {
  const { locale, copy } = useLocale();

  return (
    <aside className="lesson-sidebar" aria-label={copy.lesson.sidebarAria}>
      <p className="lesson-sidebar__group"><i aria-hidden="true" />{copy.home.pathTitle}</p>
      <nav>
        {lessons.map((lesson) =>
          lesson.status === "planned" ? (
            <div className="lesson-sidebar__planned" key={lesson.id}>
              <span>s{String(lesson.order).padStart(2, "0")}</span>
              <span>{lesson.title[locale]}<small>{copy.home.planned}</small></span>
            </div>
          ) : (
            <NavLink key={lesson.id} to={lesson.path}>
              <span>s{String(lesson.order).padStart(2, "0")}</span>
              {lesson.title[locale]}
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  );
}
