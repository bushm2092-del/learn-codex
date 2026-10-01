import { useEffect, useRef, useState } from "react";
import type { TalentCopy } from "../i18n/talent";
import type { TalentSubmission } from "./types";

export function MemoryTest({ t, sequence, onFinish }: { t: TalentCopy; sequence: number[]; onFinish: (submission: TalentSubmission, score: number) => void }) {
  const [level, setLevel] = useState(1);
  const [lit, setLit] = useState<number | null>(null);
  const [watching, setWatching] = useState(true);
  const [position, setPosition] = useState(0);
  const answers = useRef<number[]>([]);
  const positionRef = useRef(0);
  const inputEnabled = useRef(false);
  const lastClick = useRef(0);
  const grid = useRef<HTMLDivElement>(null);
  const selectRef = useRef<(cell: number) => void>(() => {});
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    inputEnabled.current = false; positionRef.current = 0; setPosition(0); setWatching(true); setLit(null);
    function flash() {
      setLit(sequence[step]);
      timer = setTimeout(() => {
        setLit(null); step++;
        if (step < level) timer = setTimeout(flash, 200);
        else timer = setTimeout(() => { setWatching(false); inputEnabled.current = true; grid.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); }, 350);
      }, 500);
    }
    timer = setTimeout(flash, 700);
    return () => clearTimeout(timer);
  }, [level, sequence]);
  function select(cell: number) {
    if (!inputEnabled.current || performance.now() - lastClick.current < 100) return;
    lastClick.current = performance.now();
    answers.current.push(cell);
    if (cell !== sequence[positionRef.current]) { inputEnabled.current = false; onFinish({ answers: answers.current }, level - 1); return; }
    positionRef.current++; setPosition(positionRef.current);
    if (positionRef.current === level) {
      inputEnabled.current = false;
      if (level === sequence.length) onFinish({ answers: answers.current }, level);
      else setLevel(value => value + 1);
    }
  }
  selectRef.current = select;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (/^[1-9]$/.test(event.key) && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); selectRef.current(Number(event.key) - 1); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  return <div className="talent-memory">
    <div className="talent-game-bar"><strong>{t.level} {level}</strong><span>{watching ? t.watch : `${t.repeat} · ${position}/${level}`}</span></div>
    <div ref={grid} className="talent-memory__grid" role="group" aria-label={watching ? t.watch : t.repeat}>{Array.from({ length: 9 }, (_, i) => <button type="button" key={i} disabled={watching} className={lit === i ? "talent-memory__cell talent-memory__cell--lit" : "talent-memory__cell"} aria-label={`${t.cell} ${i + 1}`} onClick={() => select(i)} onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) select(i); } }}><span>{i + 1}</span></button>)}</div>
    <p className="talent-key-hint">{t.memoryHint}</p>
  </div>;
}
