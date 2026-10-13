import { useEffect, useMemo, useRef, useState } from "react";
import { accuracyFor, formatDailyDate, todayKey } from "../game/daily.js";
import { playBuzzer } from "../game/feedback.js";
import { positionCredit } from "../game/scored.js";
import {
  SCORED_DAILY_QUESTIONS,
  SCORED_DAILY_TOTAL,
  continueScoredDaily,
  noteScoredDailyAnswer,
  readScoredDailyRecord,
  scoredDailyBest,
  scoredDailyRunStatus,
  scoredDailyStreak,
  writeScoredDailyRecord,
} from "../game/scoredDailyRecord.js";

function questionReady(question) {
  return Boolean(question)
    && Array.isArray(question.players)
    && question.players.length === 3
    && new Set(question.players.map((player) => player.id)).size === 3
    && new Set(question.players.map((player) => player.pts)).size === 3
    && Array.isArray(question.ranking)
    && question.ranking.length === 3;
}

function setReady(questions) {
  return Array.isArray(questions)
    && questions.length === SCORED_DAILY_QUESTIONS
    && questions.every((question) => questionReady(question));
}

function togglePick(current, playerId) {
  const index = current.indexOf(playerId);
  if (index >= 0) return current.slice(0, index);
  if (current.length >= 3) return current;
  return [...current, playerId];
}

export function useScoredDaily({ storageKey, questionsFor, onComplete } = {}) {
  const today = todayKey();
  const [record, setRecord] = useState(() => readScoredDailyRecord(storageKey));
  const [phase, setPhase] = useState("idle");
  const [puzzleDate, setPuzzleDate] = useState(today);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picks, setPicks] = useState([]);
  const [credit, setCredit] = useState(null);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [practice, setPractice] = useState(false);
  const date = phase === "playing" || phase === "revealing" ? puzzleDate : today;
  const onCompleteRef = useRef(onComplete);
  const recordRef = useRef(record);
  const picksRef = useRef(picks);
  const locked = useRef(false);
  const practiceRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  useEffect(() => {
    picksRef.current = picks;
  }, [picks]);

  const questions = useMemo(() => {
    try {
      const built = questionsFor?.(date);
      return setReady(built) ? built : null;
    } catch {
      return null;
    }
  }, [date, questionsFor]);

  const available = Array.isArray(questions) && questions.length === SCORED_DAILY_QUESTIONS;
  const official = record.days[today] ?? null;
  const active = !official && record.active?.date === today ? record.active : null;

  function present(saved, runDate, source = null) {
    const day = saved.days[runDate];
    const correct = source?.correct ?? day?.correct;
    const total = source?.total ?? day?.total;
    if (correct == null || !total) return null;
    return {
      date: runDate,
      dateLabel: formatDailyDate(runDate),
      correct,
      total,
      accuracy: accuracyFor(correct, total),
      streak: scoredDailyStreak(saved, runDate),
      bestCorrect: scoredDailyBest(saved),
      bestTotal: SCORED_DAILY_TOTAL,
      practice: Boolean(source?.practice),
      officialCorrect: day?.correct ?? correct,
      officialTotal: day?.total ?? total,
    };
  }

  function finish(saved, runDate) {
    const nextAttempt = present(saved, runDate);
    if (!nextAttempt) return;
    setAttempt(nextAttempt);
    setPhase("results");
    try {
      onCompleteRef.current?.(saved, runDate);
    } catch {
      // Badge persistence must not block the results.
    }
  }

  function start(nextPractice = false) {
    if (!available) return;
    const runDate = todayKey();
    const saved = recordRef.current;
    locked.current = false;
    setPuzzleDate(runDate);
    setPicks([]);
    setCredit(null);
    setResult(null);
    if (!nextPractice && saved.days[runDate]) {
      practiceRef.current = false;
      setPractice(false);
      finish(saved, runDate);
      return;
    }
    const run = !nextPractice && saved.active?.date === runDate ? saved.active : null;
    const revealing = Boolean(run && run.phase === "revealing" && Array.isArray(run.picks));
    locked.current = revealing;
    practiceRef.current = Boolean(nextPractice);
    setPractice(Boolean(nextPractice));
    setIndex(run ? run.index : 0);
    setCorrectCount(run ? run.correct : 0);
    setPicks(revealing ? run.picks : []);
    setCredit(revealing ? run.credit : null);
    setResult(revealing ? run.result : null);
    setAttempt(null);
    setPhase(revealing ? "revealing" : "playing");
  }

  function leave() {
    locked.current = false;
    practiceRef.current = false;
    setPractice(false);
    setPicks([]);
    setCredit(null);
    setResult(null);
    setPhase("idle");
  }

  function pick(playerId) {
    if (locked.current || phase !== "playing") return;
    const question = questions?.[index];
    if (!questionReady(question) || !question.players.some((player) => player.id === playerId)) return;
    setPicks((current) => togglePick(current, playerId));
  }

  function lock() {
    if (locked.current || phase !== "playing") return;
    const question = questions?.[index];
    const chosen = picksRef.current;
    if (!questionReady(question) || chosen.length !== 3) return;
    locked.current = true;

    const gained = positionCredit(question.ranking, chosen);
    const nextCorrect = correctCount + gained;

    if (practiceRef.current) {
      if (gained === 0) playBuzzer();
      setCorrectCount(nextCorrect);
      setCredit(gained);
      setResult(gained > 0 ? "placed" : "miss");
      setPhase("revealing");
      return;
    }

    let noted = null;
    try {
      noted = noteScoredDailyAnswer(recordRef.current, {
        date,
        index,
        correct: nextCorrect,
        total: SCORED_DAILY_TOTAL,
        picks: chosen,
        credit: gained,
        result: gained > 0 ? "placed" : "miss",
      });
    } catch {
      noted = null;
    }

    if (!noted?.accepted) {
      locked.current = false;
      return;
    }

    recordRef.current = noted.record;
    setRecord(noted.record);
    writeScoredDailyRecord(storageKey, noted.record);
    if (gained === 0) playBuzzer();
    setCorrectCount(nextCorrect);
    setCredit(gained);
    setResult(gained > 0 ? "placed" : "miss");
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;

    if (practiceRef.current) {
      if (index + 1 < SCORED_DAILY_QUESTIONS) {
        setIndex((current) => current + 1);
        setPicks([]);
        setCredit(null);
        setResult(null);
        setPhase("playing");
        return;
      }
      setAttempt(present(recordRef.current, date, {
        correct: correctCount,
        total: SCORED_DAILY_TOTAL,
        practice: true,
      }));
      setPhase("results");
      return;
    }

    const stepped = continueScoredDaily(recordRef.current);
    if (!stepped.advanced) {
      locked.current = true;
      return;
    }
    const saved = stepped.record;
    recordRef.current = saved;
    setRecord(saved);
    writeScoredDailyRecord(storageKey, saved);

    if (!stepped.finished) {
      setIndex(saved.active.index);
      setCorrectCount(saved.active.correct);
      setPicks([]);
      setCredit(null);
      setResult(null);
      setPhase("playing");
      return;
    }
    finish(saved, date);
  }

  return {
    phase,
    index,
    total: SCORED_DAILY_QUESTIONS,
    correctCount,
    question: questions?.[index] ?? null,
    picks,
    credit,
    result,
    attempt,
    practice,
    available,
    official,
    active,
    status: scoredDailyRunStatus(record, today, available),
    streak: scoredDailyStreak(record, today),
    differentDays: record.completedDates.length,
    bestCorrect: scoredDailyBest(record),
    completions: record.completedDates.length,
    record,
    start,
    pick,
    lock,
    advance,
    leave,
  };
}
