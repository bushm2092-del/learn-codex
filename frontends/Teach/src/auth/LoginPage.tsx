import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api, ApiError, loginURL } from "../api/client";
import { useAuth } from "./context";
import { useLocale } from "../i18n/useLocale";
import { community } from "../i18n/community";
import "../ui/AuthPage.css";

export function LoginPage() {
  const { locale } = useLocale();
  const t = community[locale];
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next");
  const destination = next === "/leaderboard" || next === "/lessons/agent-loop" ? next : "/";
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof t | null>(null);
  if (user) return <Navigate to={destination} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (register && password !== confirmation) { setError("mismatch"); return; }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username.trim()) || [...password].length < 12 || new TextEncoder().encode(password).length > 72) { setError("invalidAccount"); return; }
    setBusy(true);
    try {
      await api(register ? "/auth/register" : "/auth/login", { method: "POST", body: JSON.stringify({ username: username.trim(), password }) });
      setPassword(""); setConfirmation(""); await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.status === 401 ? "credentials" : e.status === 409 ? "usernameTaken" : e.status === 429 ? "rateLimit" : e.status === 400 ? "invalidAccount" : "offline" : "offline");
    } finally { setBusy(false); }
  }
  async function github() {
    setBusy(true); setError(null);
    try {
      const config = await api<{ github_enabled: boolean }>("/auth/config");
      if (!config.github_enabled) setError("unconfigured");
      else window.location.assign(loginURL);
    } catch { setError("offline"); }
    finally { setBusy(false); }
  }
  return <main className="auth-page">
    <header className="auth-page__heading"><h1>{register ? t.createAccount : t.welcome}</h1><p>{t.accountNote}</p></header>
    <div className="auth-page__modes" role="group" aria-label={t.signIn + " / " + t.register}>
      {[false, true].map((mode) => <button key={String(mode)} type="button" aria-pressed={register === mode} disabled={busy} onClick={() => { setRegister(mode); setError(null); setPassword(""); setConfirmation(""); }}>{mode ? t.register : t.signIn}</button>)}
    </div>
    <form className="auth-page__form" onSubmit={(event) => void submit(event)}>
      <label htmlFor="username">{t.username}</label>
      <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" aria-describedby="username-hint" disabled={busy} />
      <p id="username-hint" className="auth-page__hint">{t.usernameHint}</p>
      <div className="auth-page__password-label"><label htmlFor="password">{t.password}</label><button type="button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? t.hidePassword : t.showPassword}</button></div>
      <input id="password" name="password" type={show ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} aria-describedby="password-hint" disabled={busy} />
      <p id="password-hint" className="auth-page__hint">{t.passwordHint}</p>
      {register && <><label htmlFor="confirmation">{t.confirmPassword}</label><input id="confirmation" name="confirmation" type={show ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required disabled={busy} /></>}
      {error && <p className="auth-page__error" role="alert">{t[error]}</p>}
      <button className="auth-page__submit" disabled={busy}>{busy ? t.loading : register ? t.submitRegister : t.submitLogin}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
    </form>
    <div className="auth-page__divider">{t.alternate}</div>
    <button type="button" className="auth-page__github" disabled={busy} onClick={() => void github()}>{t.login}</button>
    <p className="auth-page__guest">{t.guestAccess}</p>
    <Link className="auth-page__browse" to="/">{t.browse}</Link>
  </main>;
}
