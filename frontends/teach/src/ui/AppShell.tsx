import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useLocale } from "../i18n/useLocale";
import { NavigationMenu } from "./NavigationMenu";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "../auth/AccountControl";
import { PageViews } from "../community/PageViews";
import { SiteStats } from "../community/SiteStats";
import { talent } from "../i18n/talent";
import { community } from "../i18n/community";

export function AppShell() {
  const { copy, locale } = useLocale();
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <PageViews />
      <header className="topbar">
        <Link className="wordmark" to="/" aria-label={copy.navigation.home}>
          Learn Codex
        </Link>
        <nav className="topnav" aria-label={copy.navigation.mainNav}>
          <NavLink className="course-nav" to="/lessons/agent-loop">{copy.navigation.lessons}</NavLink>
          <NavLink className="talent-topnav" to="/talent">{talent[locale].title}</NavLink>
          <NavigationMenu label={copy.navigation.mainNav} items={[
            { to: "/lessons/agent-loop", label: copy.navigation.lessons, active: pathname.startsWith("/lessons/") },
            { to: "/talent", label: talent[locale].title, active: pathname.startsWith("/talent") },
            { to: "/leaderboard", label: community[locale].leaderboard, active: pathname === "/leaderboard" },
          ]} />
          <LanguageMenu />
          <NavLink className="community-nav" to="/leaderboard">{community[locale].leaderboard}</NavLink>
          <AccountControl />
          <a
            className="source-link"
            href="https://github.com/bushm2092-del/mini-codex"
            target="_blank"
            rel="noreferrer"
            aria-label={copy.navigation.source}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.04 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.58-.29-5.29-1.29-5.29-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18A10.98 10.98 0 0 1 12 6.08c.98 0 1.95.13 2.87.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.72 5.39-5.3 5.68.42.36.79 1.07.79 2.16v3.25c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
            </svg>
          </a>
        </nav>
      </header>

      <div className="app-content" id="content">
        <Outlet />
      </div>
      <SiteStats />
    </div>
  );
}
