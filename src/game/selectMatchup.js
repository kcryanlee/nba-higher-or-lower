import { CATEGORIES, statGap } from "./categories.js";
import { bandForStreak, gapInRange, widenedRange } from "./difficulty.js";

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function pairKey(categoryId, first, second) {
  const [low, high] = [first.id, second.id].sort((a, b) => a - b);
  return `${categoryId}:${low}:${high}`;
}

function hasStat(player, categoryId) {
  const value = player?.[categoryId];
  if (!Number.isFinite(value)) return false;
  if ((categoryId === "threes" || categoryId === "tpPct") && value <= 0) return false;
  return true;
}

export function collectPairs(players, category, range, blocked = new Set()) {
  const matches = [];

  for (let left = 0; left < players.length; left += 1) {
    for (let right = left + 1; right < players.length; right += 1) {
      const first = players[left];
      const second = players[right];
      if (!hasStat(first, category.id) || !hasStat(second, category.id)) continue;
      const gap = statGap(category.id, first[category.id], second[category.id]);
      if (!gapInRange(gap, range)) continue;

      const key = pairKey(category.id, first, second);
      if (blocked.has(key)) continue;
      matches.push({ first, second, gap, key });
    }
  }

  return matches;
}

function blockedKeys(usedKeys) {
  if (usedKeys instanceof Set) return usedKeys;
  if (typeof usedKeys === "string" && usedKeys) return new Set([usedKeys]);
  return new Set();
}

export function selectMatchup(players, streak, usedKeys = null) {
  const band = bandForStreak(streak);
  const blocked = blockedKeys(usedKeys);

  for (const category of shuffle(CATEGORIES)) {
    for (let step = 0; step <= 4; step += 1) {
      const range = step === 0
        ? band.gaps[category.id]
        : widenedRange(band.id, category.id, step);
      const matches = collectPairs(players, category, range, blocked);
      if (matches.length === 0) continue;

      const match = matches[Math.floor(Math.random() * matches.length)];
      const [left, right] = shuffle([match.first, match.second]);

      return {
        category,
        left,
        right,
        key: match.key,
        gap: match.gap,
        band,
      };
    }
  }

  for (const category of shuffle(CATEGORIES)) {
    const eligible = shuffle(players.filter((player) => hasStat(player, category.id)));
    for (let leftIndex = 0; leftIndex < eligible.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < eligible.length; rightIndex += 1) {
        const left = eligible[leftIndex];
        const right = eligible[rightIndex];
        const key = pairKey(category.id, left, right);
        if (blocked.has(key)) continue;
        const gap = statGap(category.id, left[category.id], right[category.id]);
        if (!(gap > 0) || left[category.id] === right[category.id]) continue;
        return {
          category,
          left,
          right,
          key,
          gap,
          band,
        };
      }
    }
  }

  return null;
}
