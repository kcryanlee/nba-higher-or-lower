import { DRAFT_BEST_KEYS } from "./draft.js";
import { readJsonStorage, readStoredNumber } from "./storage.js";

export const DRAFT_BADGE_KEYS = {
  year: "nba-draft-year-badges",
  pick: "nba-draft-pick-badges",
};

export const DRAFT_BADGES = [
  {
    id: "first-pick",
    name: "First Pick",
    detail: "Get 1 correct answer",
    mark: "1",
    streak: 1,
  },
  {
    id: "on-the-board",
    name: "On the Board",
    detail: "Reach a 5-answer streak",
    mark: "5",
    streak: 5,
  },
  {
    id: "draft-expert",
    name: "Draft Expert",
    detail: "Reach a 10-answer streak",
    mark: "10",
    streak: 10,
  },
  {
    id: "lottery-legend",
    name: "Lottery Legend",
    detail: "Reach a 20-answer streak",
    mark: "20",
    streak: 20,
  },
  {
    id: "top-10-talent",
    name: "Top 10 Talent",
    detail: "Reach a 30-answer streak",
    mark: "30",
    streak: 30,
  },
  {
    id: "no-1-pick",
    name: "No. 1 Pick",
    detail: "Reach a 40-answer streak",
    mark: "40",
    streak: 40,
  },
  {
    id: "hall-of-fame",
    name: "Hall of Fame",
    detail: "Reach a 50-answer streak",
    mark: "50",
    streak: 50,
  },
];

export function applyDraftStreak(state, streak) {
  const unlocked = new Set(state.unlocked);
  const fresh = [];

  for (const badge of DRAFT_BADGES) {
    if (unlocked.has(badge.id) || streak < badge.streak) continue;
    unlocked.add(badge.id);
    fresh.push(badge);
  }

  return {
    state: { unlocked: [...unlocked] },
    fresh,
  };
}

export function readDraftBadges(mode) {
  if (mode !== "year" && mode !== "pick") return { unlocked: [] };
  const known = new Set(DRAFT_BADGES.map((badge) => badge.id));
  const raw = readJsonStorage(DRAFT_BADGE_KEYS[mode]);
  const unlocked = Array.isArray(raw?.unlocked) ? raw.unlocked.filter((id) => known.has(id)) : [];
  return applyDraftStreak({ unlocked }, readStoredNumber(DRAFT_BEST_KEYS[mode])).state;
}

export function draftBadgeProgress(badge, state, best = 0) {
  if (state.unlocked.includes(badge.id)) return "Unlocked";
  return `${Math.min(best, badge.streak)} of ${badge.streak}`;
}
