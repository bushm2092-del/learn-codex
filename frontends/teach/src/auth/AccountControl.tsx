import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "./context";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import "../ui/Community.css";
import { UserAvatar } from "../ui/UserAvatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../ui/DropdownMenu";
export function AccountControl({ leaderboardPath = "/leaderboard", leaderboardLabel }: { leaderboardPath?: string; leaderboardLabel?: string }) {
  const { locale } = useLocale(); const t = community[locale]; const { user, status, refresh } = useAuth();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<"offline" | "unconfigured" | null>(null);
  const location = useLocation();
  if (!user) return <Link className="community-button" to={location.pathname === "/login" ? location.pathname + location.search : `/login?next=${encodeURIComponent(location.pathname + location.search)}`}>{t.signIn}</Link>;
  async function act() {
    setBusy(true); setError(null);
    try {
      if (user) { await api("/auth/logout", { method: "POST" }); await refresh(); }
    } catch { setError("offline"); } finally { setBusy(false); }
  }
  return <div className="account-control">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="account-control__trigger" aria-label={`${t.accountMenu}: ${user.login}`} disabled={busy}>
          <UserAvatar name={user.login} src={user.avatar_url} />
          <span className="account-control__name">{user.login}</span>
          <svg className="account-control__chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="account-control__menu">
        <div className="account-control__identity">{user.login}</div>
        <DropdownMenuItem asChild><Link to={leaderboardPath}>{leaderboardLabel ?? t.leaderboard}</Link></DropdownMenuItem>
        <DropdownMenuItem disabled={busy || status === "loading"} onSelect={() => void act()}>{busy ? t.loading : t.logout}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {error && <span className="account-control__error" role="status">{t[error]}</span>}
  </div>;
}
