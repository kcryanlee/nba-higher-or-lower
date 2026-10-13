import { teamLogoUrl } from "../game/teams.js";
import { players as roster } from "./players.js";
import raw from "./teammateSeasons.json" with { type: "json" };

const SEASON = /^(\d{4})-(\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HISTORICAL_TEAMS = new Set([
  "Seattle SuperSonics",
  "New Jersey Nets",
  "New Orleans Hornets",
  "Charlotte Bobcats",
  "Washington Bullets",
]);
const SOURCE_ALIASES = {
  "LA Clippers": "Los Angeles Clippers",
  "NO/Oklahoma City Hornets": "New Orleans Hornets",
};

function validSeason(season) {
  const match = SEASON.exec(season);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start >= 1946 && start <= 2100 && end === (start + 1) % 100;
}

function canonicalTeam(name) {
  if (typeof name !== "string") return null;
  const cleaned = name.replace(/\s+/g, " ").trim();
  const alias = SOURCE_ALIASES[cleaned];
  if (alias && (teamLogoUrl(alias) || HISTORICAL_TEAMS.has(alias))) return alias;
  if (HISTORICAL_TEAMS.has(cleaned)) return cleaned;
  if (teamLogoUrl(cleaned)) return cleaned;
  return null;
}

export function validateTeammateSeasons(data, rosterPlayers) {
  const errors = [];
  if (!data || typeof data.source !== "string" || typeof data.endpoint !== "string" || typeof data.retrieved !== "string") {
    errors.push("Teammate data is missing its source.");
  }
  if (!Array.isArray(data?.players) || !Array.isArray(data?.unresolved)) {
    return { ok: false, errors: [...errors, "Teammate data is missing player stints."] };
  }

  const rosterById = new Map((rosterPlayers || []).map((player) => [player.id, player]));
  const seenIds = new Set();
  const seenEspn = new Set();

  for (const player of data.players) {
    const rosterPlayer = rosterById.get(player?.id);
    if (!rosterPlayer) {
      errors.push(`Teammate stints for ${player?.id} do not match a roster player.`);
      continue;
    }
    if (seenIds.has(player.id)) errors.push(`Duplicate teammate stints for ${player.id}.`);
    seenIds.add(player.id);
    if (player.name !== rosterPlayer.name) errors.push(`Teammate name for ${player.id} does not match the roster.`);
    if (!Number.isInteger(player.espnId) || player.espnId <= 0) errors.push(`${player.name} is missing an ESPN id.`);
    else if (seenEspn.has(player.espnId)) errors.push(`Duplicate ESPN id ${player.espnId}.`);
    else seenEspn.add(player.espnId);
    if (!Array.isArray(player.stints) || player.stints.length === 0) {
      errors.push(`${player.name} has no teammate seasons.`);
      continue;
    }

    const seenStints = new Set();
    for (const stint of player.stints) {
      const team = canonicalTeam(stint?.team);
      if (!team) errors.push(`${player.name} has a team that is not in the teammate list.`);
      if (!validSeason(stint?.season)) errors.push(`${player.name} has an invalid season.`);
      if (typeof stint?.slug !== "string" || !stint.slug || /totals/i.test(stint.slug) || /totals/i.test(stint?.team || "")) {
        errors.push(`${player.name} has a combined or blank team row.`);
      }
      if (!Number.isInteger(stint?.games) || stint.games < 1 || stint.games > 82) {
        errors.push(`${player.name} has an implausible games total.`);
      }
      if (!Array.isArray(stint?.spans) || stint.spans.length === 0) {
        errors.push(`${player.name} is missing appearance dates for ${stint?.season}.`);
      } else {
        let previousEnd = "";
        for (const span of stint.spans) {
          if (!DATE.test(span?.start || "") || !DATE.test(span?.end || "") || span.start > span.end) {
            errors.push(`${player.name} has an invalid appearance span in ${stint?.season}.`);
          } else if (previousEnd && span.start <= previousEnd) {
            errors.push(`${player.name} has overlapping appearance spans in ${stint?.season}.`);
          }
          previousEnd = span?.end || previousEnd;
        }
        const first = stint.spans[0];
        const last = stint.spans[stint.spans.length - 1];
        if (stint.start !== first?.start || stint.end !== last?.end) {
          errors.push(`${player.name} appearance dates do not match ${stint?.season} spans.`);
        }
      }
      const key = `${stint?.season}|${stint?.slug}`;
      if (seenStints.has(key)) errors.push(`${player.name} repeats ${key}.`);
      seenStints.add(key);
    }
  }

  for (const missing of data.unresolved) {
    if (!rosterById.has(missing?.id)) errors.push(`Unresolved teammate player ${missing?.id} is not on the roster.`);
    if (seenIds.has(missing?.id)) errors.push(`${missing?.name || missing?.id} is both resolved and unresolved.`);
  }

  return { ok: errors.length === 0, errors };
}

function cleanStint(stint) {
  return {
    season: stint.season,
    team: canonicalTeam(stint.team),
    slug: stint.slug,
    games: stint.games,
    start: stint.start,
    end: stint.end,
    spans: Array.isArray(stint.spans) ? stint.spans.map((span) => ({ start: span.start, end: span.end })) : [],
  };
}

function spansOf(stint) {
  if (Array.isArray(stint?.spans) && stint.spans.length) return stint.spans;
  if (stint?.start && stint?.end) return [{ start: stint.start, end: stint.end }];
  return [];
}

export function datesOverlap(left, right) {
  const leftSpans = spansOf(left);
  const rightSpans = spansOf(right);
  return leftSpans.some((leftSpan) => rightSpans.some((rightSpan) => leftSpan.start <= rightSpan.end && rightSpan.start <= leftSpan.end));
}

const checked = validateTeammateSeasons(raw, roster);
const prepared = checked.ok
  ? raw.players.map((player) => ({
      id: player.id,
      espnId: player.espnId,
      name: player.name,
      stints: player.stints.map(cleanStint).sort((left, right) => left.season.localeCompare(right.season) || left.slug.localeCompare(right.slug)),
    })).sort((left, right) => left.id - right.id)
  : [];

const byId = new Map(prepared.map((player) => [player.id, player]));
const stintIndex = new Map();

for (const player of prepared) {
  for (const stint of player.stints) {
    const key = `${stint.season}|${stint.slug}`;
    if (!stintIndex.has(key)) stintIndex.set(key, new Map());
    stintIndex.get(key).set(player.id, stint);
  }
}

export const teammateSource = {
  source: typeof raw.source === "string" ? raw.source : "",
  endpoint: typeof raw.endpoint === "string" ? raw.endpoint : "",
  searchEndpoint: typeof raw.searchEndpoint === "string" ? raw.searchEndpoint : "",
  retrieved: typeof raw.retrieved === "string" ? raw.retrieved : "",
  rule: typeof raw.rule === "string" ? raw.rule : "",
};

export const teammateErrors = checked.errors;
export const teammateReady = checked.ok && prepared.length > 0;
export const chainPlayers = prepared.map((player) => ({ id: player.id, name: player.name }));
export const unresolvedTeammates = Array.isArray(raw.unresolved) ? raw.unresolved.map((player) => player.name).filter(Boolean) : [];

export function chainPlayerByName(name) {
  return chainPlayers.find((player) => player.name === name) || null;
}

export function stintsFor(playerId) {
  return byId.get(playerId)?.stints.map((stint) => ({ ...stint })) || [];
}

export function pairKey(idA, idB) {
  const left = Number(idA);
  const right = Number(idB);
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

export function linksBetween(idA, idB) {
  if (!Number.isInteger(idA) || !Number.isInteger(idB) || idA === idB) return [];
  const player = byId.get(idA);
  const other = byId.get(idB);
  if (!player || !other) return [];
  const links = [];
  for (const stint of player.stints) {
    const shared = stintIndex.get(`${stint.season}|${stint.slug}`)?.get(idB);
    if (!shared || !datesOverlap(stint, shared)) continue;
    links.push({ season: stint.season, team: stint.team, slug: stint.slug });
  }
  return links;
}

export function isTeammateLink(linkerId, targetA, targetB) {
  if (!Number.isInteger(linkerId) || linkerId === targetA || linkerId === targetB || targetA === targetB) return false;
  return linksBetween(linkerId, targetA).length > 0 && linksBetween(linkerId, targetB).length > 0;
}

const teammateSets = new Map(prepared.map((player) => [player.id, new Set()]));
for (let left = 0; left < prepared.length; left += 1) {
  for (let right = left + 1; right < prepared.length; right += 1) {
    if (!linksBetween(prepared[left].id, prepared[right].id).length) continue;
    teammateSets.get(prepared[left].id).add(prepared[right].id);
    teammateSets.get(prepared[right].id).add(prepared[left].id);
  }
}

export function teammateIds(playerId) {
  return teammateSets.get(playerId) || new Set();
}
