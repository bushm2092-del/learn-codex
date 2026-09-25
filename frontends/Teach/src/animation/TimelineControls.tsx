import type { LessonTimelineControls } from "./useLessonTimeline";
import { useLocale } from "../i18n/useLocale";

interface TimelineControlsProps {
  controls: LessonTimelineControls;
}

export function TimelineControls({ controls }: TimelineControlsProps) {
  const { copy } = useLocale();

  return (
    <div className="timeline-controls" aria-label={copy.controls.aria}>
      <button type="button" onClick={controls.play}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.25v9.5L12 8 4.5 3.25Z" /></svg>
        {copy.controls.play}
      </button>
      <button type="button" onClick={controls.pause}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3.5h3v9H4v-9Zm5 0h3v9H9v-9Z" /></svg>
        {copy.controls.pause}
      </button>
      <button type="button" onClick={controls.restart}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 4.5V1.75l-1.15 1.16A5.5 5.5 0 1 0 13.5 8h-1.4a4.1 4.1 0 1 1-1.24-2.93L9.5 6.42H13V4.5Z" /></svg>
        {copy.controls.restart}
      </button>
    </div>
  );
}
