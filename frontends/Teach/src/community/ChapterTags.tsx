import { useEffect } from "react";
import { useResource } from "./useResource";
import { useLocale } from "../i18n/useLocale";
import type { LessonStatus } from "../course/types";
import "../ui/ChapterTags.css";

export function ChapterTags({ chapter, status }: { chapter: string; status: LessonStatus }) {
  const { copy, locale } = useLocale();
  const { data, error, reload } = useResource<{ pv: number; uv: number }>(status === "planned" ? null : `/chapters/${chapter}/stats`);
  useEffect(() => {
    const update = () => { void reload(); };
    window.addEventListener("learn-view-recorded", update);
    return () => window.removeEventListener("learn-view-recorded", update);
  }, [reload]);
  return <span className="chapter-tags">
    <span>{status === "ready" ? copy.home.ready : status === "draft" ? copy.home.draft : copy.home.planned}</span>
    {data && !error && <span>{locale === "zh" ? `阅读 ${data.pv.toLocaleString()} 次` : `${data.pv.toLocaleString()} views`}</span>}
  </span>;
}
