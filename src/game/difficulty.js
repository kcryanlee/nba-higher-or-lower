const BAND_ORDER = ["easy", "medium", "hard", "expert"];

export const BANDS = {
  easy: {
    id: "easy",
    label: "Easy",
    minStreak: 0,
    maxStreak: 5,
    gaps: {
      ppg: { min: 8, max: Infinity },
      rpg: { min: 4, max: Infinity },
      apg: { min: 4, max: Infinity },
      spg: { min: 0.8, max: Infinity },
      bpg: { min: 1, max: Infinity },
      fgPct: { min: 8, max: Infinity },
      tpPct: { min: 8, max: Infinity },
      ftPct: { min: 12, max: Infinity },
      salary: { min: 20_000_000, max: Infinity },
      heightIn: { min: 6, max: Infinity },
      threes: { min: 800, max: Infinity },
      careerPoints: { min: 8_000, max: Infinity },
    },
  },
  medium: {
    id: "medium",
    label: "Medium",
    minStreak: 6,
    maxStreak: 10,
    gaps: {
      ppg: { min: 3.5, max: 8 },
      rpg: { min: 1.5, max: 4 },
      apg: { min: 1.5, max: 4 },
      spg: { min: 0.4, max: 0.8 },
      bpg: { min: 0.5, max: 1 },
      fgPct: { min: 4, max: 8 },
      tpPct: { min: 4, max: 8 },
      ftPct: { min: 6, max: 12 },
      salary: { min: 8_000_000, max: 20_000_000 },
      heightIn: { min: 3, max: 6 },
      threes: { min: 300, max: 800 },
      careerPoints: { min: 3_000, max: 8_000 },
    },
  },
  hard: {
    id: "hard",
    label: "Hard",
    minStreak: 11,
    maxStreak: 20,
    gaps: {
      ppg: { min: 1.2, max: 3.5 },
      rpg: { min: 0.6, max: 1.5 },
      apg: { min: 0.6, max: 1.5 },
      spg: { min: 0.2, max: 0.4 },
      bpg: { min: 0.2, max: 0.5 },
      fgPct: { min: 1.5, max: 4 },
      tpPct: { min: 1.5, max: 4 },
      ftPct: { min: 2, max: 6 },
      salary: { min: 2_000_000, max: 8_000_000 },
      heightIn: { min: 2, max: 3 },
      threes: { min: 80, max: 300 },
      careerPoints: { min: 800, max: 3_000 },
    },
  },
  expert: {
    id: "expert",
    label: "Expert",
    minStreak: 21,
    maxStreak: Infinity,
    gaps: {
      ppg: { min: 0.2, max: 1.2 },
      rpg: { min: 0.2, max: 0.6 },
      apg: { min: 0.2, max: 0.6 },
      spg: { min: 0.1, max: 0.2 },
      bpg: { min: 0.1, max: 0.2 },
      fgPct: { min: 0.3, max: 1.5 },
      tpPct: { min: 0.4, max: 1.5 },
      ftPct: { min: 0.4, max: 2 },
      salary: { min: 100_000, max: 2_000_000 },
      heightIn: { min: 1, max: 2 },
      threes: { min: 15, max: 80 },
      careerPoints: { min: 100, max: 800 },
    },
  },
};

export function bandForStreak(streak) {
  if (streak >= 21) return BANDS.expert;
  if (streak >= 11) return BANDS.hard;
  if (streak >= 6) return BANDS.medium;
  return BANDS.easy;
}

const TIGHT_TO_WIDE = ["expert", "hard", "medium", "easy"];

export function bandForGap(categoryId, gap) {
  for (const id of TIGHT_TO_WIDE) {
    if (gapInRange(gap, BANDS[id].gaps[categoryId])) return BANDS[id];
  }
  return BANDS.expert;
}

export function higherBandId(current, next) {
  if (!current) return next;
  return TIGHT_TO_WIDE.indexOf(next) < TIGHT_TO_WIDE.indexOf(current) ? next : current;
}

export function gapInRange(gap, range) {
  return gap > 0 && gap >= range.min && gap < range.max;
}

export function widenedRange(bandId, categoryId, step) {
  if (step >= BAND_ORDER.length) {
    return { min: 0, max: Infinity };
  }

  const index = BAND_ORDER.indexOf(bandId);
  let min = Infinity;
  let max = 0;

  for (let offset = -step; offset <= step; offset += 1) {
    const neighbor = BANDS[BAND_ORDER[index + offset]];
    if (!neighbor) continue;
    const range = neighbor.gaps[categoryId];
    min = Math.min(min, range.min);
    max = Math.max(max, range.max);
  }

  return { min, max };
}
