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
];

export function pkModeLabel(mode) {
  return PK_MODES.find((item) => item.id === mode)?.label ?? "1 vs 1";
}

export function isPkMode(mode) {
  return PK_MODES.some((item) => item.id === mode);
}
