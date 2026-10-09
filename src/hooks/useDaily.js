import { useMemo, useState } from "react";
import {
  BAND_POINTS,
  accuracyFor,
  activeDailyStreak,
  buildDaily,
  commitOfficialResult,
  formatDailyDate,
  monthCompletionCount,
  readDailyRecord,
  todayKey,
  writeDailyRecord,
} from "../game/daily.js";
import { BANDS, higherBandId } from "../game/difficulty.js";
import { playBuzzer } from "../game/feedback.js";

export function useDaily(players, { onAnswer, onOfficial } = {}) {
  const date = todayKey();
  const questions = useMemo(() => buildDaily(players, date), [players, date]);
  const [record, setRecord] = useState(readDailyRecord);
  const [phase, setPhase] = useState("idle");
  const [practice, setPractice] = useState(false);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [highestId, setHighestId] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);

  function present(source, saved, isPractice) {
    const official = saved.days[date];
    return {
      date,
      dateLabel: formatDailyDate(date),
      correct: source.correct,
      total: source.total,
      accuracy: accuracyFor(source.correct, source.total),
      score: source.score,
      difficulty: source.difficulty,
      ranking: "Unranked",
      dailyStreak: activeDailyStreak(saved, date),
      bestCorrect: saved.bestCorrect,
      bestTotal: saved.bestTotal,
      practice: isPractice,
      officialCorrect: official?.correct ?? source.correct,
      officialTotal: official?.total ?? source.total,
    };
  }

  function start(nextPractice) {
    if (!nextPractice && record.days[date]) {
      showOfficial();
      return;
    }
    setPractice(nextPractice);
    setIndex(0);
    setCorrectCount(0);
    setScore(0);
    setHighestId(null);
    setPickedId(null);
    setResult(null);
    setAttempt(null);
    setPhase("playing");
  }

  function showOfficial() {
    const official = record.days[date];
    if (!official) return;
    setPractice(false);
    setAttempt(present(official, record, false));
    setPhase("results");
  }

  function pick(playerId) {
    if (phase !== "playing") return;
    const matchup = questions[index];
    const { category, left, right } = matchup;
    const pickedValue = playerId === left.id ? left[category.id] : right[category.id];
    const otherValue = playerId === left.id ? right[category.id] : left[category.id];
    const correct = pickedValue >= otherValue;

    setPickedId(playerId);
    if (!correct) playBuzzer();
    setResult(correct ? "correct" : "wrong");

    if (correct) {
      setCorrectCount((count) => count + 1);
      setScore((current) => current + BAND_POINTS[matchup.band.id]);
      setHighestId((current) => higherBandId(current, matchup.band.id));
    }

    if (!practice) {
      onAnswer?.({
        correct,
        categoryId: category.id,
        bandId: matchup.band.id,
      });
    }

    setPhase("revealing");
  }

  function advance() {
    if (index + 1 < questions.length) {
      setIndex((current) => current + 1);
      setPickedId(null);
      setResult(null);
      setPhase("playing");
      return;
    }

    const finished = {
      correct: correctCount,
      total: questions.length,
      score,
      difficulty: highestId ? BANDS[highestId].label : "None",
    };

    if (practice) {
      setAttempt(present(finished, record, true));
      setPhase("results");
      return;
    }

    const next = commitOfficialResult(record, { ...finished, date });
    writeDailyRecord(next);
    setRecord(next);
    setAttempt(present(finished, next, false));
    onOfficial?.({
      dailyStreak: next.streak,
      monthCount: monthCompletionCount(next, date),
    });
    setPhase("results");
  }

  return {
    phase,
    practice,
    index,
    total: questions.length,
    correctCount,
    matchup: questions[index] ?? null,
    pickedId,
    result,
    attempt,
    official: record.days[date] ?? null,
    dailyStreak: activeDailyStreak(record, date),
    monthCount: monthCompletionCount(record, date),
    start,
    showOfficial,
    pick,
    advance,
  };
}
