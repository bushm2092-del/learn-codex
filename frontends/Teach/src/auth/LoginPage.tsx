import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api, loginURL } from "../api/client";
import { useAuth } from "./context";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import "../ui/Community.css";

export function LoginPage() {
  const { locale } = useLocale();
  const t = community[locale];
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next");
  const destination = next === "/leaderboard" || next === "/lessons/agent-loop" ? next : "/";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"offline" | "unconfigured" | null>(null);
  if (user) return <Navigate to={destination} replace />;
  async function login() {
    setBusy(true); setError(null);
    try {
      const config = await api<{ github_enabled: boolean }>("/auth/config");
      if (!config.github_enabled) setError("unconfigured");
      else window.location.assign(loginURL);
    } catch { setError("offline"); }
    finally { setBusy(false); }
  }
  return <main className="community-page">
    <Link to="/">{t.home}</Link>
    <h1>{t.login}</h1>
    <p>{t.guestAccess}</p>
    <button className="community-button community-button--primary" disabled={busy} onClick={() => void login()}>{busy ? t.loading : t.login}</button>
    {error && <p role="alert">{t[error]}</p>}
  </main>;
}
