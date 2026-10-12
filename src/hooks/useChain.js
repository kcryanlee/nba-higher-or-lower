import { useEffect, useRef, useState } from "react";
import { clearActiveRun, restoreChainRun, restoreParkedChainRun, writeActiveRun } from "../game/activeRun.js";
import { CHAIN_BEST_KEY } from "../game/chainBadges.js";
import { gradeChainChoice, selectChainQuestion } from "../game/chain.js";
import { playBuzzer } from "../game/feedback.js";
import { readStoredNumber, writeStorage } from "../game/storage.js";

function readBest() {
  return readStoredNumber(CHAIN_BEST_KEY);
}

export function useChain({ onCorrect } = {}) {
  const restored = restoreChainRun();
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState(restored?.phase ?? "idle");
  const [streak, setStreak] = useState(restored?.streak ?? 0);
  const [question, setQuestion] = useState(restored?.question ?? null);
  const [usedKeys, setUsedKeys] = useState(restored?.usedKeys ?? []);
  const [picked, setPicked] = useState(restored?.picked ?? null);
  const [result, setResult] = useState(restored?.result ?? null);
  const [ended, setEnded] = useState(null);
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
        game: "chain",
        phase,
        streak,
        picked,
        result,
        question,
        usedKeys,
      });
      return;
    }
    if (owned.current && (phase === "idle" || phase === "gameover")) {
      clearActiveRun("chain");
      owned.current = false;
    }
  }, [phase, streak, question, picked, result, usedKeys]);

  function deal(keys) {
    const next = selectChainQuestion({ usedKeys: keys });
    if (!next) {
      setEnded("cleared");
      setPhase("gameover");
      return false;
    }
    setUsedKeys(keys.includes(next.key) ? keys : [...keys, next.key]);
    setQuestion(next);
    setPicked(null);
    setResult(null);
    setEnded(null);
    locked.current = false;
    setPhase("playing");
    return true;
  }

  function start() {
    locked.current = false;
    const next = selectChainQuestion({ usedKeys: [] });
    setStreak(0);
    setPicked(null);
    setResult(null);
    setEnded(null);
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

  function resume() {
    if (phase === "playing" || phase === "revealing") return true;
    const parked = restoreParkedChainRun();
    if (!parked) return start();
    locked.current = parked.phase === "revealing";
    owned.current = true;
    setPhase(parked.phase);
    setStreak(parked.streak);
    setQuestion(parked.question);
    setUsedKeys(parked.usedKeys);
    setPicked(parked.picked);
    setResult(parked.result);
    setEnded(null);
    return true;
  }

  function discard() {
    locked.current = false;
    setStreak(0);
    setQuestion(null);
    setUsedKeys([]);
    setPicked(null);
    setResult(null);
    setEnded(null);
    setPhase("idle");
  }

  function pick(choiceId) {
    if (locked.current || phase !== "playing" || !question) return;
    const grade = gradeChainChoice(question, choiceId);
    if (!grade) return;
    locked.current = true;
    const nextStreak = grade.correct ? streak + 1 : streak;

    if (grade.correct) {
      setStreak(nextStreak);
      if (nextStreak > best) {
        setBest(nextStreak);
        writeStorage(CHAIN_BEST_KEY, String(nextStreak));
      }
      try {
        onCorrectRef.current?.(nextStreak);
      } catch {
        // Badge persistence must not block the reveal.
      }
    } else {
      playBuzzer();
    }

    setPicked(choiceId);
    setResult(grade.correct ? "correct" : "wrong");
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;
    if (result === "correct") {
      deal(usedKeys);
      return;
    }
    setEnded("wrong");
    setPhase("gameover");
  }

  return { phase, streak, best, question, picked, result, ended, start, resume, pick, advance, discard };
}
