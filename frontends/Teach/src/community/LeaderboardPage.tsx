import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import type { Ranking } from "../api/client";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import { useResource } from "./useResource";
import "../ui/Community.css";
export function LeaderboardPage() {
  const { user, status } = useAuth();
  const { locale } = useLocale();
  if (status === "loading") return <main className="community-page" role="status">{community[locale].loading}</main>;
  if (!user) return <Navigate to="/login?next=%2Fleaderboard" replace />;
  return <Leaderboard />;
}
function Leaderboard() {
  const { locale } = useLocale(); const t = community[locale]; const { data, loading, error, reload } = useResource<{ items: Ranking[] }>("/leaderboard");
  return <main className="community-page"><Link to="/">{t.home}</Link><h1>{t.leaderboard}</h1><p>{t.rankingNote}</p>
    {loading ? <p role="status">{t.loading}</p> : error ? <p role="alert">{t.offline} <button onClick={() => void reload()}>{t.retry}</button></p> : !data?.items.length ? <p>{t.noRank}</p> : <table className="ranking-table"><thead><tr><th>{t.rank}</th><th>{t.learner}</th><th>{t.chapters}</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.user_id}><td>{row.rank}</td><td>{row.login}</td><td>{row.chapters}</td></tr>)}</tbody></table>}
  </main>;
}
