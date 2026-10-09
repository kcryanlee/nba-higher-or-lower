import { useState } from "react";
import { CAREER_BEST_KEY } from "../game/careerBadges.js";
import { selectCareerQuestion } from "../game/careerPath.js";
import { playBuzzer } from "../game/feedback.js";

const BEST_KEY = CAREER_BEST_KEY;

function readBest() {
  const stored = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export function useCareer({ onCorrect } = {}) {
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState("playing");
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState(() => selectCareerQuestion(0));
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);

  function deal(nextStreak, previousName) {
    setQuestion(selectCareerQuestion(nextStreak, previousName));
    setPicked(null);
    setResult(null);
    setPhase("playing");
  }

  function start() {
    setStreak(0);
    deal(0, null);
  }

  function pick(name) {
    if (phase !== "playing") return;
    const correct = name === question.answer;
    setPicked(name);
    if (correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak > best) {
        localStorage.setItem(BEST_KEY, String(nextStreak));
        setBest(nextStreak);
      }
      onCorrect?.(nextStreak);
      setResult("correct");
    } else {
      playBuzzer();
      setResult("wrong");
    }
    setPhase("revealing");
  }

  function advance() {
    if (result === "correct") {
      deal(streak, question.answer);
      return;
    }
    setPhase("gameover");
  }

  return { phase, streak, best, question, picked, result, start, pick, advance };
}
