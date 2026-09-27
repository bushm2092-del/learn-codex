import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "./context";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import "../ui/Community.css";
export function AccountControl() {
  const { locale } = useLocale(); const t = community[locale]; const { user, status, refresh } = useAuth();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<"offline" | "unconfigured" | null>(null);
  const location = useLocation();
  if (!user) return <Link className="community-button" to={`/login?next=${encodeURIComponent(location.pathname)}`}>{t.login}</Link>;
  async function act() {
    setBusy(true); setError(null);
    try {
      if (user) { await api("/auth/logout", { method: "POST" }); await refresh(); }
    } catch { setError("offline"); } finally { setBusy(false); }
  }
  return <div className="account-control">
    {user && <span className="account-control__name" title={user.login}>{user.login}</span>}
    <button className="community-button" disabled={busy || status === "loading"} onClick={() => status === "error" ? void refresh() : void act()}>{busy || status === "loading" ? t.loading : status === "error" ? t.retry : user ? t.logout : t.login}</button>
    {error && <span role="status">{t[error]}</span>}
  </div>;
}
