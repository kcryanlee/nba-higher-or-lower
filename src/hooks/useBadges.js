import { useCallback, useRef, useState } from "react";
import {
  BADGE_KEY,
  applyAnswer,
  readBadgeState,
} from "../game/badges.js";
import { writeStorage } from "../game/storage.js";

export function useBadges() {
  const [snapshot, setSnapshot] = useState(readBadgeState);
  const [fresh, setFresh] = useState([]);
  const [celebrate, setCelebrate] = useState([]);
  const snapshotRef = useRef(snapshot);

  const save = useCallback((state, unlocked) => {
    snapshotRef.current = state;
    writeStorage(BADGE_KEY, JSON.stringify(state));
    setSnapshot(state);
    setFresh(unlocked);
    if (unlocked.length) {
      setCelebrate((current) => {
        const ids = unlocked.map((badge) => badge.id).filter((id) => !current.includes(id));
        return ids.length ? [...current, ...ids] : current;
      });
    }
  }, []);

  const recordAnswer = useCallback((event) => {
    const { state, fresh: unlocked } = applyAnswer(snapshotRef.current, event);
    save(state, unlocked);
  }, [save]);

  const dismiss = useCallback(() => setFresh([]), []);
  const acknowledge = useCallback(() => setCelebrate([]), []);

  return {
    snapshot,
    fresh,
    celebrate,
    recordAnswer,
    dismiss,
    acknowledge,
  };
}
