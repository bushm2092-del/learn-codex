import { NavLink } from "react-router-dom";
import { useState } from "react";

import { lessons } from "../course/catalog";
import { useLocale } from "../i18n/useLocale";
import "./CourseSidebar.css";

// 课程导航负责目录绑定；每课页面只负责自己的讲解和场景。
export function CourseSidebar() {
  const { locale, copy } = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="lesson-sidebar" data-collapsed={collapsed} aria-label={copy.lesson.sidebarAria}>
      <div className="lesson-sidebar__heading">
        {!collapsed && <p className="lesson-sidebar__group"><i aria-hidden="true" />{copy.home.pathTitle}</p>}
        <button className="lesson-sidebar__toggle" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-controls="course-sidebar-links" aria-label={collapsed ? copy.lesson.expandSidebar : copy.lesson.collapseSidebar} title={collapsed ? copy.lesson.expandSidebar : copy.lesson.collapseSidebar}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"}/></svg>
        </button>
      </div>
      <nav id="course-sidebar-links" hidden={collapsed}>
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
