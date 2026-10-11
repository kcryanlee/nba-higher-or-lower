import { useCallback, useRef, useState } from "react";
import {
  CHAIN_BADGE_KEY,
  applyChainStreak,
  readChainBadges,
} from "../game/chainBadges.js";
import { writeStorage } from "../game/storage.js";

function loadChainBadges() {
  const state = readChainBadges();
  writeStorage(CHAIN_BADGE_KEY, JSON.stringify(state));
  return state;
}

export function useChainBadges() {
  const [snapshot, setSnapshot] = useState(loadChainBadges);
  const [fresh, setFresh] = useState([]);
  const [celebrate, setCelebrate] = useState([]);
  const snapshotRef = useRef(snapshot);

  const save = useCallback((state, unlocked) => {
    snapshotRef.current = state;
    writeStorage(CHAIN_BADGE_KEY, JSON.stringify(state));
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
    const { state, fresh: unlocked } = applyChainStreak(snapshotRef.current, streak);
    save(state, unlocked);
  }, [save]);

  const dismiss = useCallback(() => setFresh([]), []);
  const acknowledge = useCallback(() => setCelebrate([]), []);

  return { snapshot, fresh, celebrate, recordStreak, dismiss, acknowledge };
}
