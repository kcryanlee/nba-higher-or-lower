import { useEffect, useRef, useState } from "react";
import { bandForStreak } from "../game/difficulty.js";
import { playBuzzer } from "../game/feedback.js";
import { outcomeFor } from "../game/outcome.js";
import { selectMatchup } from "../game/selectMatchup.js";
import { readStoredNumber, writeStorage } from "../game/storage.js";

const BEST_KEY = "nba-hol-best";

function readBest() {
  return readStoredNumber(BEST_KEY);
}

export function useGame(players, { onAnswer } = {}) {
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState("start");
  const [streak, setStreak] = useState(0);
  const [matchup, setMatchup] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [result, setResult] = useState(null);
  const locked = useRef(false);
  const onAnswerRef = useRef(onAnswer);

  useEffect(() => {
    onAnswerRef.current = onAnswer;
  });

  function deal(nextStreak, previousKey) {
    const next = selectMatchup(players, nextStreak, previousKey);
    setMatchup(next);
    setPickedId(null);
    setResult(null);
    locked.current = false;
    setPhase(next ? "playing" : "gameover");
  }

  function start() {
    setStreak(0);
    deal(0, null);
  }

  function discard() {
    locked.current = false;
    setStreak(0);
    setMatchup(null);
    setPickedId(null);
    setResult(null);
    setPhase("start");
  }

  function pick(playerId) {
    if (locked.current || phase !== "playing" || !matchup) return;
    locked.current = true;

    const { category, left, right } = matchup;
    const pickedValue = playerId === left.id ? left[category.id] : right[category.id];
    const otherValue = playerId === left.id ? right[category.id] : left[category.id];
    const outcome = outcomeFor(pickedValue, otherValue);
    const nextStreak = outcome === "correct" ? streak + 1 : streak;
    const nextBest = Math.max(best, nextStreak);

    if (outcome === "correct") {
      setStreak(nextStreak);
      if (nextStreak > best) {
        setBest(nextBest);
        writeStorage(BEST_KEY, String(nextBest));
      }
      try {
        onAnswerRef.current?.({
          correct: true,
          best: nextBest,
          categoryId: category.id,
          bandId: matchup.band.id,
        });
      } catch {
        // Badge persistence must not block the reveal.
      }
    } else if (outcome === "wrong") {
      playBuzzer();
    }

    setPickedId(playerId);
    setResult(outcome === "push" ? "push" : outcome);
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;
    if ((result === "correct" || result === "push") && matchup) {
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
    discard,
  };
}
