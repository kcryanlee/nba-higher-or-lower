export const PK_TARGET = 5;
export const PK_QUESTION_MS = 15000;
export const PK_REVEAL_MS = 2000;
export const PK_COUNTDOWN_FROM = 3;
export const PK_COUNTDOWN_MS = 1000;

export const PK_MODES = [
  {
    id: "higher",
    label: "Higher or Lower",
    detail: "Two players. One stat. Pick who's higher.",
  },
  {
    id: "career",
    label: "Career Path",
    detail: "The career is on the board. Name the player.",
  },
  {
    id: "draft-year",
    label: "Draft Year",
    detail: "Four choices. Name the year he was drafted.",
    group: "draft",
  },
  {
    id: "draft-pick",
    label: "Overall Pick",
    detail: "Four choices. Name his overall pick.",
    group: "draft",
  },
  {
    id: "scored",
    label: "Who Scored More?",
    detail: "Three players from one game. Rank their points.",
  },
  {
    id: "chain",
    label: "Teammate Chain",
    detail: "Find the player who links two careers.",
  },
];

export const PK_LOBBY_GAMES = [
  { id: "higher", mode: "higher", label: "Higher or Lower" },
  { id: "career", mode: "career", label: "Career Path" },
  { id: "draft", mode: "draft-year", label: "Draft Pick" },
  { id: "scored", mode: "scored", label: "Who Scored More?" },
  { id: "chain", mode: "chain", label: "Teammate Chain" },
];

export function pkModeLabel(mode) {
  return PK_MODES.find((item) => item.id === mode)?.label ?? "1 vs 1";
}

export function pkModeDetail(mode) {
  return PK_MODES.find((item) => item.id === mode)?.detail ?? "";
}

export function lobbyGameSelected(gameId, mode) {
  if (gameId === "draft") return mode === "draft-year" || mode === "draft-pick";
  return mode === gameId;
}

export function isPkMode(mode) {
  return PK_MODES.some((item) => item.id === mode);
}
