import { teamLogoUrl } from "../game/teams.js";
import { approvedPlayerImage } from "./playerMedia.js";

const PERCENT_FIELDS = ["fgPct", "tpPct", "ftPct"];
const COUNT_FIELDS = [
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "careerPoints",
  "careerRebounds",
  "careerAssists",
  "heightIn",
  "threes",
  "age",
  "draftYear",
  "draftPick",
];
const SEASON_FIELDS = ["ppg", "rpg", "apg", "spg", "bpg", "fgPct", "tpPct", "ftPct", "salary", "heightIn", "threes", "careerPoints"];

function finiteOrNull(value) {
  return value == null || Number.isFinite(value);
}

export function validateDataset(players, history) {
  const errors = [];
  const ids = new Set();
  const names = new Set();
  const historyById = new Map();

  if (!Array.isArray(players) || !Array.isArray(history)) {
    return { ok: false, errors: ["Player data must be a list of players and a list of career histories."] };
  }

  for (const entry of history) {
    if (!Number.isInteger(entry?.id)) {
      errors.push("A career history entry is missing an NBA player id.");
      continue;
    }
    if (historyById.has(entry.id)) errors.push(`Duplicate career history for player ${entry.id}.`);
    historyById.set(entry.id, entry.stops);
    if (!Array.isArray(entry.stops) || entry.stops.length === 0) {
      errors.push(`Career history for player ${entry.id} has no teams.`);
      continue;
    }
    let previousStop = null;
    for (const stop of entry.stops) {
      if (!stop || typeof stop.team !== "string" || !teamLogoUrl(stop.team)) {
        errors.push(`Career history for player ${entry.id} has a team without a logo.`);
      }
      if (!Number.isFinite(stop?.start) || !Number.isFinite(stop?.end) || stop.end < stop.start) {
        errors.push(`Career history for player ${entry.id} has an invalid year range.`);
      }
      if (previousStop && Number.isFinite(stop?.start) && Number.isFinite(previousStop.end)) {
        if (stop.start < previousStop.start) {
          errors.push(`Career history for player ${entry.id} is out of chronological order.`);
        }
        if (previousStop.end > stop.start) {
          errors.push(`Career history for player ${entry.id} has overlapping team years.`);
        }
      }
      previousStop = stop;
    }
  }

  for (const player of players) {
    const label = player?.name || player?.id || "unknown player";
    if (!Number.isInteger(player?.id) || player.id <= 0) errors.push(`${label} is missing an NBA player id.`);
    else if (ids.has(player.id)) errors.push(`Duplicate player id ${player.id}.`);
    else ids.add(player.id);

    if (typeof player?.name !== "string" || !player.name.trim()) errors.push(`Player ${player?.id ?? ""} is missing a name.`);
    else if (names.has(player.name)) errors.push(`Duplicate player name ${player.name}.`);
    else names.add(player.name);

    if (player.salary != null && !Number.isFinite(player.salary)) errors.push(`${label} has a salary that is not a number.`);
    if (Number.isFinite(player.salary) && player.salary < 0) errors.push(`${label} has a negative salary.`);

    for (const field of PERCENT_FIELDS) {
      if (!finiteOrNull(player[field])) errors.push(`${label} has an invalid ${field}.`);
      else if (Number.isFinite(player[field]) && (player[field] < 0 || player[field] > 100)) {
        errors.push(`${label} has an impossible ${field}.`);
      }
    }

    for (const field of COUNT_FIELDS) {
      if (!finiteOrNull(player[field])) errors.push(`${label} has an invalid ${field}.`);
      else if (Number.isFinite(player[field]) && player[field] < 0) errors.push(`${label} has a negative ${field}.`);
    }

    const hasSeasonStat = SEASON_FIELDS.some((field) => Number.isFinite(player[field]));
    if (hasSeasonStat) {
      if (typeof player.team !== "string" || !player.team.trim()) errors.push(`${label} is missing a team.`);
      else if (!teamLogoUrl(player.team)) errors.push(`${label} has a team without a logo.`);
    } else if (player.team != null && !teamLogoUrl(player.team)) {
      errors.push(`${label} has a team without a logo.`);
    }

    if (player.image != null && String(player.image).trim() !== "" && !approvedPlayerImage(player.image)) {
      errors.push(`${label} has an unapproved player image URL.`);
    }

    if (historyById.has(player?.id) && !Array.isArray(historyById.get(player.id))) {
      errors.push(`${label} is missing career teams.`);
    }
  }

  for (const id of historyById.keys()) {
    if (!ids.has(id)) errors.push(`Career history ${id} does not match a player.`);
  }

  return { ok: errors.length === 0, errors };
}
