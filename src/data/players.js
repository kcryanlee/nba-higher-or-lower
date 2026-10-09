import history from "./careerHistory.json" with { type: "json" };
import roster from "./players.json" with { type: "json" };
import { presentPlayer } from "./playerMedia.js";

const historyById = new Map(history.map((entry) => [entry.id, entry.stops]));

export const players = roster.players.map((player) => presentPlayer(player, historyById.get(player.id) || []));

export const careerPlayers = players
  .filter((player) => player.careerTeams.length > 0)
  .map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    stops: player.careerTeams,
  }));
