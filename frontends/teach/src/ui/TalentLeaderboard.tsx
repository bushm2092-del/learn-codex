import type { TalentCopy } from "../i18n/talent";
import type { TalentRank } from "../talent/types";
import { UserAvatar } from "./UserAvatar";

export function TalentLeaderboard({ t, items, ownID, unit, loading, error, onReload }: { t: TalentCopy; items: TalentRank[]; ownID: number; unit: string; loading: boolean; error: boolean; onReload: () => void }) {
  return <section className="talent-board" aria-label={t.leaderboard}>
    <div className="talent-board__heading"><p>{t.rankingNote}</p><button className="talent-button" disabled={loading} onClick={onReload}>{t.reload}</button></div>
    {loading ? <p className="talent-board__state" role="status">{t.loading}</p> : error ? <p className="talent-board__state" role="alert">{t.leaderboardError}</p> : !items.length ? <p className="talent-board__state">{t.empty}</p> : <table className="talent-board__table"><thead><tr><th scope="col">{t.rank}</th><th scope="col">{t.player}</th><th scope="col">{t.score}</th></tr></thead><tbody>{items.map(row => <tr key={row.user_id} data-own={row.user_id === ownID}><td>{row.rank}</td><td><div className="talent-board__player"><UserAvatar name={row.login} src={row.avatar_url} /><strong>{row.login}</strong>{row.user_id === ownID && <small>{t.you}</small>}</div></td><td><strong>{row.score}</strong> <small>{unit}</small></td></tr>)}</tbody></table>}
  </section>;
}
