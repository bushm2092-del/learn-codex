import { UserAvatar } from "../ui/UserAvatar";
import type { User } from "../api/client";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";

export type Learners = { items: User[]; total: number };
export function ChapterLearners({ data, loading, error, onRetry }: { data?: Learners; loading: boolean; error: boolean; onRetry: () => void }) {
  const { locale } = useLocale(); const t = community[locale];
  return <div className="chapter-learners">
    <p className="chapter-learners__label">{t.learners}{data && !error ? `${locale === "zh" ? "：" : ": "}${data.total}` : ""}</p>
    {error ? <p>{t.learnersError} <button className="community-button" onClick={onRetry}>{t.retry}</button></p>
      : !data && loading ? <p role="status">{t.loading}</p>
      : !data?.total ? <p className="community-muted">{t.noLearners}</p>
      : <ul aria-label={t.learners}>{data.items.map(user => <li key={user.id} tabIndex={0} aria-label={user.login}>
          <UserAvatar name={user.login} src={user.avatar_url} /><span className="chapter-learners__name" aria-hidden="true">{user.login}</span>
        </li>)}{data.total > data.items.length && <li className="chapter-learners__more">+{data.total - data.items.length}</li>}</ul>}
  </div>;
}
