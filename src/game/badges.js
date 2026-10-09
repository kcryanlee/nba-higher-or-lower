export const BADGE_KEY = "nba-hol-badges";
const BEST_KEY = "nba-hol-best";

const COUNT_KEYS = [
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "fgPct",
  "tpPct",
  "ftPct",
  "salary",
  "heightIn",
  "threes",
  "careerPoints",
];

export const BADGES = [
  {
    id: "streak-10",
    name: "10 Streak",
    detail: "Reach a best streak of 10",
    mark: "10",
    kind: "streak",
    streak: 10,
  },
  {
    id: "streak-25",
    name: "25 Streak",
    detail: "Reach a best streak of 25",
    mark: "25",
    kind: "streak",
    streak: 25,
  },
  {
    id: "streak-50",
    name: "50 Streak",
    detail: "Reach a best streak of 50",
    mark: "50",
    kind: "streak",
    streak: 50,
  },
  {
    id: "salary",
    name: "Salary Expert",
    detail: "Answer 25 salary questions correctly",
    mark: "$",
    kind: "category",
    categoryId: "salary",
    goal: 25,
  },
  {
    id: "threes",
    name: "Three-Point Master",
    detail: "Answer 25 three-point questions correctly",
    mark: "3PT",
    kind: "category",
    categoryId: "threes",
    goal: 25,
  },
  {
    id: "career-points",
    name: "Career Points Expert",
    detail: "Answer 25 career-points questions correctly",
    mark: "PTS",
    kind: "category",
    categoryId: "careerPoints",
    goal: 25,
  },
  {
    id: "height",
    name: "Height Master",
    detail: "Answer 25 height questions correctly",
    mark: "HT",
    kind: "category",
    categoryId: "heightIn",
    goal: 25,
  },
  {
    id: "rpg",
    name: "Rebounding Expert",
    detail: "Answer 25 rebounding questions correctly",
    mark: "REB",
    kind: "category",
    categoryId: "rpg",
    goal: 25,
  },
  {
    id: "apg",
    name: "Assist Master",
    detail: "Answer 25 assist questions correctly",
    mark: "AST",
    kind: "category",
    categoryId: "apg",
    goal: 25,
  },
  {
    id: "defense",
    name: "Defensive Specialist",
    detail: "Answer 25 steal or block questions correctly",
    mark: "DEF",
    kind: "group",
    categoryIds: ["spg", "bpg"],
    goal: 25,
  },
  {
    id: "fg",
    name: "Shooting Efficiency Expert",
    detail: "Answer 25 field-goal percentage questions correctly",
    mark: "FG",
    kind: "category",
    categoryId: "fgPct",
    goal: 25,
  },
  {
    id: "tp-pct",
    name: "Three-Point Accuracy Master",
    detail: "Answer 25 three-point percentage questions correctly",
    mark: "3%",
    kind: "category",
    categoryId: "tpPct",
    goal: 25,
  },
  {
    id: "ft",
    name: "Free Throw Expert",
    detail: "Answer 25 free-throw percentage questions correctly",
    mark: "FT",
    kind: "category",
    categoryId: "ftPct",
    goal: 25,
  },
  {
    id: "all-rounder",
    name: "All-Rounder",
    detail: "Answer at least 10 questions correctly in every category",
    mark: "ALL",
    kind: "all-rounder",
    goal: 10,
  },
  {
    id: "hard-survivor",
    name: "Hard Mode Survivor",
    detail: "Get 10 correct answers on Hard difficulty",
    mark: "HRD",
    kind: "hard",
    goal: 10,
  },
  {
    id: "expert-survivor",
    name: "Expert Mode Survivor",
    detail: "Get 10 correct answers on Expert difficulty",
    mark: "EXP",
    kind: "expert",
    goal: 10,
  },
  {
    id: "daily-grinder",
    name: "Daily Grinder",
    detail: "Complete the Daily Challenge 7 days in a row",
    mark: "7D",
    kind: "grinder",
    goal: 7,
  },
  {
    id: "monthly-regular",
    name: "Monthly Regular",
    detail: "Complete the Daily Challenge on 20 different days in one month",
    mark: "20D",
    kind: "monthly",
    goal: 20,
  },
];

const KEPT_WHEN_SAVED = new Set(["daily-grinder", "monthly-regular"]);

export function emptyBadgeState() {
  return {
    unlocked: [],
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])),
    hardCorrect: 0,
    expertCorrect: 0,
  };
}

function readBest() {
  try {
    const stored = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  } catch {
    return 0;
  }
}

function whole(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function meets(state, badge, event = {}) {
  if (badge.kind === "streak") return event.best >= badge.streak;
  if (badge.kind === "category") return state.counts[badge.categoryId] >= badge.goal;
  if (badge.kind === "group") {
    const total = badge.categoryIds.reduce((sum, id) => sum + state.counts[id], 0);
    return total >= badge.goal;
  }
  if (badge.kind === "all-rounder") {
    return COUNT_KEYS.every((key) => state.counts[key] >= badge.goal);
  }
  if (badge.kind === "hard") return state.hardCorrect >= badge.goal;
  if (badge.kind === "expert") return state.expertCorrect >= badge.goal;
  if (badge.kind === "grinder") return event.dailyStreak >= badge.goal;
  if (badge.kind === "monthly") return event.monthCount >= badge.goal;
  return false;
}

function withUnlocks(state, event = {}) {
  const unlocked = new Set(state.unlocked);
  const fresh = [];

  for (const badge of BADGES) {
    if (unlocked.has(badge.id) || !meets(state, badge, event)) continue;
    unlocked.add(badge.id);
    fresh.push(badge);
  }

  return {
    state: { ...state, unlocked: [...unlocked] },
    fresh,
  };
}

export function readBadgeState() {
  const empty = emptyBadgeState();
  try {
    const raw = JSON.parse(localStorage.getItem(BADGE_KEY));
    if (!raw || typeof raw !== "object") return withUnlocks(empty, { best: readBest() }).state;
    const known = new Set(BADGES.map((badge) => badge.id));
    const counts = { ...empty.counts };
    for (const key of COUNT_KEYS) counts[key] = whole(raw.counts?.[key]);
    const saved = Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => known.has(id)) : [];
    const state = {
      unlocked: saved.filter((id) => KEPT_WHEN_SAVED.has(id)),
      counts,
      hardCorrect: whole(raw.hardCorrect),
      expertCorrect: whole(raw.expertCorrect),
    };
    return withUnlocks(state, { best: readBest() }).state;
  } catch {
    return withUnlocks(empty, { best: readBest() }).state;
  }
}

export function applyAnswer(state, event) {
  if (!event.correct) return { state, fresh: [] };

  const counts = { ...state.counts };
  if (Object.hasOwn(counts, event.categoryId)) counts[event.categoryId] += 1;

  return withUnlocks({
    ...state,
    counts,
    hardCorrect: state.hardCorrect + (event.bandId === "hard" ? 1 : 0),
    expertCorrect: state.expertCorrect + (event.bandId === "expert" ? 1 : 0),
  }, event);
}

export function applyDailyCompletion(state, event) {
  return withUnlocks(state, event);
}

export function badgeProgress(badge, state, { best = 0, dailyStreak = 0, monthCount = 0 } = {}) {
  if (state.unlocked.includes(badge.id)) return "Unlocked";
  if (badge.kind === "streak") {
    return `${Math.min(best, badge.streak)} of ${badge.streak}`;
  }
  if (badge.kind === "category") {
    return `${Math.min(state.counts[badge.categoryId], badge.goal)} of ${badge.goal}`;
  }
  if (badge.kind === "group") {
    const total = badge.categoryIds.reduce((sum, id) => sum + state.counts[id], 0);
    return `${Math.min(total, badge.goal)} of ${badge.goal}`;
  }
  if (badge.kind === "all-rounder") {
    const ready = COUNT_KEYS.filter((key) => state.counts[key] >= badge.goal).length;
    return `${ready} of ${COUNT_KEYS.length}`;
  }
  if (badge.kind === "hard") {
    return `${Math.min(state.hardCorrect, badge.goal)} of ${badge.goal}`;
  }
  if (badge.kind === "expert") {
    return `${Math.min(state.expertCorrect, badge.goal)} of ${badge.goal}`;
  }
  if (badge.kind === "grinder") {
    return `${Math.min(dailyStreak, badge.goal)} of ${badge.goal} days`;
  }
  return `${Math.min(monthCount, badge.goal)} of ${badge.goal} days`;
}
