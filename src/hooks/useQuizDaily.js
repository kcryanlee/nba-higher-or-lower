import { useEffect, useMemo, useRef, useState } from "react";
import { accuracyFor, formatDailyDate, todayKey } from "../game/daily.js";
import { playBuzzer } from "../game/feedback.js";
import {
  activeQuizStreak,
  continueQuiz,
  noteQuizAnswer,
  QUIZ_DAILY_LENGTH,
  quizBestCorrect,
  quizRunStatus,
  readQuizDailyRecord,
  writeQuizDailyRecord,
} from "../game/quizDaily.js";

function questionReady(question, choiceCount, accepts, openAnswer) {
  if (openAnswer) return Boolean(question) && typeof question.answer === "string" && question.answer.length > 0;
  const listed = Boolean(question)
    && Array.isArray(question.choices)
    && question.choices.length === choiceCount
    && new Set(question.choices).size === choiceCount;
  if (!listed) return false;
  if (typeof accepts === "function") return question.choices.some((choice) => accepts(question, choice) === true);
  return question.choices.includes(question.answer);
}

function setReady(questions, choiceCount, accepts, openAnswer) {
  return Array.isArray(questions)
    && questions.length === QUIZ_DAILY_LENGTH
    && questions.every((question) => questionReady(question, choiceCount, accepts, openAnswer));
}

export function useQuizDaily({ storageKey, questionsFor, onComplete, choiceCount = 4, accepts, openAnswer = false } = {}) {
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
  const acceptsRef = useRef(accepts);
  const openAnswerRef = useRef(openAnswer);
  const recordRef = useRef(record);
  const locked = useRef(false);
  const practiceRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    acceptsRef.current = accepts;
    openAnswerRef.current = openAnswer;
  });

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const questions = useMemo(() => {
    try {
      const built = questionsFor?.(date);
      return setReady(built, choiceCount, accepts, openAnswer) ? built : null;
    } catch {
      return null;
    }
  }, [date, questionsFor, choiceCount, accepts, openAnswer]);

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
    const revealing = Boolean(run && run.phase === "revealing");
    locked.current = revealing;
    practiceRef.current = Boolean(nextPractice);
    setPractice(Boolean(nextPractice));
    setIndex(run ? run.index : 0);
    setCorrectCount(run ? run.correct : 0);
    setChoice(revealing ? run.choice : null);
    setResult(revealing ? run.result : null);
    setAttempt(null);
    setPhase(revealing ? "revealing" : "playing");
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
    if (!questionReady(question, choiceCount, acceptsRef.current, openAnswerRef.current)) return;
    if (openAnswerRef.current) {
      if (typeof nextChoice !== "string" || !nextChoice.trim()) return;
    } else if (!question.choices.includes(nextChoice)) return;
    locked.current = true;

    const correct = typeof acceptsRef.current === "function"
      ? acceptsRef.current(question, nextChoice) === true
      : nextChoice === question.answer;
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
        choice: nextChoice,
        result: correct ? "correct" : "wrong",
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

    if (practiceRef.current) {
      if (index + 1 < QUIZ_DAILY_LENGTH) {
        setIndex((current) => current + 1);
        setChoice(null);
        setResult(null);
        setPhase("playing");
        return;
      }
      setAttempt(present(recordRef.current, date, {
        correct: correctCount,
        total: QUIZ_DAILY_LENGTH,
        practice: true,
      }));
      setPhase("results");
      return;
    }

    const stepped = continueQuiz(recordRef.current);
    if (!stepped.advanced) {
      locked.current = true;
      return;
    }
    const saved = stepped.record;
    recordRef.current = saved;
    setRecord(saved);
    writeQuizDailyRecord(storageKey, saved);

    if (!stepped.finished) {
      setIndex(saved.active.index);
      setCorrectCount(saved.active.correct);
      setChoice(null);
      setResult(null);
      setPhase("playing");
      return;
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
