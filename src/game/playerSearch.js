import { players as roster } from "../data/players.js";

const EXTRA_FOLDS = {
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  þ: "th",
};

export function foldPlayerName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[øłđðæœßþ]/g, (letter) => EXTRA_FOLDS[letter] || letter)
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function playerNamesMatch(official, guess) {
  const left = foldPlayerName(official);
  const right = foldPlayerName(guess);
  return left.length > 0 && left === right;
}

function matchRank(name, query) {
  const folded = foldPlayerName(name);
  if (!folded) return null;
  if (folded === query) return 0;
  if (folded.startsWith(query)) return 1;
  if (folded.split(" ").some((word) => word.startsWith(query))) return 2;
  if (folded.includes(query)) return 3;
  return null;
}

export function searchPlayers(guess, source = roster) {
  const query = foldPlayerName(guess);
  if (!query || !Array.isArray(source)) return [];
  return source
    .map((player) => ({ player, rank: matchRank(player?.name, query) }))
    .filter((item) => item.rank != null && typeof item.player?.name === "string")
    .sort((left, right) => left.rank - right.rank || left.player.name.localeCompare(right.player.name))
    .slice(0, 8)
    .map((item) => ({
      id: item.player.id,
      name: item.player.name,
    }));
}
