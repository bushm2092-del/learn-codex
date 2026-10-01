import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/context";
import { useResource } from "../community/useResource";
import { talent } from "../i18n/talent";
import { useLocale } from "../i18n/useLocale";
import { TalentLeaderboard } from "../ui/TalentLeaderboard";
import { isTalentGame, talentGames } from "./types";
import type { TalentBoard, TalentGame } from "./types";

export function TalentLeaderboardPage() {
  const { locale } = useLocale();
  const { user, status, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get("game") ?? undefined;
  const game = isTalentGame(requested) ? requested : "reaction";
  const t = talent[locale];
  return <main className="talent-page talent-ranking-page">
    <h1>{t.leaderboard}</h1>
    <nav className="talent-board-tabs" aria-label={t.gamesLabel}>{talentGames.map(item => <button key={item} data-game={item} aria-pressed={item === game} onClick={() => setParams({ game: item })}>{t.games[item].name}</button>)}</nav>
    {status === "loading" ? <p role="status">{t.loading}</p> : status === "error" ? <div className="talent-board__state"><p role="alert">{t.startError}</p><button className="talent-button" onClick={() => void refresh()}>{t.reload}</button></div> : user ? <Board key={game} game={game} ownID={user.id} /> : <section className="talent-board-login"><p>{t.boardLogin}</p><Link className="talent-button" to={`/login?next=${encodeURIComponent(`/talent/leaderboard?game=${game}`)}`}>{t.loginToPlay}</Link></section>}
  </main>;
}

function Board({ game, ownID }: { game: TalentGame; ownID: number }) {
  const { locale } = useLocale(); const t = talent[locale];
  const board = useResource<TalentBoard>(`/talent/${game}/leaderboard`);
  const unit = game === "reaction" ? "ms" : game === "memory" ? t.levels : t.points;
  return <>
    <p className="talent-board-measure">{t.games[game].measure}</p>
    {board.data?.own && <p className="talent-own-rank">{t.personalBest} <strong>{board.data.own.score} {unit}</strong><span>{t.yourRank} #{board.data.own.rank}</span></p>}
    <TalentLeaderboard t={t} items={board.data?.items ?? []} ownID={ownID} unit={unit} loading={board.loading} error={board.error} onReload={() => void board.reload()} />
  </>;
}
