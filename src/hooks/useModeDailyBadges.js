import { useCallback, useRef, useState } from "react";
import { applyModeDailyBadges, syncModeDailyBadges } from "../game/modeDailyBadges.js";
import { todayKey } from "../game/daily.js";
import { readQuizDailyRecord } from "../game/quizDaily.js";
import { writeStorage } from "../game/storage.js";

export function useModeDailyBadges(badgeKey, dailyKey, readRecord = readQuizDailyRecord) {
  const [snapshot, setSnapshot] = useState(() => syncModeDailyBadges(badgeKey, dailyKey, todayKey(), readRecord));
  const [fresh, setFresh] = useState([]);
  const [celebrate, setCelebrate] = useState([]);
  const snapshotRef = useRef(snapshot);
  const readRecordRef = useRef(readRecord);
  readRecordRef.current = readRecord;

  const save = useCallback((state, unlocked) => {
    snapshotRef.current = state;
    writeStorage(badgeKey, JSON.stringify(state));
    setSnapshot(state);
    setFresh(unlocked);
    if (!unlocked.length) return;
    setCelebrate((current) => {
      const ids = unlocked.map((badge) => badge.id).filter((id) => !current.includes(id));
      return ids.length ? [...current, ...ids] : current;
    });
  }, [badgeKey]);

  const record = useCallback((savedRecord, date = todayKey()) => {
    let source = savedRecord;
    try {
      const loaded = readRecordRef.current?.(dailyKey);
      if (loaded && typeof loaded === "object") source = loaded;
    } catch {
      source = savedRecord;
    }
    const { state, fresh: unlocked } = applyModeDailyBadges(snapshotRef.current, source, date);
    save(state, unlocked);
  }, [dailyKey, save]);

  const dismiss = useCallback(() => setFresh([]), []);
  const acknowledge = useCallback(() => setCelebrate([]), []);

  return { snapshot, fresh, celebrate, record, dismiss, acknowledge };
}
