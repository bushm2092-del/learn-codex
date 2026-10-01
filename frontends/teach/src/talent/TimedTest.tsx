import { useEffect, useRef, useState } from "react";
import type { TalentCopy } from "../i18n/talent";
import type { TalentQuestion, TalentSubmission } from "./types";
import { nextSequenceNumber, timedScore } from "./logic";

export function TimedTest({ t, game, questions, onFinish }: { t: TalentCopy; game: "reasoning" | "focus"; questions: TalentQuestion[]; onFinish: (submission: TalentSubmission, score: number) => void }) {
  const [remaining, setRemaining] = useState(60);
  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState({ correct: 0, wrong: 0 });
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const startedAt = useRef(performance.now());
  const answers = useRef<number[]>([]);
  const countsRef = useRef({ correct: 0, wrong: 0 });
  const ended = useRef(false);
  const lastClick = useRef(0);
  const selectRef = useRef<(choice: number) => void>(() => {});
  const choicesRef = useRef<HTMLDivElement>(null);
  function finish() { if (ended.current) return; ended.current = true; onFinish({ answers: answers.current }, timedScore(countsRef.current.correct, countsRef.current.wrong)); }
  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil(60 - (performance.now() - startedAt.current) / 1000));
      setRemaining(left); if (!left) finish();
    }, 100);
    choicesRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => clearInterval(timer);
    // 开始时间和题目生命周期绑定，切换语言不重置挑战。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function select(choice: number) {
    if (ended.current || performance.now() - lastClick.current < 120) return;
    if (performance.now() - startedAt.current >= 60000) { finish(); return; }
    lastClick.current = performance.now();
    const question = questions[answers.current.length];
    const correct = game === "focus" ? choice === (question.ink ?? 0) : question.choices?.[choice] === nextSequenceNumber(question.numbers!);
    answers.current.push(choice);
    countsRef.current = { correct: countsRef.current.correct + Number(correct), wrong: countsRef.current.wrong + Number(!correct) };
    setCounts(countsRef.current); setFeedback(correct ? "correct" : "wrong"); setIndex(answers.current.length);
    if (answers.current.length === questions.length) finish();
  }
  selectRef.current = select;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (/^[1-4]$/.test(event.key) && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); selectRef.current(Number(event.key) - 1); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  const question = questions[Math.min(index, questions.length - 1)];
  return <div className="talent-timed">
    <div className="talent-game-bar"><strong><span className="talent-remaining-label">{t.remaining} </span><span className="talent-timer">{remaining}</span> {t.seconds}</strong><span>{t.correct} {counts.correct} · {t.wrong} {counts.wrong}</span></div>
    <div className="talent-question"><p>{game === "focus" ? t.inkPrompt : t.sequencePrompt}</p>{game === "focus" ? <strong className={`talent-ink talent-ink--${question.ink ?? 0}`}>{t.colors[question.word ?? 0]}</strong> : <div className="talent-sequence">{question.numbers!.map((number, i) => <span key={i}>{number}</span>)}<strong>?</strong></div>}</div>
    <div ref={choicesRef} className="talent-choices">{Array.from({ length: 4 }, (_, choice) => <button type="button" key={choice} onClick={() => select(choice)} onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) select(choice); } }}><kbd>{choice + 1}</kbd><strong>{game === "focus" ? t.colors[choice] : question.choices![choice]}</strong></button>)}</div>
    <p className={`talent-feedback talent-feedback--${feedback ?? "none"}`} role="status">{feedback ? feedback === "correct" ? t.feedbackCorrect : t.feedbackWrong : t.choiceHint}</p>
  </div>;
}
