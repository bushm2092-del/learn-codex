import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type CheckIn, type Comment } from "../api/client";
import { useAuth } from "../auth/context";
import { AccountControl } from "../auth/AccountControl";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import { useResource } from "./useResource";
import "../ui/Community.css";
import { CompletionCelebration } from "../ui/CompletionCelebration";
import { ChapterLearners, type Learners } from "./ChapterLearners";

export function ChapterCommunity({ chapter }: { chapter: string }) {
  const { user } = useAuth();
  return <ChapterDiscussion key={`${chapter}:${user?.id ?? "guest"}`} chapter={chapter} />;
}
function ChapterDiscussion({ chapter }: { chapter: string }) {
  const { locale } = useLocale(); const t = community[locale]; const { user, status, refresh } = useAuth();
  const comments = useResource<{ items: Comment[]; next_cursor: number }>(user ? `/chapters/${chapter}/comments` : null);
  const progress = useResource<{ items: CheckIn[] }>(user ? "/me/check-ins" : null);
  const learners = useResource<Learners>(`/chapters/${chapter}/learners`);
  const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const finishCelebration = useCallback(() => setCelebration(false), []);
  const [message, setMessage] = useState<keyof typeof t | null>(null); const [deleting, setDeleting] = useState<number | null>(null);
  const checked = progress.data?.items.some((item) => item.chapter_id === chapter);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage(null);
    try { await action(); } catch (error) {
      if (error instanceof ApiError && error.status === 401) { setMessage("expired"); await refresh(); }
      else setMessage(error instanceof ApiError && error.status === 429 ? "rateLimit" : "offline");
    } finally { setBusy(false); }
  }
  return <section className="chapter-community" aria-label={t.comments}>
    <div className="chapter-checkin"><div><h2>{t.checkTitle}</h2><p>{t.checkNote}</p></div>
      {user && <div className="checkin-control">
        {checked && <span className="checkin-control__done"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>{t.checked}</span>}
        <button className={`community-button ${checked ? "" : "community-button--primary"}`} disabled={busy || progress.loading || progress.error} onClick={() => void perform(async () => {
          const result = await api<{ created: boolean } | undefined>(`/chapters/${chapter}/check-in`, { method: checked ? "DELETE" : "PUT" });
          progress.setData((old) => ({ items: checked ? (old?.items ?? []).filter(item => item.chapter_id !== chapter) : [...(old?.items ?? []).filter(item => item.chapter_id !== chapter), { chapter_id: chapter, created_at: new Date().toISOString() }] }));
          setCelebration(!checked && !!result?.created); setMessage(checked ? "checkUndone" : "checkSuccess");
          await learners.reload();
        })}>{busy || progress.loading ? t.loading : checked ? t.undoCheck : t.check}</button>
      </div>}
    </div>
    {celebration && <CompletionCelebration message={t.checkSuccess} onFinish={finishCelebration} />}
    <ChapterLearners data={learners.data} loading={learners.loading} error={learners.error} onRetry={() => void learners.reload()} />
    {user && progress.error && <p role="alert">{t.progressError} <button onClick={() => void progress.reload()}>{t.retry}</button></p>}
    {!user && <div className="community-login"><p>{t.loginHint}</p><AccountControl /></div>}
    <Link to="/leaderboard">{t.leaderboard}</Link>
    <h2>{t.comments}</h2>
    {!user && <Link className="community-button" to={`/login?next=${encodeURIComponent("/lessons/" + chapter)}`}>{t.loginHint}</Link>}
    {user && status === "ready" && <form onSubmit={(event) => {
      event.preventDefault(); if (!body.trim() || [...body.trim()].length > 2000) { setMessage("invalid"); return; }
      void perform(async () => { const comment = await api<Comment>(`/chapters/${chapter}/comments`, { method: "POST", body: JSON.stringify({ body }) });
        comments.setData((old) => ({ items: [comment, ...(old?.items ?? [])], next_cursor: old?.next_cursor ?? 0 })); setBody(""); setMessage("posted");
      });
    }}>
      <label htmlFor={`comment-${chapter}`}>{t.bodyLabel}</label>
      <textarea id={`comment-${chapter}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.placeholder} rows={4} disabled={busy} required />
      <div className="comment-actions"><span>{[...body].length} / 2000 {t.count}</span><button className="community-button community-button--primary" disabled={busy || comments.loading || comments.error || !body.trim() || [...body.trim()].length > 2000}>{busy ? t.posting : t.post}</button></div>
    </form>}
    {message && <p role="status">{t[message]}</p>}
    {!user ? null : comments.loading ? <p role="status">{t.loading}</p> : comments.error ? <p role="alert">{t.offline} <button onClick={() => void comments.reload()}>{t.retry}</button></p> : !comments.data?.items.length ? <p className="community-muted">{t.empty}</p> : <ol className="comment-list">{comments.data.items.map((comment) => <li key={comment.id}>
      <div className="comment-meta"><strong>{comment.user_id === user?.id ? `${user.login} · ${t.own}` : `${t.user} #${comment.user_id}`}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</time></div>
      <p>{comment.body}</p>
      {comment.user_id === user?.id && (deleting === comment.id ? <div className="comment-actions"><button disabled={busy} onClick={() => void perform(async () => { await api(`/comments/${comment.id}`, { method: "DELETE" }); comments.setData((old) => old && ({ ...old, items: old.items.filter((item) => item.id !== comment.id) })); setDeleting(null); setMessage("removed"); })}>{t.confirm}</button><button disabled={busy} onClick={() => setDeleting(null)}>{t.cancel}</button></div> : <button disabled={busy} onClick={() => setDeleting(comment.id)}>{t.remove}</button>)}
    </li>)}</ol>}
    {!!comments.data?.next_cursor && <button className="community-button" disabled={busy} onClick={() => void perform(async () => {
      const next = await api<{ items: Comment[]; next_cursor: number }>(`/chapters/${chapter}/comments?before=${comments.data!.next_cursor}`);
      comments.setData((old) => ({ items: [...(old?.items ?? []), ...next.items.filter((row) => !old?.items.some((item) => item.id === row.id))], next_cursor: next.next_cursor }));
    })}>{busy ? t.loading : t.more}</button>}
  </section>;
}
