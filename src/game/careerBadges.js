export const CAREER_BADGE_KEY = "nba-career-badges";
export const CAREER_BEST_KEY = "nba-career-best";

export const CAREER_BADGES = [
  {
    id: "first-steps",
    name: "First Steps",
    detail: "Get 1 correct answer in a row",
    mark: "1",
    streak: 1,
  },
  {
    id: "on-a-roll",
    name: "On a Roll",
    detail: "Reach a 5-answer streak",
    mark: "5",
    streak: 5,
  },
  {
    id: "career-expert",
    name: "Career Expert",
    detail: "Reach a 10-answer streak",
    mark: "10",
    streak: 10,
  },
  {
    id: "nba-historian",
    name: "NBA Historian",
    detail: "Reach a 20-answer streak",
    mark: "20",
    streak: 20,
  },
  {
    id: "walking-encyclopedia",
    name: "Walking Encyclopedia",
    detail: "Reach a 30-answer streak",
    mark: "30",
    streak: 30,
  },
  {
    id: "goat-knowledge",
    name: "GOAT Knowledge",
    detail: "Reach a 50-answer streak",
    mark: "50",
    streak: 50,
  },
];

function readBest() {
  try {
    const stored = Number(localStorage.getItem(CAREER_BEST_KEY));
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  } catch {
    return 0;
  }
}

export function applyCareerStreak(state, streak) {
  const unlocked = new Set(state.unlocked);
  const fresh = [];

  for (const badge of CAREER_BADGES) {
    if (unlocked.has(badge.id) || streak < badge.streak) continue;
    unlocked.add(badge.id);
    fresh.push(badge);
  }

  return {
    state: { unlocked: [...unlocked] },
    fresh,
  };
}

export function readCareerBadges() {
  const known = new Set(CAREER_BADGES.map((badge) => badge.id));
  let unlocked = [];

  try {
    const raw = JSON.parse(localStorage.getItem(CAREER_BADGE_KEY));
    if (Array.isArray(raw?.unlocked)) {
      unlocked = raw.unlocked.filter((id) => known.has(id));
    }
  } catch {
    unlocked = [];
  }

  return applyCareerStreak({ unlocked }, readBest()).state;
}

export function careerBadgeProgress(badge, state, best = 0) {
  if (state.unlocked.includes(badge.id)) return "Unlocked";
  return `${Math.min(best, badge.streak)} of ${badge.streak}`;
}
