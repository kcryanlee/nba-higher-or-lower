import { useEffect, useRef } from "react";
import { REVEAL_MS } from "../game/feedback.js";

export default function RevealBar({
  matchup,
  result,
  onAdvance,
  unlockedBadges = [],
  callout = "",
  holdMs = REVEAL_MS,
}) {
  const { category, left, right } = matchup;
  const correct = result === "correct";
  const leftWins = left[category.id] >= right[category.id];
  const onAdvanceRef = useRef(onAdvance);
  const holdRef = useRef(holdMs);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => onAdvanceRef.current(), holdRef.current);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className={`reveal ${correct ? "is-correct" : "is-wrong"}`} aria-live="polite">
      {callout ? <p className="streak-callout">{callout}</p> : null}
      <p className="reveal-title">{correct ? "Correct" : "Wrong"}</p>
      {unlockedBadges.map((badge) => (
        <p key={badge.id} className="unlock">
          Badge unlocked · {badge.name}
        </p>
      ))}
      <div className="reveal-stats">
        <p className="reveal-player">
          <span className="reveal-name">{left.name}</span>
          <strong className={`reveal-value ${leftWins ? "is-higher" : "is-lower"}`}>
            {category.format(left[category.id])}
          </strong>
        </p>
        <p className="reveal-player">
          <span className="reveal-name">{right.name}</span>
          <strong className={`reveal-value ${leftWins ? "is-lower" : "is-higher"}`}>
            {category.format(right[category.id])}
          </strong>
        </p>
      </div>
    </section>
  );
}
