import { previousDateKey, todayKey } from "./daily.js";
import { activeQuizStreak, quizBestCorrect, streakEndingOn } from "./quizDaily.js";
import { readJsonStorage, writeStorage } from "./storage.js";
import { SCORED_PERFECT_CREDIT } from "./scored.js";

export const SCORED_DAILY_QUESTIONS = 5;
export const SCORED_DAILY_TOTAL = SCORED_DAILY_QUESTIONS * SCORED_PERFECT_CREDIT;
const RECORD_VERSION = 2;

export function emptyScoredDailyRecord() {
  return {
    version: RECORD_VERSION,
    lastCompleted: "",
    streak: 0,
    days: {},
    completedDates: [],
    active: null,
  };
}

function wholeCount(value, max) {
  const number = Math.floor(Number(value));
  if (!Number.isInteger(number) || number < 0 || number > max) return null;
  return number;
}

function readDay(value) {
  if (!value || typeof value !== "object") return null;
  if (Math.floor(Number(value.total)) !== SCORED_DAILY_TOTAL) return null;
  const correct = wholeCount(value.correct, SCORED_DAILY_TOTAL);
  if (correct == null) return null;
  return { correct, total: SCORED_DAILY_TOTAL };
}

function readPicks(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const picks = [];
  for (const id of value) {
    if (!Number.isInteger(id) || picks.includes(id)) return null;
    picks.push(id);
  }
  return picks;
}

function playingScored(value, index, correct) {
  return {
    date: value.date,
    index,
    correct,
    credited: index,
    phase: "playing",
    picks: null,
    credit: null,
    result: null,
  };
}

function readActive(value, days) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  if (days[value.date]) return null;
  const index = Math.floor(Number(value.index));
  if (!Number.isInteger(index) || index < 0 || index >= SCORED_DAILY_QUESTIONS) return null;

  const picks = readPicks(value.picks);
  const credit = wholeCount(value.credit, SCORED_PERFECT_CREDIT);
  const revealing = value.phase === "revealing"
    && picks
    && credit != null
    && ((value.result === "placed" && credit > 0) || (value.result === "miss" && credit === 0));
  if (revealing) {
    const correct = wholeCount(value.correct, (index + 1) * SCORED_PERFECT_CREDIT);
    if (correct == null) return null;
    return {
      date: value.date,
      index,
      correct,
      credited: index + 1,
      phase: "revealing",
      picks,
      credit,
      result: value.result,
    };
  }

  if (value.phase === "revealing") {
    const next = index + 1;
    if (next <= 0 || next >= SCORED_DAILY_QUESTIONS) return null;
    const correct = wholeCount(value.correct, next * SCORED_PERFECT_CREDIT);
    if (correct == null) return null;
    return playingScored(value, next, correct);
  }

  if (index <= 0 || Math.floor(Number(value.credited)) !== index) return null;
  const correct = wholeCount(value.correct, index * SCORED_PERFECT_CREDIT);
  if (correct == null) return null;
  return playingScored(value, index, correct);
}

export function readScoredDailyRecord(key) {
  const raw = readJsonStorage(key);
  if (!raw || raw.version !== RECORD_VERSION) return emptyScoredDailyRecord();
  const days = {};
  if (raw.days && typeof raw.days === "object") {
    for (const [date, value] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const day = readDay(value);
      if (day) days[date] = day;
    }
  }
  const completedDates = [...new Set(
    (Array.isArray(raw.completedDates) ? raw.completedDates : Object.keys(days))
      .filter((date) => typeof date === "string" && days[date]),
  )];
  const lastCompleted = typeof raw.lastCompleted === "string" && days[raw.lastCompleted]
    ? raw.lastCompleted
    : completedDates.slice().sort().at(-1) || "";
  return {
    version: RECORD_VERSION,
    lastCompleted,
    streak: lastCompleted ? streakEndingOn(completedDates, lastCompleted) : 0,
    days,
    completedDates,
    active: readActive(raw.active, days),
  };
}

export function writeScoredDailyRecord(key, record) {
  return writeStorage(key, JSON.stringify(record));
}

export function scoredDailyRunStatus(record, date = todayKey(), available = true) {
  if (!available) return "unavailable";
  if (record?.days?.[date]) return "complete";
  if (record?.active?.date === date) return "progress";
  return "new";
}

export function scoredDailyStreak(record, date = todayKey()) {
  return activeQuizStreak(record, date);
}

export function scoredDailyBest(record) {
  return quizBestCorrect(record);
}

function commitDay(record, attempt) {
  if (record.days[attempt.date]) {
    if (record.active?.date === attempt.date) return { ...record, active: null };
    return record;
  }
  const correct = wholeCount(attempt.correct, SCORED_DAILY_TOTAL);
  if (correct == null || attempt.total !== SCORED_DAILY_TOTAL) return record;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attempt.date)) return record;

  const streak = record.lastCompleted === previousDateKey(attempt.date) ? record.streak + 1 : 1;
  const days = {
    ...record.days,
    [attempt.date]: { correct, total: SCORED_DAILY_TOTAL },
  };
  const completedDates = record.completedDates.includes(attempt.date)
    ? record.completedDates
    : [...record.completedDates, attempt.date];

  return {
    version: RECORD_VERSION,
    lastCompleted: attempt.date,
    streak,
    days,
    completedDates,
    active: null,
  };
}

export function noteScoredDailyAnswer(record, attempt) {
  if (attempt?.total !== SCORED_DAILY_TOTAL || !/^\d{4}-\d{2}-\d{2}$/.test(attempt?.date || "")) {
    return { record, accepted: false, finished: false };
  }

  if (record.days[attempt.date]) {
    const locked = record.active?.date === attempt.date ? { ...record, active: null } : record;
    return { record: locked, accepted: false, finished: true };
  }

  const active = record.active?.date === attempt.date
    ? record.active
    : { date: attempt.date, index: 0, correct: 0, credited: 0, phase: "playing" };

  const index = Math.floor(Number(attempt.index));
  const correct = Math.floor(Number(attempt.correct));
  if (active.phase === "revealing" || index !== active.index || !Number.isInteger(correct)) {
    return { record, accepted: false, finished: false };
  }
  const gained = correct - active.correct;
  const credit = Math.floor(Number(attempt.credit));
  const picks = readPicks(attempt.picks);
  if (gained < 0 || gained > SCORED_PERFECT_CREDIT || correct > SCORED_DAILY_TOTAL || credit !== gained || !picks) {
    return { record, accepted: false, finished: false };
  }
  if ((gained > 0 && attempt.result !== "placed") || (gained === 0 && attempt.result !== "miss")) {
    return { record, accepted: false, finished: false };
  }

  return {
    record: {
      ...record,
      version: RECORD_VERSION,
      active: {
        date: attempt.date,
        index,
        correct,
        credited: index + 1,
        phase: "revealing",
        picks,
        credit,
        result: attempt.result,
      },
    },
    accepted: true,
    finished: false,
  };
}

export function continueScoredDaily(record) {
  const active = record?.active;
  if (!active || active.phase !== "revealing") {
    return { record, advanced: false, finished: false };
  }

  const nextIndex = active.index + 1;
  if (nextIndex >= SCORED_DAILY_QUESTIONS) {
    return {
      record: commitDay(record, {
        date: active.date,
        correct: active.correct,
        total: SCORED_DAILY_TOTAL,
      }),
      advanced: true,
      finished: true,
    };
  }

  return {
    record: {
      ...record,
      version: RECORD_VERSION,
      active: {
        date: active.date,
        index: nextIndex,
        correct: active.correct,
        credited: nextIndex,
        phase: "playing",
        picks: null,
        credit: null,
        result: null,
      },
    },
    advanced: true,
    finished: false,
  };
}
