import { useState } from "react";
import { bandForStreak } from "../game/difficulty.js";
import { playBuzzer } from "../game/feedback.js";
import { selectMatchup } from "../game/selectMatchup.js";

const BEST_KEY = "nba-hol-best";

function readBest() {
  const stored = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export function useGame(players, { onAnswer } = {}) {
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState("start");
  const [streak, setStreak] = useState(0);
  const [matchup, setMatchup] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [result, setResult] = useState(null);

  function deal(nextStreak, previousKey) {
    setMatchup(selectMatchup(players, nextStreak, previousKey));
    setPickedId(null);
    setResult(null);
    setPhase("playing");
  }

  function start() {
    setStreak(0);
    deal(0, null);
  }

  function pick(playerId) {
    if (phase !== "playing" || !matchup) return;

    const { category, left, right } = matchup;
    const pickedValue = playerId === left.id ? left[category.id] : right[category.id];
    const otherValue = playerId === left.id ? right[category.id] : left[category.id];
    const correct = pickedValue >= otherValue;

    setPickedId(playerId);

    if (correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      const nextBest = Math.max(best, nextStreak);
      if (nextStreak > best) {
        localStorage.setItem(BEST_KEY, String(nextBest));
        setBest(nextBest);
      }
      onAnswer?.({
        correct: true,
        best: nextBest,
        categoryId: category.id,
        bandId: matchup.band.id,
      });
      setResult("correct");
      setPhase("revealing");
      return;
    }

    playBuzzer();
    setResult("wrong");
    setPhase("revealing");
  }

  function advance() {
    if (result === "correct" && matchup) {
      deal(streak, matchup.key);
      return;
    }
    setPhase("gameover");
  }

  return {
    phase,
    streak,
    best,
    difficulty: bandForStreak(streak).label,
    matchup,
    pickedId,
    result,
    start,
    pick,
    advance,
  };
}
