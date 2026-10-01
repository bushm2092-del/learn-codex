import type { TalentCopy } from "../i18n/talent";
import type { TalentGame } from "../talent/types";

export function TalentChallengeArt({ game, t }: { game: TalentGame; t: TalentCopy }) {
  return <div className={`talent-card-art talent-card-art--${game}`} aria-hidden="true">
    {game === "reaction" ? <svg viewBox="0 0 140 140" fill="none"><g stroke="#55ac76" strokeWidth="4" strokeLinecap="round"><path d="M70 9v12m0 98v12M9 70h12m98 0h12M27 27l8 8m70 70 8 8m0-86-8 8m-70 70-8 8" /></g><circle cx="70" cy="70" r="34" stroke="#68b888" strokeWidth="1.5" /><circle cx="70" cy="70" r="28" fill="#36a566" stroke="#287548" strokeWidth="1.5" /></svg>
    : game === "memory" ? <div className="talent-card-grid">{Array.from({ length: 9 }, (_, i) => <i key={i} data-lit={i === 0 || i === 8} />)}</div>
    : game === "reasoning" ? <div className="talent-card-sequence">{[2, 4, 8, "?"].map(value => <span key={value}>{value}</span>)}</div>
    : <div className="talent-card-color"><strong>{t.focusWord}</strong><div>{["red", "green", "blue", "yellow"].map(color => <i key={color} className={`talent-color-dot talent-color-dot--${color}`} />)}</div></div>}
  </div>;
}
