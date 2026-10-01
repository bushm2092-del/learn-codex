import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useOutletContext, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/context";
import { useResource } from "../community/useResource";
import { useLocale } from "../i18n/useLocale";
import { talent } from "../i18n/talent";
import { TalentChallengeArt } from "../ui/TalentChallengeArt";
import { TalentArrow } from "../ui/TalentArrow";
import type { TalentShellContext } from "../ui/TalentShell";
import { ReactionTest } from "./ReactionTest";
import { MemoryTest } from "./MemoryTest";
import { TimedTest } from "./TimedTest";
import { isTalentGame } from "./types";
import type { TalentAttempt, TalentBoard, TalentGame, TalentResult, TalentSubmission } from "./types";
import "../ui/TalentTests.css";

export function TalentPage() {
  const { game } = useParams();
  const { user, status, refresh } = useAuth();
  const { locale } = useLocale();
  const location = useLocation();
  const t = talent[locale];
  if (!isTalentGame(game)) return <Navigate to="/talent" replace />;
  if (status === "loading") return <main className="talent-page" role="status">{t.loading}</main>;
  if (status === "error") return <main className="talent-page"><p role="alert">{t.startError}</p><button className="talent-button" onClick={() => void refresh()}>{t.reload}</button></main>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <TalentPanel key={game} game={game} />;
}

function TalentPanel({ game }: { game: TalentGame }) {
  const { setBusy } = useOutletContext<TalentShellContext>();
  const { locale } = useLocale();
  const t = talent[locale];
  const info = t.games[game];
  const board = useResource<TalentBoard>(`/talent/${game}/leaderboard`);
  const [attempt, setAttempt] = useState<TalentAttempt | null>(null);
  const [starting, setStarting] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [startError, setStartError] = useState(false);
  const [submission, setSubmission] = useState<TalentSubmission | null>(null);
  const [localScore, setLocalScore] = useState(0);
  const [result, setResult] = useState<TalentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<"offline" | "expired" | "session" | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const submitted = useRef(false);
  const retrying = useRef(false);
  const reload = useRef(board.reload); reload.current = board.reload;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  const running = !!attempt && !submission && !interrupted;
  useEffect(() => { setBusy(running || starting || saving); return () => setBusy(false); }, [running, starting, saving, setBusy]);
  useEffect(() => {
    if (!running) return;
    const interrupt = () => { setInterrupted(true); };
    const visibility = () => { if (document.hidden) interrupt(); };
    window.addEventListener("blur", interrupt); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", interrupt); document.removeEventListener("visibilitychange", visibility); };
  }, [running]);

  async function start() {
    const version = ++generation.current;
    setStarting(true); setStartError(false); setInterrupted(false); setSubmission(null); setResult(null); setSaveError(null); setAttempt(null); submitted.current = false;
    try {
      const data = await api<TalentAttempt>(`/talent/${game}/attempts`, { method: "POST", body: "{}" });
      if (mounted.current && version === generation.current) setAttempt(data);
    } catch (error) {
      if (mounted.current && version === generation.current) {
        if (error instanceof ApiError && error.status === 401) setSaveError("session");
        else setStartError(true);
      }
    } finally { if (mounted.current && version === generation.current) setStarting(false); }
  }

  const save = useCallback(async (id: string, payload: TalentSubmission) => {
    if (retrying.current) return; retrying.current = true;
    const version = generation.current;
    setSaving(true); setSaveError(null);
    try {
      const data = await api<TalentResult>(`/talent/${game}/attempts/${id}/result`, { method: "POST", body: JSON.stringify(payload) });
      if (mounted.current && version === generation.current) { setResult(data); void reload.current(); }
    } catch (error) {
      if (mounted.current && version === generation.current) setSaveError(error instanceof ApiError && error.status === 401 ? "session" : error instanceof ApiError && error.status === 410 ? "expired" : "offline");
    } finally { retrying.current = false; if (mounted.current && version === generation.current) setSaving(false); }
  }, [game]);

  const finish = useCallback((payload: TalentSubmission, score: number) => {
    if (submitted.current || !attempt) return;
    submitted.current = true; setSubmission(payload); setLocalScore(score); void save(attempt.id, payload);
  }, [attempt, save]);

  const scoreLabel = (score: number) => `${score} ${game === "reaction" ? "ms" : game === "memory" ? t.levels : t.points}`;
  const label = game === "reaction" ? t.average : info.measure;
  return <main className="talent-page talent-game-page" data-game={game}>
    <header className="talent-workspace-heading"><Link className="talent-back" to="/talent" onClick={event => { if (running || starting || saving) event.preventDefault(); }} aria-disabled={running || starting ||saving || undefined}><TalentArrow direction="left" />{t.backToHall}</Link><h1>{info.name}</h1></header>
    <div className="talent-layout">
      <section className="talent-play" aria-label={info.name}>
        {starting ? <div className="talent-stage talent-state" role="status"><p>{t.loading}</p></div> : interrupted ? <div className="talent-stage talent-state"><h2>{info.name}</h2><p role="status">{t.interrupted}</p><button className="talent-button talent-button--primary" onClick={() => void start()}>{t.restart}</button></div> : submission ? <div className="talent-stage talent-result">
          <h2>{game === "memory" ? localScore === 20 ? t.complete : t.memoryFail : t.finish}</h2><strong className="talent-result__score">{scoreLabel(result?.score ?? localScore)}</strong><p>{label}</p>
          {result && (game === "reasoning" || game === "focus") && <p>{t.correct} {result.correct} · {t.wrong} {result.wrong}</p>}
          <p className="talent-result__save" role={saveError ? "alert" : "status"}>{saving ? t.saving : saveError === "expired" ? t.expired : saveError === "session" ? t.sessionExpired : saveError ? t.saveError : t.saved}</p>
          <div className="talent-result__actions">{saveError === "offline" && <button className="talent-button talent-button--primary" onClick={() => void save(attempt!.id, submission)}>{t.retry}</button>}{saveError === "session" && <a className="talent-button" href={`/login?next=${encodeURIComponent(`/talent/${game}`)}`}>{t.signIn}</a>}<button className="talent-button" disabled={saving} onClick={() => void start()}>{t.again}</button></div>
        </div> : attempt ? <div className={`talent-stage talent-stage--${game}`}>
          {game === "reaction" ? <ReactionTest t={t} onFinish={finish} /> : game === "memory" ? <MemoryTest t={t} sequence={attempt.challenge.sequence!} onFinish={finish} /> : <TimedTest t={t} game={game} questions={attempt.challenge.questions!} onFinish={finish} />}
        </div> : <div className="talent-stage talent-intro">
          <TalentChallengeArt game={game} t={t} />
          <h2>{game === "reaction" ? t.reactionTitle : info.name}</h2><p>{game === "reaction" ? t.reactionHint : info.subtitle}</p>
          {(startError || saveError === "session") && <p role="alert">{saveError === "session" ? t.sessionExpired : t.startError}</p>}
          {saveError === "session" ? <a className="talent-button" href={`/login?next=${encodeURIComponent(`/talent/${game}`)}`}>{t.signIn}</a> : <button className="talent-button talent-button--primary" onClick={() => void start()}>{t.start}</button>}
        </div>}
        {running && <button className="talent-end" onClick={() => { generation.current++; setAttempt(null); }}>{t.cancel}</button>}
      </section>
      <aside className="talent-aside">
        <section><h2>{t.rules}</h2><p>{info.rules}</p><small>{info.measure}</small></section>
        <section>
          <h2>{t.personalBest}</h2>
          {board.data?.own ? <><strong className="talent-best">{scoreLabel(board.data.own.score)}</strong><p>{t.yourRank} #{board.data.own.rank}</p></> : <>
            {!board.loading && !board.error && board.data && <strong className="talent-best" aria-hidden="true">—</strong>}
            <p>{board.loading ? t.loading : board.error ? t.leaderboardError : t.noBest}</p>
          </>}
          <Link className="talent-text-button" to={`/talent/leaderboard?game=${game}`} onClick={event => { if (running || starting || saving) event.preventDefault(); }} aria-disabled={running || starting || saving || undefined}>{t.viewLeaderboard}<TalentArrow direction="up-right" /></Link>
        </section>
      </aside>
    </div>
  </main>;
}
