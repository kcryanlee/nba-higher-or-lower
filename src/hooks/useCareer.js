import { useEffect, useRef, useState } from "react";
import { CAREER_BEST_KEY } from "../game/careerBadges.js";
import { selectCareerQuestion } from "../game/careerPath.js";
import { playBuzzer } from "../game/feedback.js";
import { readStoredNumber, writeStorage } from "../game/storage.js";

function readBest() {
  return readStoredNumber(CAREER_BEST_KEY);
}

export function useCareer({ onCorrect } = {}) {
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState("playing");
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState(() => selectCareerQuestion(0));
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const locked = useRef(false);
  const onCorrectRef = useRef(onCorrect);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  });

  function deal(nextStreak, previousName) {
    setQuestion(selectCareerQuestion(nextStreak, previousName));
    setPicked(null);
    setResult(null);
    locked.current = false;
    setPhase("playing");
  }

  function start() {
    setStreak(0);
    deal(0, null);
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
      deal(streak, question.answer);
      return;
    }
    setPhase("gameover");
  }

  return { phase, streak, best, question, picked, result, start, pick, advance };
}
