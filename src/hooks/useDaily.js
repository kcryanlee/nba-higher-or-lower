import { useEffect, useMemo, useRef, useState } from "react";
import {
  BAND_POINTS,
  DAILY_LENGTH,
  accuracyFor,
  activeDailyStreak,
  buildDaily,
  dailyRunStatus,
  formatDailyDate,
  monthCompletionCount,
  noteOfficialAnswer,
  readDailyRecord,
  todayKey,
  writeDailyRecord,
} from "../game/daily.js";
import { BANDS, higherBandId } from "../game/difficulty.js";
import { playBuzzer } from "../game/feedback.js";
import { outcomeFor } from "../game/outcome.js";

export function useDaily(players, { onAnswer, onOfficial } = {}) {
  const today = todayKey();
  const [record, setRecord] = useState(readDailyRecord);
  const [phase, setPhase] = useState("idle");
  const [puzzleDate, setPuzzleDate] = useState(today);
  const [practice, setPractice] = useState(false);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [highestId, setHighestId] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const date = phase === "playing" || phase === "revealing" ? puzzleDate : today;
  const questions = useMemo(() => buildDaily(players, date), [players, date]);
  const available = Array.isArray(questions) && questions.length === DAILY_LENGTH;
  const recordRef = useRef(record);
  const locked = useRef(false);
  const practiceRef = useRef(false);
  const onAnswerRef = useRef(onAnswer);
  const onOfficialRef = useRef(onOfficial);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  useEffect(() => {
    onAnswerRef.current = onAnswer;
    onOfficialRef.current = onOfficial;
  });

  const official = record.days[date] ?? null;
  const active = !official && record.active?.date === date ? record.active : null;

  function present(source, saved, isPractice) {
    const savedOfficial = saved.days[date];
    return {
      date,
      dateLabel: formatDailyDate(date),
      correct: source.correct,
      total: source.total,
      accuracy: accuracyFor(source.correct, source.total),
      score: source.score,
      difficulty: source.difficulty,
      dailyStreak: activeDailyStreak(saved, date),
      bestCorrect: saved.bestCorrect,
      bestTotal: saved.bestTotal,
      practice: isPractice,
      officialCorrect: savedOfficial?.correct ?? source.correct,
      officialTotal: savedOfficial?.total ?? source.total,
    };
  }

  function reportOfficial(saved) {
    try {
      onOfficialRef.current?.({
        dailyStreak: activeDailyStreak(saved, date),
        monthCount: monthCompletionCount(saved, date),
      });
    } catch {
      // Badge persistence must not block the results.
    }
  }

  function showOfficial() {
    const saved = recordRef.current;
    const day = saved.days[todayKey()];
    if (!day) return;
    const runDate = todayKey();
    locked.current = false;
    practiceRef.current = false;
    setPuzzleDate(runDate);
    setPractice(false);
    setAttempt({
      date: runDate,
      dateLabel: formatDailyDate(runDate),
      correct: day.correct,
      total: day.total,
      accuracy: accuracyFor(day.correct, day.total),
      score: day.score,
      difficulty: day.difficulty,
      dailyStreak: activeDailyStreak(saved, runDate),
      bestCorrect: saved.bestCorrect,
      bestTotal: saved.bestTotal,
      practice: false,
      officialCorrect: day.correct,
      officialTotal: day.total,
    });
    setPhase("results");
    try {
      onOfficialRef.current?.({
        dailyStreak: activeDailyStreak(saved, runDate),
        monthCount: monthCompletionCount(saved, runDate),
      });
    } catch {
      // Badge persistence must not block the results.
    }
  }

  function start(nextPractice) {
    if (!available) return;
    const runDate = todayKey();
    const saved = recordRef.current;
    if (!nextPractice && saved.days[runDate]) {
      showOfficial();
      return;
    }

    const run = !nextPractice && saved.active?.date === runDate ? saved.active : null;
    locked.current = false;
    practiceRef.current = Boolean(nextPractice);
    setPuzzleDate(runDate);
    setPractice(Boolean(nextPractice));
    setIndex(run ? run.index : 0);
    setCorrectCount(run ? run.correct : 0);
    setScore(run ? run.score : 0);
    setHighestId(run ? run.highestId : null);
    setPickedId(null);
    setResult(null);
    setAttempt(null);
    setPhase("playing");
  }

  function leave() {
    locked.current = false;
    setPickedId(null);
    setResult(null);
    setPhase("idle");
  }

  function pick(playerId) {
    if (locked.current || phase !== "playing") return;
    const matchup = questions?.[index];
    if (!matchup) return;
    locked.current = true;

    const { category, left, right } = matchup;
    const pickedValue = playerId === left.id ? left[category.id] : right[category.id];
    const otherValue = playerId === left.id ? right[category.id] : left[category.id];
    const outcome = outcomeFor(pickedValue, otherValue);
    const nextCorrect = outcome === "correct" ? correctCount + 1 : correctCount;
    const nextScore = outcome === "correct" ? score + BAND_POINTS[matchup.band.id] : score;
    const nextHighest = outcome === "correct" ? higherBandId(highestId, matchup.band.id) : highestId;
    const playingPractice = practiceRef.current;
    let accepted = playingPractice;

    if (!playingPractice) {
      try {
        const noted = noteOfficialAnswer(recordRef.current, {
          date,
          index,
          correct: nextCorrect,
          score: nextScore,
          highestId: nextHighest,
          total: questions.length,
          difficulty: nextHighest ? BANDS[nextHighest].label : "None",
        });
        accepted = noted.accepted;
        if (accepted) {
          recordRef.current = noted.record;
          setRecord(noted.record);
          writeDailyRecord(noted.record);
          try {
            onAnswerRef.current?.({
              correct: outcome === "correct",
              categoryId: category.id,
              bandId: matchup.band.id,
              dailyKey: `${date}:${index}`,
            });
          } catch {
            // Badge persistence must not block the reveal.
          }
        }
      } catch {
        accepted = true;
      }
    }

    if (!accepted) {
      locked.current = false;
      return;
    }

    if (outcome === "wrong") playBuzzer();
    if (outcome === "correct") {
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      setHighestId(nextHighest);
    }
    setPickedId(playerId);
    setResult(outcome === "push" ? "push" : outcome);
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;

    if (index + 1 < (questions?.length ?? 0)) {
      setIndex((current) => current + 1);
      setPickedId(null);
      setResult(null);
      setPhase("playing");
      return;
    }

    const finished = {
      correct: correctCount,
      total: questions?.length ?? DAILY_LENGTH,
      score,
      difficulty: highestId ? BANDS[highestId].label : "None",
    };

    if (practiceRef.current) {
      setAttempt(present(finished, recordRef.current, true));
      setPhase("results");
      return;
    }

    const saved = recordRef.current.days[date]
      ? recordRef.current
      : {
          ...noteOfficialAnswer(recordRef.current, {
            date,
            index,
            correct: correctCount,
            score,
            highestId,
            total: questions.length,
            difficulty: finished.difficulty,
          }).record,
          active: null,
        };
    if (!recordRef.current.days[date]) {
      recordRef.current = saved;
      setRecord(saved);
      writeDailyRecord(saved);
    }

    const day = saved.days[date] ?? finished;
    setAttempt(present(day, saved, false));
    setPhase("results");
    reportOfficial(saved);
  }

  return {
    phase,
    practice,
    index,
    total: questions?.length ?? 0,
    correctCount,
    matchup: questions?.[index] ?? null,
    pickedId,
    result,
    attempt,
    available,
    official,
    active,
    status: available ? dailyRunStatus(record, date) : "unavailable",
    dailyStreak: activeDailyStreak(record, date),
    monthCount: monthCompletionCount(record, date),
    start,
    showOfficial,
    pick,
    advance,
    leave,
  };
}
