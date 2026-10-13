import { useEffect, useRef } from "react";
import { REVEAL_MS } from "../game/feedback.js";

export default function RevealBar({
  onAdvance,
  unlockedBadges = [],
  callout = "",
  holdMs = REVEAL_MS,
  autoAdvance = true,
}) {
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  });

  useEffect(() => {
    if (!autoAdvance) return undefined;
    const timer = window.setTimeout(() => onAdvanceRef.current(), holdMs);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, holdMs]);

  if (!callout && unlockedBadges.length === 0) return null;

  return (
    <section className="board-notes" aria-live="polite">
      {callout ? <p className="streak-callout">{callout}</p> : null}
      {unlockedBadges.map((badge) => (
        <p key={badge.id} className="unlock">
          Badge unlocked · {badge.name}
        </p>
      ))}
    </section>
  );
}
