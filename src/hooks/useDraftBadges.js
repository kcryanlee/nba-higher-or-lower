import { useCallback, useRef, useState } from "react";
import { DRAFT_BADGE_KEYS, applyDraftStreak, readDraftBadges } from "../game/draftBadges.js";
import { writeStorage } from "../game/storage.js";

function loadMode(mode) {
  const state = readDraftBadges(mode);
  writeStorage(DRAFT_BADGE_KEYS[mode], JSON.stringify(state));
  return state;
}

export function useDraftBadges() {
  const [snapshots, setSnapshots] = useState(() => ({
    year: loadMode("year"),
    pick: loadMode("pick"),
  }));
  const [fresh, setFresh] = useState([]);
  const [freshMode, setFreshMode] = useState(null);
  const [celebrate, setCelebrate] = useState({ year: [], pick: [] });
  const snapshotRef = useRef(snapshots);

  const recordStreak = useCallback((mode, streak) => {
    if (mode !== "year" && mode !== "pick") return;
    const { state, fresh: unlocked } = applyDraftStreak(snapshotRef.current[mode], streak);
    const next = { ...snapshotRef.current, [mode]: state };
    snapshotRef.current = next;
    writeStorage(DRAFT_BADGE_KEYS[mode], JSON.stringify(state));
    setSnapshots(next);
    setFresh(unlocked);
    setFreshMode(mode);
    if (!unlocked.length) return;
    setCelebrate((current) => {
      const ids = unlocked.map((badge) => badge.id).filter((id) => !current[mode].includes(id));
      return ids.length ? { ...current, [mode]: [...current[mode], ...ids] } : current;
    });
  }, []);

  const dismiss = useCallback(() => {
    setFresh([]);
    setFreshMode(null);
  }, []);

  const acknowledge = useCallback((mode) => {
    if (mode !== "year" && mode !== "pick") return;
    setCelebrate((current) => ({ ...current, [mode]: [] }));
  }, []);

  return { snapshots, fresh, freshMode, celebrate, recordStreak, dismiss, acknowledge };
}
