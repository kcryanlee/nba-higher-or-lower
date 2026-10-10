import { previousDateKey, todayKey } from "./daily.js";
import { readJsonStorage, writeStorage } from "./storage.js";

export const QUIZ_DAILY_LENGTH = 5;

export function emptyQuizDailyRecord() {
  return {
    version: 1,
    lastCompleted: "",
    streak: 0,
    days: {},
    completedDates: [],
    active: null,
  };
}

function wholeCount(value, max) {
  const number = Math.floor(Number(value));
  if (!Number.isInteger(number) || number < 0) return null;
  if (number > max) return null;
  return number;
}

function readDay(value) {
  if (!value || typeof value !== "object") return null;
  if (Math.floor(Number(value.total)) !== QUIZ_DAILY_LENGTH) return null;
  const correct = wholeCount(value.correct, QUIZ_DAILY_LENGTH);
  if (correct == null) return null;
  return { correct, total: QUIZ_DAILY_LENGTH };
}

function readActive(value, days) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  if (days[value.date]) return null;
  const index = Math.floor(Number(value.index));
  if (!Number.isInteger(index) || index <= 0 || index >= QUIZ_DAILY_LENGTH) return null;
  const correct = wholeCount(value.correct, index);
  if (correct == null) return null;
  return {
    date: value.date,
    index,
    correct,
    credited: index,
  };
}

export function nextDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return todayKey(date);
}

export function streakEndingOn(dates, endDate) {
  const set = new Set(dates);
  if (!set.has(endDate)) return 0;
  let count = 0;
  let cursor = endDate;
  while (set.has(cursor)) {
    count += 1;
    cursor = previousDateKey(cursor);
  }
  return count;
}

export function activeQuizStreak(record, date = todayKey()) {
  if (record?.days?.[date]) return streakEndingOn(record.completedDates, date);
  const yesterday = previousDateKey(date);
  if (record?.days?.[yesterday]) return streakEndingOn(record.completedDates, yesterday);
  return 0;
}

export function longestConsecutive(dates) {
  const sorted = [...new Set(dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const date of sorted) {
    run = previous && date === nextDateKey(previous) ? run + 1 : 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

export function quizBestCorrect(record) {
  let best = 0;
  for (const day of Object.values(record?.days || {})) {
    if (day.correct > best) best = day.correct;
  }
  return best;
}

export function readQuizDailyRecord(key) {
  const raw = readJsonStorage(key);
  if (!raw || raw.version !== 1) return emptyQuizDailyRecord();
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
    version: 1,
    lastCompleted,
    streak: lastCompleted ? streakEndingOn(completedDates, lastCompleted) : 0,
    days,
    completedDates,
    active: readActive(raw.active, days),
  };
}

export function writeQuizDailyRecord(key, record) {
  return writeStorage(key, JSON.stringify(record));
}

export function quizRunStatus(record, date = todayKey(), available = true) {
  if (!available) return "unavailable";
  if (record?.days?.[date]) return "complete";
  if (record?.active?.date === date) return "progress";
  return "new";
}

export function commitQuizResult(record, attempt) {
  if (record.days[attempt.date]) {
    if (record.active?.date === attempt.date) return { ...record, active: null };
    return record;
  }
  const correct = wholeCount(attempt.correct, QUIZ_DAILY_LENGTH);
  if (correct == null || attempt.total !== QUIZ_DAILY_LENGTH) return record;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attempt.date)) return record;

  const streak = record.lastCompleted === previousDateKey(attempt.date) ? record.streak + 1 : 1;
  const days = {
    ...record.days,
    [attempt.date]: { correct, total: QUIZ_DAILY_LENGTH },
  };
  const completedDates = record.completedDates.includes(attempt.date)
    ? record.completedDates
    : [...record.completedDates, attempt.date];

  return {
    version: 1,
    lastCompleted: attempt.date,
    streak,
    days,
    completedDates,
    active: null,
  };
}

export function noteQuizAnswer(record, attempt) {
  if (attempt?.total !== QUIZ_DAILY_LENGTH || !/^\d{4}-\d{2}-\d{2}$/.test(attempt?.date || "")) {
    return { record, accepted: false, finished: false };
  }

  if (record.days[attempt.date]) {
    const locked = record.active?.date === attempt.date ? { ...record, active: null } : record;
    return { record: locked, accepted: false, finished: true };
  }

  const active = record.active?.date === attempt.date
    ? record.active
    : { date: attempt.date, index: 0, correct: 0, credited: 0 };

  const index = Math.floor(Number(attempt.index));
  const correct = Math.floor(Number(attempt.correct));
  if (index !== active.index || !Number.isInteger(correct)) {
    return { record, accepted: false, finished: false };
  }
  if (correct < active.correct || correct > active.correct + 1 || correct > QUIZ_DAILY_LENGTH) {
    return { record, accepted: false, finished: false };
  }

  const nextIndex = index + 1;
  if (nextIndex >= QUIZ_DAILY_LENGTH) {
    return {
      record: commitQuizResult(record, {
        date: attempt.date,
        correct,
        total: QUIZ_DAILY_LENGTH,
      }),
      accepted: true,
      finished: true,
    };
  }

  return {
    record: {
      ...record,
      version: 1,
      active: {
        date: attempt.date,
        index: nextIndex,
        correct,
        credited: nextIndex,
      },
    },
    accepted: true,
    finished: false,
  };
}
