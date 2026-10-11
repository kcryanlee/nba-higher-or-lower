import { readJsonStorage, readStoredNumber } from "./storage.js";

export const SCORED_BADGE_KEY = "nba-scored-badges";
export const SCORED_BEST_KEY = "nba-scored-best";

export const SCORED_BADGES = [
  {
    id: "first-bucket",
    name: "First Bucket",
    detail: "Get 1 scoring position right",
    mark: "1",
    streak: 1,
  },
  {
    id: "heating-up",
    name: "Heating Up",
    detail: "Reach 5 correct positions",
    mark: "5",
    streak: 5,
  },
  {
    id: "scoring-eye",
    name: "Scoring Eye",
    detail: "Reach 10 correct positions",
    mark: "10",
    streak: 10,
  },
  {
    id: "box-score",
    name: "Box Score",
    detail: "Reach 20 correct positions",
    mark: "20",
    streak: 20,
  },
  {
    id: "sharp-shooter",
    name: "Sharp Shooter",
    detail: "Reach 30 correct positions",
    mark: "30",
    streak: 30,
  },
  {
    id: "bucket-list",
    name: "Bucket List",
    detail: "Reach 50 correct positions",
    mark: "50",
    streak: 50,
  },
];

function readBest() {
  return readStoredNumber(SCORED_BEST_KEY);
}

export function applyScoredStreak(state, streak) {
  const unlocked = new Set(state.unlocked);
  const fresh = [];

  for (const badge of SCORED_BADGES) {
    if (unlocked.has(badge.id) || streak < badge.streak) continue;
    unlocked.add(badge.id);
    fresh.push(badge);
  }

  return {
    state: { unlocked: [...unlocked] },
    fresh,
  };
}

export function readScoredBadges() {
  const known = new Set(SCORED_BADGES.map((badge) => badge.id));
  const raw = readJsonStorage(SCORED_BADGE_KEY);
  const unlocked = Array.isArray(raw?.unlocked) ? raw.unlocked.filter((id) => known.has(id)) : [];
  return applyScoredStreak({ unlocked }, readBest()).state;
}

export function scoredBadgeProgress(badge, state, best = 0) {
  if (state.unlocked.includes(badge.id)) return "Unlocked";
  return `${Math.min(best, badge.streak)} of ${badge.streak}`;
}
