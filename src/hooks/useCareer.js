import { useEffect, useRef, useState } from "react";
import { clearActiveRun, restoreCareerRun, writeActiveRun } from "../game/activeRun.js";
import { CAREER_BEST_KEY } from "../game/careerBadges.js";
import { selectCareerQuestion } from "../game/careerPath.js";
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
  const [picked, setPicked] = useState(restored?.picked ?? null);
  const [result, setResult] = useState(restored?.result ?? null);
  const locked = useRef(restored?.phase === "revealing");
  const onCorrectRef = useRef(onCorrect);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  });

  useEffect(() => {
    if ((phase === "playing" || phase === "revealing") && question) {
      writeActiveRun({
        game: "career",
        phase,
        streak,
        picked,
        result,
        question,
        usedIds,
      });
      return;
    }
    if (phase === "idle" || phase === "gameover") clearActiveRun("career");
  }, [phase, streak, question, picked, result, usedIds]);

  function deal(nextStreak, ids) {
    const next = selectCareerQuestion(nextStreak, { usedIds: ids });
    if (!next) {
      setPhase("gameover");
      return;
    }
    setUsedIds(ids.includes(next.answerId) ? ids : [...ids, next.answerId]);
    setQuestion(next);
    setPicked(null);
    setResult(null);
    locked.current = false;
    setPhase("playing");
  }

  function start() {
    locked.current = false;
    const next = selectCareerQuestion(0, { usedIds: [] });
    setStreak(0);
    setPicked(null);
    setResult(null);
    if (!next) {
      setQuestion(null);
      setUsedIds([]);
      setPhase("idle");
      return;
    }
    setUsedIds([next.answerId]);
    setQuestion(next);
    setPhase("playing");
  }

  function discard() {
    locked.current = false;
    setStreak(0);
    setQuestion(null);
    setUsedIds([]);
    setPicked(null);
    setResult(null);
    setPhase("idle");
  }

  function pick(name) {
    if (locked.current || phase !== "playing" || !question) return;
    locked.current = true;
    const correct = name === question.answer;
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
      deal(streak, usedIds);
      return;
    }
    setPhase("gameover");
  }

  return { phase, streak, best, question, picked, result, start, pick, advance, discard };
}
