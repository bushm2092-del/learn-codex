import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { AccountControl } from "../auth/AccountControl";
import { PageViews } from "../community/PageViews";
import { talent } from "../i18n/talent";
import { useLocale } from "../i18n/useLocale";
import { LanguageMenu } from "./LanguageMenu";
import { TalentArrow } from "./TalentArrow";
import mark from "./talent-mark.svg";
import "./TalentTests.css";

export type TalentShellContext = { setBusy: (busy: boolean) => void };

export function TalentShell({ loginPage = false }: { loginPage?: boolean }) {
  const { locale } = useLocale();
  const t = talent[locale];
  const [busy, setBusy] = useState(false);
  useEffect(() => { const previous = document.title; document.title = t.title; return () => { document.title = previous; }; }, [t.title]);
  return <div className="talent-shell">
    <PageViews />
    <a className="talent-skip" href="#talent-content">{t.skip}</a>
    <header className="talent-topbar">
      <Link className="talent-brand" to="/talent" onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy || undefined}><img src={mark} alt="" width="32" height="32" /><span>{t.title}</span></Link>
      <nav className="talent-topnav" aria-label={t.navigation}>
        <NavLink end to="/talent" onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy || undefined}>{t.hall}</NavLink>
        <NavLink to="/talent/leaderboard" onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy || undefined}>{t.boardNav}</NavLink>
      </nav>
      <div className="talent-account"><LanguageMenu />{!loginPage && <AccountControl leaderboardPath="/talent/leaderboard" leaderboardLabel={t.boardNav} />}</div>
    </header>
    <div id="talent-content" className="talent-content"><Outlet context={{ setBusy } satisfies TalentShellContext} /></div>
    <footer className="talent-footer"><p>{t.footerNote}</p><Link to={loginPage ? "/talent" : "/"} onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy || undefined}>{loginPage ? t.backToHall : t.home}<TalentArrow direction="up-right" /></Link></footer>
  </div>;
}
