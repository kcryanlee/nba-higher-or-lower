import raw from "./boxScores.json" with { type: "json" };
import { teamLogoUrl } from "../game/teams.js";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function knownTeam(name) {
  return typeof name === "string" && Boolean(teamLogoUrl(name));
}

function lineProblem(line, names) {
  if (!Array.isArray(line) || line.length !== 3) return "bad line";
  const [id, side, points] = line;
  if (!Number.isInteger(id) || id <= 0) return "bad player id";
  if (side !== 0 && side !== 1) return "bad side";
  if (!Number.isInteger(points) || points < 0) return "missing points";
  const name = names[String(id)];
  if (typeof name !== "string" || !name.trim()) return "missing name";
  return "";
}

export function validateBoxScores(data) {
  const names = data?.names && typeof data.names === "object" ? data.names : {};
  const games = [];
  const errors = [];
  if (!Array.isArray(data?.games)) return { games, errors: ["Box score games are missing."] };

  for (const game of data.games) {
    if (!game || typeof game !== "object") {
      errors.push("A box score entry is missing.");
      continue;
    }
    const id = String(game.id || "");
    if (!/^\d+$/.test(id)) {
      errors.push(`${id || "?"}: bad game id`);
      continue;
    }
    if (!DATE_KEY.test(game.date)) {
      errors.push(`${id}: bad date`);
      continue;
    }
    if (!knownTeam(game.home) || !knownTeam(game.away) || game.home === game.away) {
      errors.push(`${id}: bad teams`);
      continue;
    }
    if (!Number.isInteger(game.homeScore) || game.homeScore < 0 || !Number.isInteger(game.awayScore) || game.awayScore < 0) {
      errors.push(`${id}: bad team score`);
      continue;
    }
    if (!Array.isArray(game.lines) || game.lines.length < 2) {
      errors.push(`${id}: not enough players`);
      continue;
    }

    const players = [];
    const seen = new Set();
    let problem = "";
    for (const line of game.lines) {
      problem = lineProblem(line, names);
      if (problem) break;
      if (seen.has(line[0])) {
        problem = "duplicate player";
        break;
      }
      seen.add(line[0]);
      players.push({
        id: line[0],
        name: names[String(line[0])].trim(),
        team: line[1] === 1 ? game.home : game.away,
        pts: line[2],
      });
    }
    if (problem) {
      errors.push(`${id}: ${problem}`);
      continue;
    }

    const awayPoints = players.filter((player) => player.team === game.away).reduce((sum, player) => sum + player.pts, 0);
    const homePoints = players.filter((player) => player.team === game.home).reduce((sum, player) => sum + player.pts, 0);
    if (awayPoints !== game.awayScore || homePoints !== game.homeScore) {
      errors.push(`${id}: player points do not match the team score`);
      continue;
    }

    games.push({
      id,
      date: game.date,
      home: game.home,
      away: game.away,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      players,
    });
  }

  return { games, errors };
}

const checked = validateBoxScores(raw);

export const boxScoreSource = {
  source: typeof raw.source === "string" ? raw.source : "ESPN public NBA box score API",
  endpoint: typeof raw.endpoint === "string" ? raw.endpoint : "",
  season: typeof raw.season === "string" ? raw.season : "",
  retrieved: typeof raw.retrieved === "string" ? raw.retrieved : "",
};

export const boxScoreErrors = checked.errors;
export const scoredGames = checked.games;
