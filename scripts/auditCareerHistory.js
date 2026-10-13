import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { careerFingerprint } from "../src/data/careerVerification.js";

const PLAYERS = new URL("../src/data/players.json", import.meta.url);
const HISTORY = new URL("../src/data/careerHistory.json", import.meta.url);
const TEAMMATES = new URL("../src/data/teammateSeasons.json", import.meta.url);
const OUTPUT = new URL("../src/data/careerVerification.json", import.meta.url);
const CACHE = new URL("../.cache/nba-expand/", import.meta.url);
const NBA_CAREER = "https://stats.nba.com/stats/playercareerstats";
const NBA_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};
const ROSTER_SEASON_START = 2026;
const WRITE = process.argv.includes("--write");

// NBA franchise ids. Seasons played under an earlier name or city count toward the current franchise.
const FRANCHISES = {
  1610612737: "Atlanta Hawks",
  1610612738: "Boston Celtics",
  1610612739: "Cleveland Cavaliers",
  1610612740: "New Orleans Pelicans",
  1610612741: "Chicago Bulls",
  1610612742: "Dallas Mavericks",
  1610612743: "Denver Nuggets",
  1610612744: "Golden State Warriors",
  1610612745: "Houston Rockets",
  1610612746: "Los Angeles Clippers",
  1610612747: "Los Angeles Lakers",
  1610612748: "Miami Heat",
  1610612749: "Milwaukee Bucks",
  1610612750: "Minnesota Timberwolves",
  1610612751: "Brooklyn Nets",
  1610612752: "New York Knicks",
  1610612753: "Orlando Magic",
  1610612754: "Indiana Pacers",
  1610612755: "Philadelphia 76ers",
  1610612756: "Phoenix Suns",
  1610612757: "Portland Trail Blazers",
  1610612758: "Sacramento Kings",
  1610612759: "San Antonio Spurs",
  1610612760: "Oklahoma City Thunder",
  1610612761: "Toronto Raptors",
  1610612762: "Utah Jazz",
  1610612763: "Memphis Grizzlies",
  1610612764: "Washington Wizards",
  1610612765: "Detroit Pistons",
  1610612766: "Charlotte Hornets",
};
const ESPN_FRANCHISES = {
  "LA Clippers": "Los Angeles Clippers",
  "NO/Oklahoma City Hornets": "New Orleans Pelicans",
  "New Orleans Hornets": "New Orleans Pelicans",
  "Seattle SuperSonics": "Oklahoma City Thunder",
  "New Jersey Nets": "Brooklyn Nets",
  "Charlotte Bobcats": "Charlotte Hornets",
  "Washington Bullets": "Washington Wizards",
  "Vancouver Grizzlies": "Memphis Grizzlies",
};
// ESPN season rows begin with 1993-94.
const ESPN_FIRST_SEASON = 1993;

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}

function fold(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resultSet(data, name) {
  const set = (data?.resultSets || []).find((item) => item?.name === name);
  if (!set) return null;
  const column = Object.fromEntries(set.headers.map((header, index) => [header, index]));
  return { column, rows: set.rowSet };
}

async function careerTable(id) {
  const file = new URL(`careers/${id}.json`, CACHE);
  if (!existsSync(file)) {
    const response = await fetch(`${NBA_CAREER}?PlayerID=${id}&PerMode=Totals&LeagueID=00`, {
      headers: NBA_HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`${response.status} for player ${id}`);
    mkdirSync(new URL("careers/", CACHE), { recursive: true });
    writeFileSync(file, await response.text());
  }
  const set = resultSet(readJson(file), "SeasonTotalsRegularSeason");
  if (!set) return null;
  const { column, rows } = set;
  return rows
    .filter((row) => row[column.TEAM_ID] !== 0 && row[column.GP] > 0)
    .map((row) => ({
      season: Number(String(row[column.SEASON_ID]).slice(0, 4)),
      team: FRANCHISES[row[column.TEAM_ID]] || null,
      games: row[column.GP],
    }));
}

function espnFranchise(name) {
  const cleaned = String(name || "").replace(/\s+/g, " ").trim();
  return ESPN_FRANCHISES[cleaned] || cleaned;
}

function espnSeasons(entry) {
  const seasons = new Map();
  for (const stint of entry?.stints || []) {
    const season = Number(stint.season.slice(0, 4));
    if (!seasons.has(season)) seasons.set(season, { games: new Map(), events: [] });
    const item = seasons.get(season);
    const team = espnFranchise(stint.team);
    item.games.set(team, (item.games.get(team) || 0) + stint.games);
    for (const span of stint.spans || []) item.events.push({ date: span.start, team });
  }
  for (const item of seasons.values()) item.events.sort((left, right) => left.date.localeCompare(right.date));
  return seasons;
}

function sourcesAgree(rows, espn) {
  const problems = [];
  const nba = new Map();
  for (const row of rows) {
    if (!nba.has(row.season)) nba.set(row.season, new Map());
    const teams = nba.get(row.season);
    teams.set(row.team, (teams.get(row.team) || 0) + row.games);
  }
  const covered = [...nba.keys()].filter((season) => season >= ESPN_FIRST_SEASON);
  for (const season of covered) {
    const left = nba.get(season);
    const right = espn.get(season)?.games;
    if (!right) {
      problems.push(`ESPN has no ${season}-${String(season + 1).slice(2)} season`);
      continue;
    }
    const same = left.size === right.size && [...left].every(([team, games]) => right.get(team) === games);
    if (!same) problems.push(`ESPN and NBA disagree on ${season}-${String(season + 1).slice(2)} teams or games`);
  }
  for (const season of espn.keys()) {
    if (!nba.has(season)) problems.push(`ESPN lists ${season}-${String(season + 1).slice(2)} but the NBA table does not`);
  }
  return problems;
}

function seasonOrder(season, rows, espn) {
  const events = espn.get(season)?.events;
  if (events?.length) {
    const order = [];
    for (const event of events) if (order.at(-1) !== event.team) order.push(event.team);
    return order;
  }
  return rows.filter((row) => row.season === season).map((row) => row.team);
}

// Season convention: the first team of a season owns that season (start to start + 1); a team joined
// during the season starts and ends on the year that season ended. Consecutive stops with the same
// team merge, including across seasons with no appearances.
function deriveStops(rows, espn, currentTeam) {
  const stops = [];
  const add = (team, start, end) => {
    const last = stops.at(-1);
    if (last && last.team === team) {
      last.end = Math.max(last.end, end);
      return;
    }
    stops.push({ team, start, end });
  };
  for (const season of [...new Set(rows.map((row) => row.season))].sort((left, right) => left - right)) {
    seasonOrder(season, rows, espn).forEach((team, index) => {
      if (index === 0) add(team, season, season + 1);
      else add(team, season + 1, season + 1);
    });
  }
  if (currentTeam) add(currentTeam, ROSTER_SEASON_START, ROSTER_SEASON_START + 1);
  return stops;
}

function sameStops(left, right) {
  return careerFingerprint(left) === careerFingerprint(right);
}

const roster = readJson(PLAYERS).players;
const history = readJson(HISTORY);
const teammateData = readJson(TEAMMATES);
const allPlayers = resultSet(readJson(new URL("all-players.json", CACHE)), "CommonAllPlayers");
const draft = resultSet(readJson(new URL("draft.json", CACHE)), "DraftHistory");

const official = new Map(allPlayers.rows.map((row) => [row[allPlayers.column.PERSON_ID], row]));
const idsByName = new Map();
for (const row of allPlayers.rows) {
  const key = fold(row[allPlayers.column.DISPLAY_FIRST_LAST]);
  if (!idsByName.has(key)) idsByName.set(key, []);
  idsByName.get(key).push(row[allPlayers.column.PERSON_ID]);
}
const draftTeam = new Map(draft.rows.map((row) => [row[draft.column.PERSON_ID], FRANCHISES[row[draft.column.TEAM_ID]] || null]));
const espnById = new Map(teammateData.players.map((entry) => [entry.id, entry]));
const historyById = new Map(history.map((entry) => [entry.id, entry]));

const verified = {};
const excluded = [];
const corrected = [];

for (const player of roster) {
  const reasons = [];
  const entry = historyById.get(player.id);
  const recorded = entry?.stops || [];
  const record = official.get(player.id);
  const rows = await careerTable(player.id);

  if (!record) reasons.push("NBA player index has no record for this id");
  else if (fold(record[allPlayers.column.DISPLAY_FIRST_LAST]) !== fold(player.name)) {
    reasons.push(`NBA lists id ${player.id} as ${record[allPlayers.column.DISPLAY_FIRST_LAST]}`);
  }
  if (!rows) reasons.push("NBA career table is missing");
  if (rows?.some((row) => !row.team)) reasons.push("NBA career table has an unknown franchise");

  let currentTeam = null;
  if (record && record[allPlayers.column.ROSTERSTATUS] === 1) {
    currentTeam = FRANCHISES[record[allPlayers.column.TEAM_ID]] || null;
    if (!currentTeam) reasons.push("NBA roster team is unknown");
  }
  if ((player.team || null) !== currentTeam) {
    reasons.push(`roster team ${player.team || "none"} does not match the NBA roster (${currentTeam || "none"})`);
  }

  const espnEntry = espnById.get(player.id);
  const espn = espnSeasons(espnEntry);
  const sharedName = (idsByName.get(fold(player.name)) || []).length > 1;
  if (espnEntry && rows) reasons.push(...sourcesAgree(rows, espn));
  else if (sharedName) reasons.push("name is shared by more than one NBA player and no second source confirms the identity");

  if (rows && !reasons.length) {
    const derived = deriveStops(rows, espn, currentTeam);
    if (!derived.length) reasons.push("no NBA appearances and no current roster team");
    const first = derived[0];
    const keptStart = recorded[0]?.team === first?.team
      && Number.isInteger(player.draftYear)
      && draftTeam.get(player.id) === first?.team
      && recorded[0].start >= player.draftYear
      && recorded[0].start < first.start;
    if (keptStart) first.start = recorded[0].start;

    if (!reasons.length) {
      if (!sameStops(recorded, derived)) {
        corrected.push({ id: player.id, name: player.name, before: careerFingerprint(recorded), after: careerFingerprint(derived) });
        if (WRITE) {
          if (entry) entry.stops = derived;
          else history.push({ id: player.id, stops: derived });
        }
      }
      if (WRITE || sameStops(recorded, derived)) verified[player.id] = careerFingerprint(derived);
      else reasons.push("career history differs from the NBA career table");
    }
  }

  if (reasons.length) excluded.push({ id: player.id, name: player.name, reasons });
}

const payload = {
  source: "NBA stats playercareerstats (regular-season team rows by franchise id) and commonallplayers (name and 2026-27 roster team), cross-checked against ESPN season rows with NBA game-log dates from teammateSeasons.json.",
  retrieved: "2026-10-13",
  rule: "A career history is verified when the NBA name for the player id matches the roster, ESPN's independently resolved seasons agree with the NBA career table on every team and games total from 1993-94 on, and the stored stops equal the stops derived from the NBA table. A name shared by more than one NBA player needs the ESPN check. Stops are keyed to franchises, so earlier names and cities count toward the current team.",
  verified,
  excluded,
};

for (const item of corrected) console.log(`${WRITE ? "corrected" : "differs"} ${item.name}\n  was ${item.before}\n  now ${item.after}`);
for (const item of excluded) console.log(`excluded ${item.name}: ${item.reasons.join("; ")}`);
console.log(`${Object.keys(verified).length} verified, ${excluded.length} excluded, ${corrected.length} ${WRITE ? "corrected" : "would change"}.`);

if (WRITE) {
  writeFileSync(HISTORY, `${JSON.stringify(history, null, 2)}\n`);
  writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
}
