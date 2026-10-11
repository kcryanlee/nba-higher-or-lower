import { useEffect, useRef, useState } from "react";
import { clearActiveRun, restoreScoredRun, writeActiveRun } from "../game/activeRun.js";
import { playBuzzer } from "../game/feedback.js";
import { SCORED_BEST_KEY } from "../game/scoredBadges.js";
import { positionCredit, selectScoredQuestion } from "../game/scored.js";
import { readStoredNumber, writeStorage } from "../game/storage.js";

function readBest() {
  return readStoredNumber(SCORED_BEST_KEY);
}

function togglePick(current, playerId) {
  const index = current.indexOf(playerId);
  if (index >= 0) return current.slice(0, index);
  if (current.length >= 3) return current;
  return [...current, playerId];
}

export function useScored({ onCorrect } = {}) {
  const restored = restoreScoredRun();
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState(restored?.phase ?? "idle");
  const [streak, setStreak] = useState(restored?.streak ?? 0);
  const [dealtStreak, setDealtStreak] = useState(restored?.dealtStreak ?? 0);
  const [question, setQuestion] = useState(restored?.question ?? null);
  const [usedKeys, setUsedKeys] = useState(restored?.usedKeys ?? []);
  const [picks, setPicks] = useState(restored?.picks ?? []);
  const [credit, setCredit] = useState(restored?.credit ?? null);
  const [result, setResult] = useState(restored?.result ?? null);
  const locked = useRef(restored?.phase === "revealing");
  const onCorrectRef = useRef(onCorrect);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  });

  useEffect(() => {
    if ((phase === "playing" || phase === "revealing") && question) {
      writeActiveRun({
        game: "scored",
        phase,
        streak,
        dealtStreak,
        picks,
        credit,
        result,
        gameId: question.gameId,
        playerIds: question.players.map((player) => player.id),
        key: question.key,
        usedKeys,
      });
      return;
    }
    if (phase === "idle" || phase === "gameover") clearActiveRun("scored");
  }, [phase, streak, dealtStreak, question, picks, credit, result, usedKeys]);

  function deal(nextStreak, keys) {
    const next = selectScoredQuestion(nextStreak, { usedKeys: keys });
    if (!next) {
      setPhase("gameover");
      return;
    }
    setUsedKeys(keys.includes(next.key) ? keys : [...keys, next.key]);
    setDealtStreak(nextStreak);
    setQuestion(next);
    setPicks([]);
    setCredit(null);
    setResult(null);
    locked.current = false;
    setPhase("playing");
  }

  function start() {
    locked.current = false;
    const next = selectScoredQuestion(0, { usedKeys: [] });
    setStreak(0);
    setDealtStreak(0);
    setPicks([]);
    setCredit(null);
    setResult(null);
    if (!next) {
      setQuestion(null);
      setUsedKeys([]);
      setPhase("idle");
      return false;
    }
    setUsedKeys([next.key]);
    setQuestion(next);
    setPhase("playing");
    return true;
  }

  function discard() {
    locked.current = false;
    setStreak(0);
    setDealtStreak(0);
    setQuestion(null);
    setUsedKeys([]);
    setPicks([]);
    setCredit(null);
    setResult(null);
    setPhase("idle");
  }

  function pick(playerId) {
    if (locked.current || phase !== "playing" || !question) return;
    if (!question.players.some((player) => player.id === playerId)) return;
    setPicks((current) => togglePick(current, playerId));
  }

  function lock() {
    if (locked.current || phase !== "playing" || !question || picks.length !== 3) return;
    if (new Set(picks).size !== 3) return;
    locked.current = true;
    const gained = positionCredit(question.ranking, picks);
    const nextStreak = streak + gained;

    if (gained > 0) {
      setStreak(nextStreak);
      if (nextStreak > best) {
        setBest(nextStreak);
        writeStorage(SCORED_BEST_KEY, String(nextStreak));
      }
      try {
        onCorrectRef.current?.(nextStreak);
      } catch {
        // Badge persistence must not block the reveal.
      }
    } else {
      playBuzzer();
    }

    setCredit(gained);
    setResult(gained > 0 ? "placed" : "miss");
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;
    if (result === "placed") {
      deal(streak, usedKeys);
      return;
    }
    setPhase("gameover");
  }

  return {
    phase,
    streak,
    best,
    question,
    picks,
    credit,
    result,
    start,
    pick,
    lock,
    advance,
    discard,
  };
}
