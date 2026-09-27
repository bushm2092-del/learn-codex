import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import type { Ranking } from "../api/client";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import { useResource } from "./useResource";
import "../ui/Community.css";
import "../ui/Leaderboard.css";
import { UserAvatar } from "../ui/UserAvatar";
export function LeaderboardPage() {
  const { user, status } = useAuth();
  const { locale } = useLocale();
  if (status === "loading") return <main className="community-page" role="status">{community[locale].loading}</main>;
  if (!user) return <Navigate to="/login?next=%2Fleaderboard" replace />;
  return <Leaderboard />;
}
function Leaderboard() {
  const { locale } = useLocale(); const t = community[locale]; const { data, loading, error, reload } = useResource<{ items: Ranking[] }>("/leaderboard");
  const { user } = useAuth();
  const own = data?.items.find(row => row.user_id === user?.id);
  return <main className="community-page leaderboard-page">
    <Link className="leaderboard-back" to="/"><span aria-hidden="true">←</span>{t.home}</Link>
    <header className="leaderboard-heading"><div><h1>{t.leaderboard}</h1><p>{t.rankingNote}</p></div></header>
    {!loading && !error && <div className="leaderboard-personal">
      <div className="leaderboard-identity"><UserAvatar name={user!.login} src={user!.avatar_url} /><div><strong>{user!.login}</strong><p>{own ? `${t.yourRank} #${own.rank} · ${t.chapters}: ${own.chapters}` : t.notRanked}</p></div></div>
      <Link className="community-button community-button--primary" to="/lessons/agent-loop">{t.continueLearning}<span aria-hidden="true"> →</span></Link>
    </div>}
    {loading ? <p className="leaderboard-state" role="status">{t.loading}</p> : error ? <div className="leaderboard-state" role="alert"><p>{t.offline}</p><button className="community-button" onClick={() => void reload()}>{t.retry}</button></div> : !data?.items.length ? <p className="leaderboard-state">{t.noRank}</p> : <table className="ranking-table leaderboard-table"><caption>{t.rankingList}</caption><thead><tr><th scope="col">{t.rank}</th><th scope="col">{t.learner}</th><th scope="col">{t.chapters}</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.user_id} className={row.user_id === user?.id ? "leaderboard-table__self" : undefined}><td><span className={`leaderboard-rank ${row.rank <= 3 ? "leaderboard-rank--top" : ""}`}>{row.rank}</span></td><td><div className="leaderboard-identity"><UserAvatar name={row.login} src={row.avatar_url} /><strong>{row.login}</strong>{row.user_id === user?.id && <span className="leaderboard-you">{t.own}</span>}</div></td><td><strong className="leaderboard-count">{row.chapters}</strong></td></tr>)}</tbody></table>}
  </main>;
}
