import { useEffect, useRef, useState } from "react";
import { clearActiveRun, restoreCareerRun, restoreParkedCareerRun, writeActiveRun } from "../game/activeRun.js";
import { CAREER_BEST_KEY } from "../game/careerBadges.js";
import { selectCareerQuestion } from "../game/careerPath.js";
import { playerNamesMatch } from "../game/playerSearch.js";
import { playBuzzer } from "../game/feedback.js";
import { readStoredNumber, writeStorage } from "../game/storage.js";

function readBest() {
  return readStoredNumber(CAREER_BEST_KEY);
}

export function useCareer({ onCorrect } = {}) {
  const restored = restoreCareerRun();
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState(restored?.phase ?? "idle");
  const [streak, setStreak] = useState(restored?.streak ?? 0);
  const [question, setQuestion] = useState(restored?.question ?? null);
  const [usedIds, setUsedIds] = useState(restored?.usedIds ?? []);
  const [usedKeys, setUsedKeys] = useState(restored?.usedKeys ?? []);
  const [picked, setPicked] = useState(restored?.picked ?? null);
  const [result, setResult] = useState(restored?.result ?? null);
  const locked = useRef(restored?.phase === "revealing");
  const owned = useRef(Boolean(restored));
  const onCorrectRef = useRef(onCorrect);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  });

  useEffect(() => {
    if ((phase === "playing" || phase === "revealing") && question) {
      owned.current = true;
      writeActiveRun({
        game: "career",
        phase,
        streak,
        picked,
        result,
        question,
        usedIds,
        usedKeys,
      });
      return;
    }
    if (owned.current && (phase === "idle" || phase === "gameover")) {
      clearActiveRun("career");
      owned.current = false;
    }
  }, [phase, streak, question, picked, result, usedIds, usedKeys]);

  function deal(nextStreak, ids, keys) {
    const next = selectCareerQuestion(nextStreak, { usedIds: ids, usedKeys: keys });
    if (!next) {
      setPhase("gameover");
      return;
    }
    setUsedIds(ids.includes(next.answerId) ? ids : [...ids, next.answerId]);
    setUsedKeys(keys.includes(next.key) ? keys : [...keys, next.key]);
    setQuestion(next);
    setPicked(null);
    setResult(null);
    locked.current = false;
    setPhase("playing");
  }

  function start() {
    locked.current = false;
    const next = selectCareerQuestion(0, { usedIds: [], usedKeys: [] });
    setStreak(0);
    setPicked(null);
    setResult(null);
    if (!next) {
      setQuestion(null);
      setUsedIds([]);
      setUsedKeys([]);
      setPhase("idle");
      return;
    }
    setUsedIds([next.answerId]);
    setUsedKeys([next.key]);
    setQuestion(next);
    setPhase("playing");
  }

  function resume() {
    if (phase === "playing" || phase === "revealing") return true;
    const parked = restoreParkedCareerRun();
    if (!parked) {
      start();
      return true;
    }
    locked.current = parked.phase === "revealing";
    owned.current = true;
    setPhase(parked.phase);
    setStreak(parked.streak);
    setQuestion(parked.question);
    setUsedIds(parked.usedIds);
    setUsedKeys(parked.usedKeys);
    setPicked(parked.picked);
    setResult(parked.result);
    return true;
  }

  function discard() {
    locked.current = false;
    setStreak(0);
    setQuestion(null);
    setUsedIds([]);
    setUsedKeys([]);
    setPicked(null);
    setResult(null);
    setPhase("idle");
  }

  function pick(name) {
    if (locked.current || phase !== "playing" || !question) return;
    if (typeof name !== "string" || !name.trim()) return;
    locked.current = true;
    const correct = playerNamesMatch(question.player, name);
    const nextStreak = correct ? streak + 1 : streak;

    if (correct) {
      setStreak(nextStreak);
      if (nextStreak > best) {
        setBest(nextStreak);
        writeStorage(CAREER_BEST_KEY, String(nextStreak));
      }
      try {
        onCorrectRef.current?.(nextStreak);
      } catch {
        // Badge persistence must not block the reveal.
      }
    } else {
      playBuzzer();
    }

    setPicked(name);
    setResult(correct ? "correct" : "wrong");
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;
    if (result === "correct") {
      deal(streak, usedIds, usedKeys);
      return;
    }
    setPhase("gameover");
  }

  return { phase, streak, best, question, picked, result, start, resume, pick, advance, discard };
}
