import { teamColors, teamLogoUrl } from "../game/teams.js";

export function playerImageUrl(id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
}

export function approvedPlayerImage(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function presentPlayer(player, stops = []) {
  return {
    ...player,
    image: approvedPlayerImage(player.image) || playerImageUrl(player.id),
    teamLogo: teamLogoUrl(player.team),
    teamColors: teamColors(player.team),
    careerTeams: stops,
  };
}
