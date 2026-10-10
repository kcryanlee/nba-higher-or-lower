import { previousDateKey, todayKey } from "./daily.js";
import {
  activeQuizStreak,
  longestConsecutive,
  quizBestCorrect,
  QUIZ_DAILY_LENGTH,
  readQuizDailyRecord,
  streakEndingOn,
} from "./quizDaily.js";
import { readJsonStorage, writeStorage } from "./storage.js";

export const HIGHER_DAILY_BADGE_KEY = "nba-hol-daily-badges";
export const CAREER_DAILY_BADGE_KEY = "nba-career-daily-badges";
export const DRAFT_DAILY_BADGE_KEY = "nba-draft-daily-badges";
export const DRAFT_DAILY_BADGE_KEYS = {
  year: "nba-draft-year-daily-badges",
  pick: "nba-draft-pick-daily-badges",
};

export const MODE_DAILY_BADGES = [
  {
    id: "daily-debut",
    name: "Daily Debut",
    detail: "Complete your first daily challenge",
    mark: "1",
    goal: 1,
    track: "debut",
  },
  {
    id: "perfect-day",
    name: "Perfect Day",
    detail: "Get 5/5 in a daily challenge",
    mark: "5/5",
    goal: QUIZ_DAILY_LENGTH,
    track: "perfect",
  },
  {
    id: "daily-regular",
    name: "Daily Regular",
    detail: "Complete daily challenges on 3 different days",
    mark: "3",
    goal: 3,
    track: "days",
  },
  {
    id: "daily-streak",
    name: "Daily Streak",
    detail: "Complete daily challenges on 7 consecutive days",
    mark: "7",
    goal: 7,
    track: "streak",
  },
  {
    id: "monthly-master",
    name: "Monthly Master",
    detail: "Complete daily challenges on 30 consecutive days",
    mark: "30",
    goal: 30,
    track: "streak",
  },
  {
    id: "perfect-week",
    name: "Perfect Week",
    detail: "Score full marks on 7 consecutive daily challenges",
    mark: "7",
    goal: 7,
    track: "perfect-streak",
  },
  {
    id: "perfect-month",
    name: "Perfect Month",
    detail: "Score full marks on 30 consecutive daily challenges",
    mark: "30",
    goal: 30,
    track: "perfect-streak",
  },
  {
    id: "ten-day-player",
    name: "Ten-Day Player",
    detail: "Complete daily challenges on 10 different days",
    mark: "10",
    goal: 10,
    track: "days",
  },
  {
    id: "dedicated-fan",
    name: "Dedicated Fan",
    detail: "Complete daily challenges on 25 different days",
    mark: "25",
    goal: 25,
    track: "days",
  },
  {
    id: "half-century-club",
    name: "Half-Century Club",
    detail: "Complete daily challenges on 50 different days",
    mark: "50",
    goal: 50,
    track: "days",
  },
  {
    id: "century-club",
    name: "Century Club",
    detail: "Complete daily challenges on 100 different days",
    mark: "100",
    goal: 100,
    track: "days",
  },
  {
    id: "daily-legend",
    name: "Daily Legend",
    detail: "Complete daily challenges on 365 different days",
    mark: "365",
    goal: 365,
    track: "days",
  },
];

function knownIds() {
  return new Set(MODE_DAILY_BADGES.map((badge) => badge.id));
}

function storedUnlocked(storageKey) {
  const known = knownIds();
  const raw = readJsonStorage(storageKey);
  return Array.isArray(raw?.unlocked) ? raw.unlocked.filter((id) => known.has(id)) : [];
}

function countedDay(value) {
  if (!value || typeof value !== "object") return null;
  const total = Math.floor(Number(value.total));
  const correct = Math.floor(Number(value.correct));
  if (!Number.isInteger(total) || total <= 0) return null;
  if (!Number.isInteger(correct) || correct < 0) return null;
  return { correct: Math.min(correct, total), total };
}

function isPerfectDay(day) {
  return Boolean(day) && day.total > 0 && day.correct === day.total;
}

function prefersDay(next, current) {
  if (!current) return true;
  const nextPerfect = isPerfectDay(next);
  const currentPerfect = isPerfectDay(current);
  if (nextPerfect !== currentPerfect) return nextPerfect;
  return next.correct / next.total > current.correct / current.total;
}

export function mergeModeDailyRecords(records) {
  const days = {};
  for (const record of records) {
    for (const [date, value] of Object.entries(record?.days || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const day = countedDay(value);
      if (!day || !prefersDay(day, days[date])) continue;
      days[date] = day;
    }
  }
  const completedDates = Object.keys(days).sort();
  return {
    version: 1,
    lastCompleted: completedDates.at(-1) || "",
    days,
    completedDates,
    active: null,
  };
}

function perfectDates(record) {
  return Object.entries(record?.days || {})
    .filter(([, day]) => isPerfectDay(countedDay(day)))
    .map(([date]) => date);
}

function activePerfectStreak(record, date) {
  const dates = perfectDates(record);
  if (record?.days?.[date]) return streakEndingOn(dates, date);
  const yesterday = previousDateKey(date);
  if (record?.days?.[yesterday]) return streakEndingOn(dates, yesterday);
  return 0;
}

export function modeDailyStats(record, date = todayKey()) {
  const completedDates = [...new Set(
    (Array.isArray(record?.completedDates) ? record.completedDates : Object.keys(record?.days || {}))
      .filter((day) => typeof day === "string" && record?.days?.[day]),
  )];
  const perfectDays = perfectDates(record);
  return {
    completions: completedDates.length,
    differentDays: completedDates.length,
    streak: activeQuizStreak(record, date),
    bestStreak: longestConsecutive(completedDates),
    perfectStreak: activePerfectStreak(record, date),
    bestPerfectStreak: longestConsecutive(perfectDays),
    bestCorrect: quizBestCorrect(record),
    perfect: perfectDays.length > 0,
  };
}

function meets(badge, stats) {
  if (badge.track === "debut") return stats.completions >= 1;
  if (badge.track === "perfect") return stats.perfect;
  if (badge.track === "days") return stats.differentDays >= badge.goal;
  if (badge.track === "streak") return stats.bestStreak >= badge.goal;
  if (badge.track === "perfect-streak") return stats.bestPerfectStreak >= badge.goal;
  return false;
}

export function readUnlockedModeDailyBadges(storageKey) {
  const keys = storageKey === DRAFT_DAILY_BADGE_KEY
    ? [storageKey, DRAFT_DAILY_BADGE_KEYS.year, DRAFT_DAILY_BADGE_KEYS.pick]
    : [storageKey];
  return { unlocked: [...new Set(keys.flatMap((key) => storedUnlocked(key)))] };
}

export function applyModeDailyBadges(state, record, date = todayKey()) {
  const stats = modeDailyStats(record, date);
  const unlocked = new Set(state?.unlocked || []);
  const fresh = [];

  for (const badge of MODE_DAILY_BADGES) {
    if (unlocked.has(badge.id) || !meets(badge, stats)) continue;
    unlocked.add(badge.id);
    fresh.push(badge);
  }

  return {
    state: { unlocked: [...unlocked] },
    fresh,
    stats,
  };
}

export function readModeDailyBadges(storageKey, record, date = todayKey()) {
  return applyModeDailyBadges(readUnlockedModeDailyBadges(storageKey), record, date).state;
}

export function syncModeDailyBadges(badgeKey, dailyKey, date = todayKey(), readRecord = readQuizDailyRecord) {
  const record = readRecord(dailyKey);
  const { state } = applyModeDailyBadges(readUnlockedModeDailyBadges(badgeKey), record, date);
  writeStorage(badgeKey, JSON.stringify(state));
  return state;
}

export function modeDailyBadgeProgress(badge, state, stats = {}) {
  if (state?.unlocked?.includes(badge.id)) return "Unlocked";
  const streak = stats.streak ?? 0;
  const days = stats.differentDays ?? 0;
  const bestCorrect = stats.bestCorrect ?? 0;
  if (badge.track === "debut" || badge.id === "daily-debut") {
    return `${Math.min(stats.completions ?? 0, 1)} of 1`;
  }
  if (badge.track === "perfect" || badge.id === "perfect-day") {
    const length = Math.floor(Number(stats.total)) > 0 ? Math.floor(Number(stats.total)) : QUIZ_DAILY_LENGTH;
    return `Best ${Math.min(bestCorrect, length)}/${length}`;
  }
  if (badge.track === "perfect-streak") {
    return `${Math.min(stats.perfectStreak ?? 0, badge.goal)} of ${badge.goal} days`;
  }
  const current = badge.track === "days" || badge.id === "daily-regular" ? days : streak;
  return `${Math.min(current, badge.goal)} of ${badge.goal} days`;
}
