import { useEffect, useRef, useState } from "react";
import { clearActiveRun, restoreDraftRun, writeActiveRun } from "../game/activeRun.js";
import { DRAFT_BEST_KEYS, selectDraftQuestion } from "../game/draft.js";
import { playBuzzer } from "../game/feedback.js";
import { readStoredNumber, writeStorage } from "../game/storage.js";

function bestFor(mode) {
  if (mode !== "year" && mode !== "pick") return 0;
  return readStoredNumber(DRAFT_BEST_KEYS[mode]);
}

export function useDraft(players, { onCorrect } = {}) {
  const restored = restoreDraftRun(players);
  const [mode, setMode] = useState(restored?.mode ?? null);
  const [best, setBest] = useState(() => bestFor(restored?.mode));
  const [phase, setPhase] = useState(restored?.phase ?? "idle");
  const [streak, setStreak] = useState(restored?.streak ?? 0);
  const [question, setQuestion] = useState(restored?.question ?? null);
  const [usedIds, setUsedIds] = useState(restored?.usedIds ?? []);
  const [guess, setGuess] = useState(restored?.guess ?? null);
  const [result, setResult] = useState(restored?.result ?? null);
  const locked = useRef(restored?.phase === "revealing");
  const onCorrectRef = useRef(onCorrect);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  });

  useEffect(() => {
    if ((phase === "playing" || phase === "revealing") && question && (mode === "year" || mode === "pick")) {
      writeActiveRun({
        game: "draft",
        mode,
        phase,
        streak,
        guess,
        result,
        playerId: question.id,
        choices: question.choices,
        usedIds,
      });
      return;
    }
    if (phase === "idle" || phase === "gameover" || phase === "cleared") clearActiveRun("draft");
  }, [phase, mode, streak, question, guess, result, usedIds]);

  function deal(nextMode, ids) {
    const next = selectDraftQuestion(players, nextMode, ids);
    setGuess(null);
    setResult(null);
    locked.current = false;
    if (!next) {
      setPhase("cleared");
      return;
    }
    setUsedIds(ids.includes(next.id) ? ids : [...ids, next.id]);
    setQuestion(next);
    setPhase("playing");
  }

  function start(nextMode) {
    if (nextMode !== "year" && nextMode !== "pick") return false;
    const next = selectDraftQuestion(players, nextMode, []);
    locked.current = false;
    setMode(nextMode);
    setBest(bestFor(nextMode));
    setStreak(0);
    setGuess(null);
    setResult(null);
    if (!next) {
      setQuestion(null);
      setUsedIds([]);
      setPhase("idle");
      return false;
    }
    setUsedIds([next.id]);
    setQuestion(next);
    setPhase("playing");
    return true;
  }

  function discard() {
    locked.current = false;
    setStreak(0);
    setQuestion(null);
    setUsedIds([]);
    setGuess(null);
    setResult(null);
    setPhase("idle");
  }

  function submit(choice) {
    if (locked.current || phase !== "playing" || !question) return;
    if (!Number.isInteger(choice) || !question.choices?.includes(choice)) return;
    locked.current = true;
    const correct = choice === question.answer;
    const nextStreak = correct ? streak + 1 : streak;

    if (correct) {
      setStreak(nextStreak);
      if (nextStreak > best) {
        setBest(nextStreak);
        writeStorage(DRAFT_BEST_KEYS[mode], String(nextStreak));
      }
      try {
        onCorrectRef.current?.(mode, nextStreak);
      } catch {
        // Badge persistence must not block the reveal.
      }
    } else {
      playBuzzer();
    }

    setGuess(choice);
    setResult(correct ? "correct" : "wrong");
    setPhase("revealing");
  }

  function advance() {
    if (phase !== "revealing" || !locked.current) return;
    locked.current = false;
    if (result === "correct") {
      deal(mode, usedIds);
      return;
    }
    setPhase("gameover");
  }

  return { phase, mode, streak, best, question, guess, result, start, submit, advance, discard };
}
