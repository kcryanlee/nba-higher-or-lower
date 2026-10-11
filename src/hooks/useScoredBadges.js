import { useCallback, useRef, useState } from "react";
import {
  SCORED_BADGE_KEY,
  applyScoredStreak,
  readScoredBadges,
} from "../game/scoredBadges.js";
import { writeStorage } from "../game/storage.js";

function loadScoredBadges() {
  const state = readScoredBadges();
  writeStorage(SCORED_BADGE_KEY, JSON.stringify(state));
  return state;
}

export function useScoredBadges() {
  const [snapshot, setSnapshot] = useState(loadScoredBadges);
  const [fresh, setFresh] = useState([]);
  const [celebrate, setCelebrate] = useState([]);
  const snapshotRef = useRef(snapshot);

  const save = useCallback((state, unlocked) => {
    snapshotRef.current = state;
    writeStorage(SCORED_BADGE_KEY, JSON.stringify(state));
    setSnapshot(state);
    setFresh(unlocked);
    if (unlocked.length) {
      setCelebrate((current) => {
        const ids = unlocked.map((badge) => badge.id).filter((id) => !current.includes(id));
        return ids.length ? [...current, ...ids] : current;
      });
    }
  }, []);

  const recordStreak = useCallback((streak) => {
    const { state, fresh: unlocked } = applyScoredStreak(snapshotRef.current, streak);
    save(state, unlocked);
  }, [save]);

  const dismiss = useCallback(() => setFresh([]), []);
  const acknowledge = useCallback(() => setCelebrate([]), []);

  return { snapshot, fresh, celebrate, recordStreak, dismiss, acknowledge };
}
