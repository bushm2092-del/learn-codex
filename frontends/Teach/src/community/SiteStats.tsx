import { community } from "../i18n/community";
import { useLocale } from "../i18n/useLocale";
import { useResource } from "./useResource";
import { useEffect } from "react";
import { Link } from "react-router-dom";
export function SiteStats() {
  const { locale } = useLocale(); const t = community[locale];
  const { data, reload } = useResource<{ pv: number; uv: number }>("/analytics/stats");
  useEffect(() => { const update = () => { void reload(); }; window.addEventListener("learn-view-recorded", update); return () => window.removeEventListener("learn-view-recorded", update); }, [reload]);
  return <footer className="site-stats"><Link to="/leaderboard">{t.leaderboard}</Link>{data && <><span>{t.stats} · {t.visits} {data.pv.toLocaleString()} · {t.visitors} {data.uv.toLocaleString()}</span><small>{t.privacy}</small></>}</footer>;
}
