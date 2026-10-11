import { readJsonStorage, readStoredNumber } from "./storage.js";

export const CHAIN_BADGE_KEY = "nba-chain-badges";
export const CHAIN_BEST_KEY = "nba-chain-best";

export const CHAIN_BADGES = [
  {
    id: "first-link",
    name: "First Link",
    detail: "Get 1 correct answer in a row",
    mark: "1",
    streak: 1,
  },
  {
    id: "in-the-rotation",
    name: "In the Rotation",
    detail: "Reach a 5-answer streak",
    mark: "5",
    streak: 5,
  },
  {
    id: "glue-guy",
    name: "Glue Guy",
    detail: "Reach a 10-answer streak",
    mark: "10",
    streak: 10,
  },
  {
    id: "locker-room",
    name: "Locker Room",
    detail: "Reach a 20-answer streak",
    mark: "20",
    streak: 20,
  },
  {
    id: "veteran-link",
    name: "Veteran Link",
    detail: "Reach a 30-answer streak",
    mark: "30",
    streak: 30,
  },
  {
    id: "franchise-connector",
    name: "Franchise Connector",
    detail: "Reach a 50-answer streak",
    mark: "50",
    streak: 50,
  },
];

function readBest() {
  return readStoredNumber(CHAIN_BEST_KEY);
}

export function applyChainStreak(state, streak) {
  const unlocked = new Set(state.unlocked);
  const fresh = [];

  for (const badge of CHAIN_BADGES) {
    if (unlocked.has(badge.id) || streak < badge.streak) continue;
    unlocked.add(badge.id);
    fresh.push(badge);
  }

  return {
    state: { unlocked: [...unlocked] },
    fresh,
  };
}

export function readChainBadges() {
  const known = new Set(CHAIN_BADGES.map((badge) => badge.id));
  const raw = readJsonStorage(CHAIN_BADGE_KEY);
  const unlocked = Array.isArray(raw?.unlocked) ? raw.unlocked.filter((id) => known.has(id)) : [];
  return applyChainStreak({ unlocked }, readBest()).state;
}

export function chainBadgeProgress(badge, state, best = 0) {
  if (state.unlocked.includes(badge.id)) return "Unlocked";
  return `${Math.min(best, badge.streak)} of ${badge.streak}`;
}
