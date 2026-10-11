import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { teamLogoUrl } from "../src/game/teams.js";

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary";
const PROGRESS = new URL("../.cache/box-scores-progress.json", import.meta.url);
const OUTPUT = new URL("../src/data/boxScores.json", import.meta.url);
const SEASON = "2025-26";
const FIRST_SLATE = "2025-10-21";

const ALIASES = {
  "LA Clippers": "Los Angeles Clippers",
};

function canonicalTeam(name) {
  if (typeof name !== "string") return null;
  const next = ALIASES[name] || name;
  return teamLogoUrl(next) ? next : null;
}

function slateKey(value) {
  return String(value).slice(0, 10);
}

function parseMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim() || value === "--" || value === "—") return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text);
  const clock = /^(\d+):(\d{2})$/.exec(text);
  if (!clock) return null;
  return Number(clock[1]) * 60 + Number(clock[2]);
}

function parsePoints(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

async function fetchJson(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function readProgress() {
  try {
    const saved = JSON.parse(readFileSync(PROGRESS, "utf8"));
    if (!saved || !Array.isArray(saved.games) || typeof saved.names !== "object") return null;
    return saved;
  } catch {
    return null;
  }
}

function writeProgress(progress) {
  mkdirSync(new URL("../.cache/", import.meta.url), { recursive: true });
  writeFileSync(PROGRESS, JSON.stringify(progress));
}

function parseSummary(data, slateDate) {
  const competition = data?.header?.competitions?.[0];
  const status = competition?.status?.type?.name;
  if (status !== "STATUS_FINAL") return { error: "not-final" };
  const competitors = competition.competitors || [];
  const home = competitors.find((team) => team.homeAway === "home");
  const away = competitors.find((team) => team.homeAway === "away");
  const homeName = canonicalTeam(home?.team?.displayName);
  const awayName = canonicalTeam(away?.team?.displayName);
  if (!homeName || !awayName) return { error: "unknown-team", home: home?.team?.displayName, away: away?.team?.displayName };
  const homeScore = Number(home.score);
  const awayScore = Number(away.score);
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return { error: "bad-score" };

  const sides = data?.boxscore?.players;
  if (!Array.isArray(sides) || sides.length !== 2) return { error: "missing-box" };
  const lines = [];
  const names = {};
  const seen = new Set();

  for (const side of sides) {
    const teamName = canonicalTeam(side?.team?.displayName);
    const sideFlag = teamName === homeName ? 1 : teamName === awayName ? 0 : null;
    if (sideFlag == null) return { error: "box-team", team: side?.team?.displayName };
    const block = side.statistics?.[0];
    const labels = block?.labels || [];
    const minuteIndex = labels.indexOf("MIN");
    const pointIndex = labels.indexOf("PTS");
    if (minuteIndex < 0 || pointIndex < 0) return { error: "missing-labels" };

    for (const row of block.athletes || []) {
      if (row?.didNotPlay) continue;
      const stats = row.stats;
      if (!Array.isArray(stats)) return { error: "missing-line" };
      const minutes = parseMinutes(stats[minuteIndex]);
      const points = parsePoints(stats[pointIndex]);
      const blankMinutes = stats[minuteIndex] === "--" || stats[minuteIndex] === "—";
      if (minutes == null && points === 0 && blankMinutes) continue;
      if (minutes == null || points == null) return { error: "unreadable-line", stats };
      if (minutes <= 0) continue;
      const id = Number(row.athlete?.id);
      const name = typeof row.athlete?.displayName === "string" ? row.athlete.displayName.trim() : "";
      if (!Number.isInteger(id) || id <= 0 || !name) return { error: "bad-player" };
      if (seen.has(id)) return { error: "duplicate-player" };
      seen.add(id);
      names[id] = name;
      lines.push([id, sideFlag, points]);
    }
  }

  const awayPoints = lines.filter((line) => line[1] === 0).reduce((sum, line) => sum + line[2], 0);
  const homePoints = lines.filter((line) => line[1] === 1).reduce((sum, line) => sum + line[2], 0);
  if (awayPoints !== awayScore || homePoints !== homeScore) {
    return {
      error: "score-mismatch",
      expected: [awayScore, homeScore],
      actual: [awayPoints, homePoints],
    };
  }
  if (lines.length < 2) return { error: "too-few-players" };
  const id = String(data.header?.id || competition.id || "");
  if (!/^\d+$/.test(id)) return { error: "bad-game-id" };

  return {
    game: {
      id,
      date: slateDate,
      away: awayName,
      home: homeName,
      awayScore,
      homeScore,
      lines,
    },
    names,
  };
}

const calendar = await fetchJson(`${SCOREBOARD}?dates=20260412`);
const dates = [...new Set((calendar?.leagues?.[0]?.calendar || []).map(slateKey))]
  .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= FIRST_SLATE && date <= "2026-06-30")
  .sort();

console.log(`Slate dates: ${dates.length}`);
const boards = await mapPool(dates, 6, async (date) => {
  const data = await fetchJson(`${SCOREBOARD}?dates=${date.replaceAll("-", "")}`);
  const events = [];
  for (const event of data.events || []) {
    const seasonType = event.season?.type;
    const completed = event.status?.type?.completed === true || event.status?.type?.name === "STATUS_FINAL";
    if (!completed || (seasonType !== 2 && seasonType !== 3)) continue;
    if (!/^\d+$/.test(String(event.id))) continue;
    events.push({ id: String(event.id), date });
  }
  return events;
});

const events = [];
const seenEvents = new Set();
for (const day of boards) {
  for (const event of day) {
    if (seenEvents.has(event.id)) continue;
    seenEvents.add(event.id);
    events.push(event);
  }
}
console.log(`Final games listed: ${events.length}`);

const progress = readProgress() || { games: [], names: {}, rejected: {} };
const done = new Set(progress.games.map((game) => game.id));
const pending = events.filter((event) => !done.has(event.id));
console.log(`Already saved: ${done.size}. Remaining: ${pending.length}`);

let finished = 0;
await mapPool(pending, 5, async (event) => {
  const data = await fetchJson(`${SUMMARY}?event=${event.id}`);
  const parsed = parseSummary(data, event.date);
  if (parsed.game) {
    progress.games.push(parsed.game);
    Object.assign(progress.names, parsed.names);
  } else {
    const reason = parsed.error || "unknown";
    progress.rejected[reason] = (progress.rejected[reason] || 0) + 1;
    if (reason === "score-mismatch" || reason === "unknown-team" || reason === "unreadable-line") {
      console.log("Rejected", event.id, event.date, JSON.stringify(parsed));
    }
  }
  finished += 1;
  if (finished % 40 === 0) {
    writeProgress(progress);
    console.log(`Parsed ${finished}/${pending.length}`);
  }
});

progress.games.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const payload = {
  source: "ESPN public NBA box score API",
  endpoint: SUMMARY,
  season: SEASON,
  retrieved: "2026-10-11",
  names: progress.names,
  games: progress.games,
};
writeFileSync(OUTPUT, JSON.stringify(payload));
writeProgress(progress);
console.log(`Wrote ${progress.games.length} games to src/data/boxScores.json`);
console.log("Rejected", progress.rejected);
