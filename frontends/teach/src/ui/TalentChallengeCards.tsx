import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { TalentCopy } from "../i18n/talent";
import { talentGames } from "../talent/types";
import { TalentChallengeArt } from "./TalentChallengeArt";
import { TalentArrow } from "./TalentArrow";

function Arrow({ previous = false }: { previous?: boolean }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={previous ? "m12 4-6 6 6 6" : "m8 4 6 6-6 6"} /></svg>;
}

export function TalentChallengeCards({ t }: { t: TalentCopy }) {
  const [selected, setSelected] = useState(0);
  const [flipped, setFlipped] = useState(new Set<number>());
  const deck = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const flippedIndex = useRef<number | null>(null);
  const selectedRef = useRef(0); selectedRef.current = selected;

  function select(index: number, scroll = true, focus = false) {
    const next = Math.max(0, Math.min(talentGames.length - 1, index));
    setSelected(next);
    const card = cards.current[next], rail = deck.current;
    if (scroll && card && rail) rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    if (focus) card?.focus({ preventScroll: true });
  }
  function flip(index: number) {
    flippedIndex.current = index;
    setSelected(index);
    setFlipped(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  }
  useLayoutEffect(() => {
    const index = flippedIndex.current;
    if (index === null) return;
    cards.current[index]?.querySelector<HTMLButtonElement>(`.talent-card-${flipped.has(index) ? "back" : "front"} [data-flip]`)?.focus({ preventScroll: true });
  }, [flipped]);
  useEffect(() => {
    const rail = deck.current;
    if (!rail) return;
    const settle = () => {
      if (rail.scrollWidth <= rail.clientWidth + 1) return;
      const middle = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let nearest = selectedRef.current, distance = Infinity;
      cards.current.forEach((card, index) => { if (!card) return; const box = card.getBoundingClientRect(), gap = Math.abs(box.left + box.width / 2 - middle); if (gap < distance) { nearest = index; distance = gap; } });
      setSelected(nearest);
    };
    rail.addEventListener("scrollend", settle);
    return () => rail.removeEventListener("scrollend", settle);
  }, []);
  useLayoutEffect(() => {
    const rail = deck.current, card = cards.current[selectedRef.current];
    if (rail && card) rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: "instant" });
  }, [t]);

  return <section className="talent-deck-shell" aria-label={t.gamesLabel} onKeyDown={event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); select(selected + (event.key === "ArrowLeft" ? -1 : 1), true, true); }
      if (event.key === "Escape" && flipped.has(selected)) { event.preventDefault(); flip(selected); }
    }}>
      <div className="talent-deck" ref={deck}>{talentGames.map((game, index) => <article key={game} data-game={game} className={`talent-card${selected === index ? " talent-card--selected" : ""}${flipped.has(index) ? " talent-card--flipped" : ""}`} ref={element => { cards.current[index] = element; }} tabIndex={0} aria-label={t.games[game].name} onFocus={() => setSelected(index)} onClick={event => { if (!(event.target as HTMLElement).closest("a,button")) select(index, false); }}>
        <div className="talent-card-inner">
          <div className="talent-card-face talent-card-front" inert={flipped.has(index)} aria-hidden={flipped.has(index)}>
            <h2>{t.games[game].name}</h2><p className="talent-card-description">{t.cards[game].description}</p>
            <TalentChallengeArt game={game} t={t} />
            <div className="talent-card-tags">{t.cards[game].tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <div className="talent-card-actions"><Link className="talent-button" to={`/talent/${game}`}>{t.play}<TalentArrow /></Link><button className="talent-text-button" data-flip onClick={() => flip(index)}>{t.details}</button></div>
          </div>
          <div className="talent-card-face talent-card-back" inert={!flipped.has(index)} aria-hidden={!flipped.has(index)}>
            <h2>{t.games[game].name}</h2><p className="talent-card-rule">{t.games[game].rules}</p><p className="talent-card-measure">{t.games[game].measure}</p>
            <p className="talent-card-keys">{game === "reaction" ? t.reactionKeys : game === "memory" ? t.memoryHint : t.choiceHint}</p>
            <div className="talent-card-actions"><Link className="talent-button" to={`/talent/${game}`}>{t.play}<TalentArrow /></Link><button className="talent-text-button" data-flip onClick={() => flip(index)}>{t.closeDetails}</button></div>
          </div>
        </div>
      </article>)}</div>
      <button className="talent-deck-arrow talent-deck-arrow--prev" disabled={selected === 0} aria-label={t.previousChallenge} onClick={() => select(selected - 1, true, true)}><Arrow previous /></button>
      <button className="talent-deck-arrow talent-deck-arrow--next" disabled={selected === talentGames.length - 1} aria-label={t.nextChallenge} onClick={() => select(selected + 1, true, true)}><Arrow /></button>
    </section>;
}
