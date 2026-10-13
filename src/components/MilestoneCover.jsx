import { useEffect, useRef } from "react";
import { MILESTONE_MS } from "../game/feedback.js";

export default function MilestoneCover({ message, onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), MILESTONE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="milestone" role="status">
      <p>{message}</p>
    </div>
  );
}
