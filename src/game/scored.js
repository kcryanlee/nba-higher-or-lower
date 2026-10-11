import { scoredGames } from "../data/boxScores.js";
import { bandForStreak } from "./difficulty.js";
import { milestoneBanner, streakCallout } from "./feedback.js";

const BAND_ORDER = ["easy", "medium", "hard", "expert"];

export const SCORED_POSITIONS = 3;
export const SCORED_REVEAL_MS = 1500;

export function scoredPlayerImage(id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`;
}

export function formatGameDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function scoredTrioKey(gameId, ids) {
  const [first, second, third] = [...ids].sort((left, right) => left - right);
  return `${gameId}:${first}:${second}:${third}`;
}

export function positionCredit(ranking, picks) {
  if (!Array.isArray(ranking) || !Array.isArray(picks) || picks.length !== ranking.length) return 0;
  return ranking.reduce((sum, id, index) => sum + (picks[index] === id ? 1 : 0), 0);
}

export function scoredMilestoneBanner(before, after) {
  const marks = [21, 11, 50, 25, 10];
  for (const mark of marks) {
    if (before < mark && after >= mark) return milestoneBanner(mark);
  }
  return "";
}

export function scoredStreakCallout(before, after) {
  if (scoredMilestoneBanner(before, after)) return "";
  if (before < 5 && after >= 5) return streakCallout(5);
  return "";
}

function gapBand(gap) {
  if (gap >= 8) return "easy";
  if (gap >= 4) return "medium";
  if (gap >= 2) return "hard";
  return "expert";
}

function minGap(points) {
  const [low, mid, high] = [...points].sort((left, right) => left - right);
  return Math.min(mid - low, high - mid);
}

function playedLine(player) {
  return Boolean(player)
    && Number.isInteger(player.id)
    && player.id > 0
    && typeof player.name === "string"
    && player.name.trim().length > 0
    && typeof player.team === "string"
    && player.team.length > 0
    && Number.isInteger(player.pts)
    && player.pts >= 0;
}

function rosterFor(game) {
  return Array.isArray(game?.players) ? game.players.filter(playedLine) : [];
}

function gameBuckets(roster) {
  const buckets = { easy: [], medium: [], hard: [], expert: [] };
  for (let first = 0; first < roster.length; first += 1) {
    for (let second = first + 1; second < roster.length; second += 1) {
      for (let third = second + 1; third < roster.length; third += 1) {
        const chosen = [roster[first], roster[second], roster[third]];
        const points = chosen.map((player) => player.pts);
        if (new Set(points).size !== 3) continue;
        buckets[gapBand(minGap(points))].push(chosen);
      }
    }
  }
  return buckets;
}

const rosterCache = new WeakMap();

function rosterBundle(games) {
  let bundle = rosterCache.get(games);
  if (!bundle) {
    bundle = games.map((game) => ({ game, roster: rosterFor(game), buckets: null }));
    rosterCache.set(games, bundle);
  }
  return bundle;
}

function matchesFor(entry, ids) {
  if (!entry.buckets) entry.buckets = gameBuckets(entry.roster);
  if (ids.length === 1) return entry.buckets[ids[0]];
  const merged = [];
  for (const id of ids) merged.push(...entry.buckets[id]);
  return merged;
}

function blockedKeys(usedKeys) {
  if (usedKeys instanceof Set) return usedKeys;
  if (Array.isArray(usedKeys)) return new Set(usedKeys.filter((key) => typeof key === "string" && key));
  if (typeof usedKeys === "string" && usedKeys) return new Set([usedKeys]);
  return new Set();
}

function presentPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    pts: player.pts,
    image: scoredPlayerImage(player.id),
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

function bandIdsFor(bandId, step) {
  if (step >= BAND_ORDER.length) return BAND_ORDER;
  const index = BAND_ORDER.indexOf(bandId);
  const ids = [];
  for (let offset = -step; offset <= step; offset += 1) {
    const id = BAND_ORDER[index + offset];
    if (id) ids.push(id);
  }
  return ids;
}

function questionFromChosen(game, chosen, random, band) {
  if (!game || chosen.some((player) => !playedLine(player))) return null;
  if (new Set(chosen.map((player) => player.pts)).size !== 3) return null;

  const ranking = [...chosen].sort((left, right) => right.pts - left.pts || left.id - right.id);
  const shown = shuffleWith(chosen, random);
  return {
    key: scoredTrioKey(game.id, chosen.map((player) => player.id)),
    gameId: game.id,
    date: game.date,
    dateLabel: formatGameDate(game.date),
    home: game.home,
    away: game.away,
    players: shown.map(presentPlayer),
    ranking: ranking.map((player) => player.id),
    gap: minGap(chosen.map((player) => player.pts)),
    band,
  };
}

export function selectScoredQuestion(streak, options = {}) {
  const games = options.games || scoredGames;
  const random = typeof options.random === "function" ? options.random : Math.random;
  const blocked = blockedKeys(options.usedKeys);
  const band = bandForStreak(streak);
  const bundle = rosterBundle(games);
  if (bundle.length === 0) return null;

  for (let step = 0; step <= BAND_ORDER.length; step += 1) {
    const ids = bandIdsFor(band.id, step);
    const attempts = Math.min(bundle.length * 2, 32);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const entry = bundle[Math.floor(random() * bundle.length)];
      const matches = matchesFor(entry, ids);
      if (matches.length === 0) continue;
      const question = questionFromChosen(
        entry.game,
        matches[Math.floor(random() * matches.length)],
        random,
        band,
      );
      if (!question || blocked.has(question.key)) continue;
      return question;
    }
  }

  return null;
}

export function questionFromSaved(gameId, playerIds, streak = 0, games = scoredGames) {
  if (typeof gameId !== "string" || !Array.isArray(playerIds) || playerIds.length !== SCORED_POSITIONS) return null;
  if (new Set(playerIds).size !== SCORED_POSITIONS) return null;
  const game = games.find((item) => item.id === gameId);
  if (!game) return null;
  const players = playerIds.map((id) => game.players.find((player) => player.id === id));
  if (players.some((player) => !playedLine(player))) return null;
  if (players.some((player) => player.team !== game.home && player.team !== game.away)) return null;
  if (new Set(players.map((player) => player.pts)).size !== SCORED_POSITIONS) return null;

  const ranking = [...players].sort((left, right) => right.pts - left.pts || left.id - right.id);
  return {
    key: scoredTrioKey(game.id, players.map((player) => player.id)),
    gameId: game.id,
    date: game.date,
    dateLabel: formatGameDate(game.date),
    home: game.home,
    away: game.away,
    players: players.map(presentPlayer),
    ranking: ranking.map((player) => player.id),
    gap: minGap(players.map((player) => player.pts)),
    band: bandForStreak(streak),
  };
}
