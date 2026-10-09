import { CATEGORIES } from "./categories.js";
import { BANDS, bandForGap, widenedRange } from "./difficulty.js";
import { collectPairs } from "./selectMatchup.js";
import { readJsonStorage, writeStorage } from "./storage.js";

export const DAILY_KEY = "nba-hol-daily";
export const DAILY_LENGTH = 15;
export const BAND_POINTS = { easy: 1, medium: 2, hard: 3, expert: 4 };

const SLOT_BANDS = [
  "easy",
  "easy",
  "easy",
  "medium",
  "medium",
  "medium",
  "medium",
  "hard",
  "hard",
  "hard",
  "hard",
  "expert",
  "expert",
  "expert",
  "expert",
];

export function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function previousDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

export function formatDailyDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith(list, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function choosePair(matches, blocked, random, category) {
  const match = matches[Math.floor(random() * matches.length)];
  blocked.add(match.key);
  const [left, right] = random() < 0.5
    ? [match.first, match.second]
    : [match.second, match.first];

  return {
    category,
    left,
    right,
    key: match.key,
    gap: match.gap,
    band: bandForGap(category.id, match.gap),
  };
}

function takePair(players, category, requested, blocked, random) {
  for (let step = 0; step <= 4; step += 1) {
    const range = step === 0
      ? requested.gaps[category.id]
      : widenedRange(requested.id, category.id, step);
    const matches = collectPairs(players, category, range, blocked);
    if (matches.length === 0) continue;
    return choosePair(matches, blocked, random, category);
  }

  const fallback = collectPairs(players, category, { min: 0, max: Infinity }, blocked);
  if (fallback.length === 0) return null;
  return choosePair(fallback, blocked, random, category);
}

export function buildDaily(players, dateKey) {
  try {
    if (!Array.isArray(players) || players.length < 2) return null;
    const random = mulberry32(hashString(`nba-hol:${dateKey}`));
    const categories = shuffleWith(CATEGORIES, random);
    const extras = shuffleWith(CATEGORIES, random).slice(0, DAILY_LENGTH - categories.length);
    categories.push(...extras);
    const blocked = new Set();
    const questions = categories.map((category, index) => (
      takePair(players, category, BANDS[SLOT_BANDS[index]], blocked, random)
    ));

    if (questions.length !== DAILY_LENGTH || questions.some((question) => !question)) return null;
    if (questions.some((question) => question.left[question.category.id] === question.right[question.category.id])) {
      return null;
    }
    return questions;
  } catch {
    return null;
  }
}

const BAND_IDS = new Set(["easy", "medium", "hard", "expert"]);

export function emptyDailyRecord() {
  return {
    version: 3,
    lastCompleted: "",
    streak: 0,
    days: {},
    completedDates: [],
    bestCorrect: 0,
    bestTotal: DAILY_LENGTH,
    active: null,
  };
}

function whole(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function readDay(value) {
  if (!value || typeof value !== "object") return null;
  const correct = whole(value.correct);
  const total = whole(value.total);
  const score = whole(value.score);
  if (!total) return null;
  return {
    correct,
    total,
    score,
    difficulty: typeof value.difficulty === "string" ? value.difficulty : "None",
  };
}

function readActive(value, days) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  if (days[value.date]) return null;
  const index = Math.floor(Number(value.index));
  if (!Number.isInteger(index) || index <= 0 || index >= DAILY_LENGTH) return null;
  const credited = Math.floor(Number(value.credited));
  const safeCredited = Number.isInteger(credited) && credited > 0 ? Math.min(credited, DAILY_LENGTH) : 0;
  return {
    date: value.date,
    index,
    correct: whole(value.correct),
    score: whole(value.score),
    highestId: BAND_IDS.has(value.highestId) ? value.highestId : null,
    credited: Math.max(safeCredited, index),
  };
}

export function readDailyRecord() {
  const raw = readJsonStorage(DAILY_KEY);
  if (!raw || (raw.version !== 2 && raw.version !== 3)) return emptyDailyRecord();
  const days = {};
  if (raw.days && typeof raw.days === "object") {
    for (const [date, value] of Object.entries(raw.days)) {
      const day = readDay(value);
      if (day) days[date] = day;
    }
  }
  const completedDates = Array.isArray(raw.completedDates)
    ? raw.completedDates.filter((date) => typeof date === "string" && days[date])
    : Object.keys(days);
  const best = bestDay(days);
  return {
    version: 3,
    lastCompleted: typeof raw.lastCompleted === "string" && days[raw.lastCompleted] ? raw.lastCompleted : "",
    streak: whole(raw.streak),
    days,
    completedDates,
    bestCorrect: best?.correct ?? 0,
    bestTotal: best?.total ?? DAILY_LENGTH,
    active: readActive(raw.active, days),
  };
}

export function writeDailyRecord(record) {
  return writeStorage(DAILY_KEY, JSON.stringify(record));
}

export function dailyRunStatus(record, date = todayKey()) {
  if (record.days?.[date]) return "complete";
  if (record.active?.date === date) return "progress";
  return "new";
}

export function activeDailyStreak(record, date = todayKey()) {
  if (!record.lastCompleted) return 0;
  if (record.lastCompleted === date || record.lastCompleted === previousDateKey(date)) {
    return record.streak;
  }
  return 0;
}

export function monthCompletionCount(record, date = todayKey()) {
  const month = date.slice(0, 7);
  return record.completedDates.filter((day) => day.startsWith(month)).length;
}

function bestDay(days) {
  let best = null;
  for (const day of Object.values(days)) {
    if (!best || day.correct > best.correct || (day.correct === best.correct && day.score > best.score)) {
      best = day;
    }
  }
  return best;
}

export function accuracyFor(correct, total) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

export function commitOfficialResult(record, attempt) {
  if (record.days[attempt.date]) {
    if (record.active?.date === attempt.date) return { ...record, active: null };
    return record;
  }

  const streak = record.lastCompleted === previousDateKey(attempt.date) ? record.streak + 1 : 1;
  const day = {
    correct: attempt.correct,
    total: attempt.total,
    score: attempt.score,
    difficulty: attempt.difficulty,
  };
  const days = { ...record.days, [attempt.date]: day };
  const best = bestDay(days);

  return {
    version: 3,
    lastCompleted: attempt.date,
    streak,
    days,
    completedDates: [...record.completedDates, attempt.date],
    bestCorrect: best.correct,
    bestTotal: best.total,
    active: null,
  };
}

export function noteOfficialAnswer(record, attempt) {
  if (record.days[attempt.date]) {
    const locked = record.active?.date === attempt.date ? { ...record, active: null } : record;
    return { record: locked, accepted: false, finished: true };
  }

  const active = record.active?.date === attempt.date
    ? record.active
    : { date: attempt.date, index: 0, correct: 0, score: 0, highestId: null, credited: 0 };

  if (attempt.index !== active.index || attempt.index < active.credited) {
    return { record, accepted: false, finished: false };
  }

  const nextIndex = attempt.index + 1;
  if (nextIndex >= attempt.total) {
    const finished = commitOfficialResult(record, {
      date: attempt.date,
      correct: attempt.correct,
      total: attempt.total,
      score: attempt.score,
      difficulty: attempt.difficulty,
    });
    return { record: { ...finished, active: null }, accepted: true, finished: true };
  }

  return {
    record: {
      ...record,
      version: 3,
      active: {
        date: attempt.date,
        index: nextIndex,
        correct: attempt.correct,
        score: attempt.score,
        highestId: attempt.highestId ?? null,
        credited: nextIndex,
      },
    },
    accepted: true,
    finished: false,
  };
}
