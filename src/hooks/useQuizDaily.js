import { useEffect, useMemo, useRef, useState } from "react";
import { accuracyFor, formatDailyDate, todayKey } from "../game/daily.js";
import { playBuzzer } from "../game/feedback.js";
import {
  activeQuizStreak,
  noteQuizAnswer,
  QUIZ_DAILY_LENGTH,
  quizBestCorrect,
  quizRunStatus,
  readQuizDailyRecord,
  writeQuizDailyRecord,
} from "../game/quizDaily.js";

function questionReady(question) {
  return Boolean(question)
    && Array.isArray(question.choices)
    && question.choices.length === 4
    && new Set(question.choices).size === 4
    && question.choices.includes(question.answer);
}

function setReady(questions) {
  return Array.isArray(questions)
    && questions.length === QUIZ_DAILY_LENGTH
    && questions.every(questionReady);
}

export function useQuizDaily({ storageKey, questionsFor, onComplete } = {}) {
  const today = todayKey();
  const [record, setRecord] = useState(() => readQuizDailyRecord(storageKey));
  const [phase, setPhase] = useState("idle");
  const [puzzleDate, setPuzzleDate] = useState(today);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [choice, setChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [practice, setPractice] = useState(false);
  const date = phase === "playing" || phase === "revealing" ? puzzleDate : today;
  const onCompleteRef = useRef(onComplete);
  const recordRef = useRef(record);
  const locked = useRef(false);
  const practiceRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const questions = useMemo(() => {
    try {
      const built = questionsFor?.(date);
      return setReady(built) ? built : null;
    } catch {
      return null;
    }
  }, [date, questionsFor]);

  const available = Array.isArray(questions) && questions.length === QUIZ_DAILY_LENGTH;
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
      streak: activeQuizStreak(saved, runDate),
      bestCorrect: quizBestCorrect(saved),
      bestTotal: QUIZ_DAILY_LENGTH,
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
    setChoice(null);
    setResult(null);
    if (!nextPractice && saved.days[runDate]) {
      practiceRef.current = false;
      setPractice(false);
      finish(saved, runDate);
      return;
    }
    const run = !nextPractice && saved.active?.date === runDate ? saved.active : null;
    practiceRef.current = Boolean(nextPractice);
    setPractice(Boolean(nextPractice));
    setIndex(run ? run.index : 0);
    setCorrectCount(run ? run.correct : 0);
    setAttempt(null);
    setPhase("playing");
  }

  function leave() {
    locked.current = false;
    practiceRef.current = false;
    setPractice(false);
    setChoice(null);
    setResult(null);
    setPhase("idle");
  }

  function pick(nextChoice) {
    if (locked.current || phase !== "playing") return;
    const question = questions?.[index];
    if (!questionReady(question) || !question.choices.includes(nextChoice)) return;
    locked.current = true;

    const correct = nextChoice === question.answer;
    const nextCorrect = correct ? correctCount + 1 : correctCount;

    if (practiceRef.current) {
      if (!correct) playBuzzer();
      if (correct) setCorrectCount(nextCorrect);
      setChoice(nextChoice);
      setResult(correct ? "correct" : "wrong");
      setPhase("revealing");
      return;
    }

    let noted = null;
    try {
      noted = noteQuizAnswer(recordRef.current, {
        date,
        index,
        correct: nextCorrect,
        total: QUIZ_DAILY_LENGTH,
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
    writeQuizDailyRecord(storageKey, noted.record);
    if (!correct) playBuzzer();
    if (correct) setCorrectCount(nextCorrect);
    setChoice(nextChoice);
    setResult(correct ? "correct" : "wrong");
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;

    if (index + 1 < QUIZ_DAILY_LENGTH) {
      setIndex((current) => current + 1);
      setChoice(null);
      setResult(null);
      setPhase("playing");
      return;
    }

    if (practiceRef.current) {
      const saved = recordRef.current;
      setAttempt(present(saved, date, {
        correct: correctCount,
        total: QUIZ_DAILY_LENGTH,
        practice: true,
      }));
      setPhase("results");
      return;
    }

    let saved = recordRef.current;
    if (!saved.days[date]) {
      const noted = noteQuizAnswer(saved, {
        date,
        index,
        correct: correctCount,
        total: QUIZ_DAILY_LENGTH,
      });
      saved = noted.record;
      recordRef.current = saved;
      setRecord(saved);
      writeQuizDailyRecord(storageKey, saved);
    }
    finish(saved, date);
  }

  return {
    phase,
    index,
    total: QUIZ_DAILY_LENGTH,
    correctCount,
    question: questions?.[index] ?? null,
    choice,
    result,
    attempt,
    practice,
    available,
    official,
    active,
    status: quizRunStatus(record, today, available),
    streak: activeQuizStreak(record, today),
    differentDays: record.completedDates.length,
    bestCorrect: quizBestCorrect(record),
    completions: record.completedDates.length,
    record,
    start,
    pick,
    advance,
    leave,
  };
}
