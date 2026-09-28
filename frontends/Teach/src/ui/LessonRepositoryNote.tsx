import { useLocale } from "../i18n/useLocale";
import { GitHubIcon } from "./GitHubIcon";
import "./LessonRepositoryNote.css";

export function LessonRepositoryNote() {
  const { copy } = useLocale();
  const t = copy.lessonFooter;

  return <footer className="lesson-repository-note">
    <p>{t.support} {t.updates}</p>
    <a href="https://github.com/bushm2092-del/mini-codex" target="_blank" rel="noopener noreferrer">
      <GitHubIcon />
      <span>{t.repository}</span>
      <svg className="lesson-repository-note__external" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 15 15 5M7 5h8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  </footer>;
}
