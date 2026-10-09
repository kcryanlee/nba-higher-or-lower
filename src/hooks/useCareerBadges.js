import { useCallback, useRef, useState } from "react";
import {
  CAREER_BADGE_KEY,
  applyCareerStreak,
  readCareerBadges,
} from "../game/careerBadges.js";

function loadCareerBadges() {
  const state = readCareerBadges();
  try {
    localStorage.setItem(CAREER_BADGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing can block storage. The in-memory badges still work.
  }
  return state;
}

export function useCareerBadges() {
  const [snapshot, setSnapshot] = useState(loadCareerBadges);
  const [fresh, setFresh] = useState([]);
  const [celebrate, setCelebrate] = useState([]);
  const snapshotRef = useRef(snapshot);

  const save = useCallback((state, unlocked) => {
    snapshotRef.current = state;
    localStorage.setItem(CAREER_BADGE_KEY, JSON.stringify(state));
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
    const { state, fresh: unlocked } = applyCareerStreak(snapshotRef.current, streak);
    save(state, unlocked);
  }, [save]);

  const dismiss = useCallback(() => setFresh([]), []);
  const acknowledge = useCallback(() => setCelebrate([]), []);

  return { snapshot, fresh, celebrate, recordStreak, dismiss, acknowledge };
}
