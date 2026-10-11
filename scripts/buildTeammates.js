import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SEARCH = "https://site.api.espn.com/apis/common/v3/search";
const SEARCH_V2 = "https://site.web.api.espn.com/apis/search/v2";
const STATS = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes";
const PLAYERS = new URL("../src/data/players.json", import.meta.url);
const OUTPUT = new URL("../src/data/teammateSeasons.json", import.meta.url);
const CACHE = new URL("../.cache/teammate-fetch.json", import.meta.url);
const NBA_CACHE = new URL("../.cache/teammate-nba-logs.json", import.meta.url);
const NBA_LOG = "https://stats.nba.com/stats/playergamelog";
const SEASON = /^\d{4}-\d{2}$/;
const ABBR_TO_SLUG = {
  ATL: "atlanta-hawks",
  BKN: "brooklyn-nets",
  BOS: "boston-celtics",
  BRK: "brooklyn-nets",
  CHA: "charlotte-hornets",
  CHH: "charlotte-hornets",
  CHI: "chicago-bulls",
  CHO: "charlotte-hornets",
  CLE: "cleveland-cavaliers",
  DAL: "dallas-mavericks",
  DEN: "denver-nuggets",
  DET: "detroit-pistons",
  GSW: "golden-state-warriors",
  HOU: "houston-rockets",
  IND: "indiana-pacers",
  LAC: "la-clippers",
  LAL: "los-angeles-lakers",
  MEM: "memphis-grizzlies",
  MIA: "miami-heat",
  MIL: "milwaukee-bucks",
  MIN: "minnesota-timberwolves",
  NJN: "new-jersey-nets",
  NOH: "new-orleans-hornets",
  NOK: "new-orleans-hornets",
  NOP: "new-orleans-pelicans",
  NYK: "new-york-knicks",
  OKC: "oklahoma-city-thunder",
  ORL: "orlando-magic",
  PHI: "philadelphia-76ers",
  PHL: "philadelphia-76ers",
  PHO: "phoenix-suns",
  PHX: "phoenix-suns",
  POR: "portland-trail-blazers",
  SAC: "sacramento-kings",
  SAS: "san-antonio-spurs",
  SEA: "seattle-supersonics",
  TOR: "toronto-raptors",
  UTA: "utah-jazz",
  WAS: "washington-wizards",
};
const MONTHS = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const roster = JSON.parse(readFileSync(PLAYERS, "utf8")).players;

function readCache() {
  try {
    const saved = JSON.parse(readFileSync(CACHE, "utf8"));
    if (!saved || typeof saved.resolved !== "object" || typeof saved.stats !== "object") return { resolved: {}, stats: {} };
    return saved;
  } catch {
    return { resolved: {}, stats: {} };
  }
}

function readNbaCache() {
  try {
    const saved = JSON.parse(readFileSync(NBA_CACHE, "utf8"));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function writeNbaCache(cache) {
  mkdirSync(new URL("../.cache/", import.meta.url), { recursive: true });
  writeFileSync(NBA_CACHE, JSON.stringify(cache));
}

function publishedDate(text) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(text || "");
  if (!match || !MONTHS[match[1]]) return null;
  return `${match[3]}-${MONTHS[match[1]]}-${match[2].padStart(2, "0")}`;
}

function minutesPlayed(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (text.includes(":")) {
    const [minutes, seconds] = text.split(":");
    return Number(minutes) + Number(seconds || 0) / 60;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function logFromNba(data) {
  const set = (data?.resultSets || []).find((item) => item?.name === "PlayerGameLog");
  if (!set || !Array.isArray(set.headers) || !Array.isArray(set.rowSet)) return { error: "missing-game-log" };
  const dateIndex = set.headers.indexOf("GAME_DATE");
  const matchIndex = set.headers.indexOf("MATCHUP");
  const minutesIndex = set.headers.indexOf("MIN");
  if (dateIndex < 0 || matchIndex < 0 || minutesIndex < 0) return { error: "missing-columns" };
  const byAbbr = {};
  for (const row of set.rowSet) {
    if (minutesPlayed(row?.[minutesIndex]) <= 0) continue;
    const abbr = String(row?.[matchIndex] || "").split(" ")[0];
    const date = publishedDate(row?.[dateIndex]);
    if (!abbr || !date) return { error: `unreadable-row ${row?.[matchIndex]} ${row?.[dateIndex]}` };
    if (!byAbbr[abbr]) byAbbr[abbr] = [];
    if (byAbbr[abbr].includes(date)) return { error: `duplicate-date ${abbr} ${date}` };
    byAbbr[abbr].push(date);
  }
  if (!Object.keys(byAbbr).length) return { error: "no-games" };
  return { byAbbr };
}

function spansFromDates(dates, otherDates) {
  const mine = [...dates].sort();
  const spans = [];
  let start = mine[0];
  let previous = mine[0];
  for (let index = 1; index < mine.length; index += 1) {
    const date = mine[index];
    const interrupted = otherDates.some((other) => other > previous && other < date);
    if (interrupted) {
      spans.push({ start, end: previous });
      start = date;
    }
    previous = date;
  }
  spans.push({ start, end: previous });
  return spans;
}

function writeCache(cache) {
  mkdirSync(new URL("../.cache/", import.meta.url), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));
}

async function fetchJson(url, extraHeaders = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(20000),
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

function exactNbaHits(data, name) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((item) => item?.league === "nba" && item?.displayName === name && /^\d+$/.test(String(item.id)));
}

function searchV2Hits(data, name) {
  const contents = data?.results?.find((result) => result?.type === "player")?.contents || [];
  return contents.flatMap((item) => {
    const match = /^s:40~l:46~a:(\d+)$/.exec(item?.uid || "");
    if (!match || item.displayName !== name) return [];
    return [{ espnId: Number(match[1]), name: item.displayName, label: `${item.displayName} [${item.subtitle || "NBA"}] #${match[1]}` }];
  });
}

async function resolvePlayer(player) {
  const data = await fetchJson(`${SEARCH}?query=${encodeURIComponent(player.name)}&limit=10&type=player`);
  const hits = exactNbaHits(data, player.name);
  if (hits.length === 1) {
    return { espnId: Number(hits[0].id), name: hits[0].displayName };
  }
  const fallback = await fetchJson(`${SEARCH_V2}?query=${encodeURIComponent(player.name)}&limit=8&type=player`);
  const retired = searchV2Hits(fallback, player.name);
  if (retired.length === 1) return { espnId: retired[0].espnId, name: retired[0].name };
  const items = Array.isArray(data?.items) ? data.items : [];
  const nba = [
    ...items
      .filter((item) => item?.sport === "basketball" || item?.league === "nba")
      .slice(0, 6)
      .map((item) => `${item.displayName} [${item.league || item.sport}] #${item.id}`),
    ...retired.map((item) => item.label),
  ];
  return {
    error: hits.length > 1 || retired.length > 1 ? "ambiguous" : "unmatched",
    candidates: nba,
  };
}

function stintsFromStats(data) {
  const category = (data?.categories || []).find((item) => item?.name === "averages");
  if (!category) return { error: "missing-averages" };
  const gamesIndex = (category.names || []).indexOf("gamesPlayed");
  if (gamesIndex < 0) return { error: "missing-games" };
  const teams = data.teams && typeof data.teams === "object" ? data.teams : {};
  const stints = [];
  const seen = new Set();

  for (const row of category.statistics || []) {
    const slug = typeof row?.teamSlug === "string" ? row.teamSlug : "";
    const season = row?.season?.displayName;
    if (!slug || /totals/i.test(slug)) continue;
    const team = teams[slug];
    if (!team || typeof team.displayName !== "string" || !team.displayName.trim()) continue;
    if (typeof season !== "string" || !SEASON.test(season)) continue;
    const games = Number(row.stats?.[gamesIndex]);
    if (!Number.isInteger(games) || games <= 0) continue;
    const key = `${season}|${slug}`;
    if (seen.has(key)) return { error: `duplicate-stint ${key}` };
    seen.add(key);
    stints.push({
      season,
      team: team.displayName.trim(),
      slug,
      games,
    });
  }

  stints.sort((left, right) => left.season.localeCompare(right.season) || left.slug.localeCompare(right.slug));
  if (!stints.length) return { error: "no-stints" };
  return { stints };
}

const cache = readCache();
for (const player of roster) {
  if (cache.resolved[player.id] && !cache.resolved[player.id].espnId) delete cache.resolved[player.id];
}
const pendingResolve = roster.filter((player) => !cache.resolved[player.id]);
console.log(`Resolving ${pendingResolve.length} player identities...`);
await mapPool(pendingResolve, 5, async (player) => {
  const resolved = await resolvePlayer(player);
  cache.resolved[player.id] = resolved;
  writeCache(cache);
  console.log(resolved.espnId ? `id ${player.name} -> ${resolved.espnId}` : `?? ${player.name} ${resolved.error} ${resolved.candidates.join(" | ")}`);
});

const pendingStats = roster.filter((player) => cache.resolved[player.id]?.espnId && !cache.stats[player.id]);
console.log(`Fetching ${pendingStats.length} season logs...`);
await mapPool(pendingStats, 5, async (player) => {
  const espnId = cache.resolved[player.id].espnId;
  try {
    const data = await fetchJson(`${STATS}/${espnId}/stats?seasontype=2`);
    const parsed = stintsFromStats(data);
    cache.stats[player.id] = parsed.stints ? { stints: parsed.stints } : { error: parsed.error };
  } catch (error) {
    cache.stats[player.id] = { error: error.message };
  }
  writeCache(cache);
  const saved = cache.stats[player.id];
  console.log(saved.stints ? `stints ${player.name} ${saved.stints.length}` : `!! ${player.name} ${saved.error}`);
});

const players = [];
const unresolved = [];
for (const player of roster) {
  const identity = cache.resolved[player.id];
  const stats = cache.stats[player.id];
  if (!identity?.espnId || !stats?.stints) {
    unresolved.push({
      id: player.id,
      name: player.name,
      reason: identity?.error || stats?.error || "missing",
      candidates: identity?.candidates || [],
    });
    continue;
  }
  players.push({
    id: player.id,
    espnId: identity.espnId,
    name: player.name,
    stints: stats.stints,
  });
}

players.sort((left, right) => left.id - right.id);

const nbaCache = readNbaCache();
const nbaHeaders = {
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};
const dateJobs = [];
for (const player of players) {
  for (const season of new Set(player.stints.map((stint) => stint.season))) {
    const key = `${player.id}|${season}`;
    if (!nbaCache[key] || nbaCache[key].error) dateJobs.push({ player, season, key });
  }
}
console.log(`Fetching ${dateJobs.length} NBA regular-season game logs...`);
let dateWrites = 0;
await mapPool(dateJobs, 4, async (job) => {
  const url = `${NBA_LOG}?PlayerID=${job.player.id}&Season=${encodeURIComponent(job.season)}&SeasonType=${encodeURIComponent("Regular Season")}`;
  try {
    const data = await fetchJson(url, nbaHeaders);
    const parsed = logFromNba(data);
    nbaCache[job.key] = parsed.byAbbr ? { byAbbr: parsed.byAbbr } : { error: parsed.error };
    if (!parsed.byAbbr) console.log(`!! dates ${job.player.name} ${job.season} ${parsed.error}`);
  } catch (error) {
    nbaCache[job.key] = { error: error.message };
    console.log(`!! dates ${job.player.name} ${job.season} ${error.message}`);
  }
  dateWrites += 1;
  if (dateWrites % 40 === 0) {
    writeNbaCache(nbaCache);
    console.log(`dated ${dateWrites}/${dateJobs.length}`);
  }
});
writeNbaCache(nbaCache);

const problems = [];
let splitStints = 0;
for (const player of players) {
  const bySeason = new Map();
  for (const stint of player.stints) {
    if (!bySeason.has(stint.season)) bySeason.set(stint.season, []);
    bySeason.get(stint.season).push(stint);
  }
  for (const [season, stints] of bySeason) {
    const saved = nbaCache[`${player.id}|${season}`];
    if (!saved?.byAbbr) {
      problems.push(`${player.name} ${season}: ${saved?.error || "missing game log"}`);
      continue;
    }
    const slugDates = new Map();
    for (const [abbr, dates] of Object.entries(saved.byAbbr)) {
      const slug = ABBR_TO_SLUG[abbr];
      if (!slug) {
        problems.push(`${player.name} ${season}: unknown team ${abbr}`);
        continue;
      }
      if (!stints.some((stint) => stint.slug === slug)) {
        problems.push(`${player.name} ${season}: ${abbr} is not one of ${stints.map((stint) => stint.slug).join(", ")}`);
        continue;
      }
      if (slugDates.has(slug)) {
        const existing = slugDates.get(slug);
        for (const date of dates) {
          if (existing.includes(date)) {
            problems.push(`${player.name} ${season}: ${abbr} repeats ${date} on ${slug}`);
            continue;
          }
          existing.push(date);
        }
        continue;
      }
      slugDates.set(slug, [...dates]);
    }
    const otherDates = (slug) => [...slugDates.entries()].filter(([key]) => key !== slug).flatMap(([, dates]) => dates);
    for (const stint of stints) {
      const dates = slugDates.get(stint.slug);
      if (!dates) {
        problems.push(`${player.name} ${season} ${stint.slug}: no appearances in the game log`);
        continue;
      }
      if (dates.length !== stint.games) {
        problems.push(`${player.name} ${season} ${stint.slug}: stats ${stint.games} games, game log ${dates.length}`);
        continue;
      }
      const spans = spansFromDates(dates, otherDates(stint.slug));
      stint.start = spans[0].start;
      stint.end = spans[spans.length - 1].end;
      stint.spans = spans;
      if (spans.length > 1) splitStints += 1;
    }
  }
}
if (problems.length) {
  console.error(`Could not date ${problems.length} player seasons.`);
  for (const line of problems) console.error(`- ${line}`);
  process.exit(1);
}

const payload = {
  source: "ESPN public NBA player statistics API, with regular-season appearance dates from the NBA stats player game log",
  endpoint: `${STATS}/{espnId}/stats?seasontype=2`,
  gamelogEndpoint: `${NBA_LOG}?PlayerID={playerId}&Season={season}&SeasonType=Regular%20Season`,
  searchEndpoint: `${SEARCH_V2}?type=player`,
  retrieved: "2026-10-11",
  seasonType: "regular",
  rule: "Two players are teammates only when each has a regular-season appearance for the same NBA team and those appearance dates overlap. Sharing a team and season is not enough when one player arrived after the other had already left. Dates are the published calendar dates of each regular-season game. A same-season return to a team is a separate stint when games for another team fall between appearances. Combined season total rows are omitted. Playoff-only stints, G League stints, and roster spots with no appearance are not included.",
  players,
  unresolved,
};

writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${players.length} players, ${unresolved.length} unresolved, ${splitStints} same-season returns split.`);
if (unresolved.length) {
  for (const item of unresolved) console.log(`- ${item.name}: ${item.reason} ${item.candidates.join(" | ")}`);
}
