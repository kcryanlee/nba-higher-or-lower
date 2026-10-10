export const DRAFT_BEST_KEYS = {
  year: "nba-draft-year-best",
  pick: "nba-draft-pick-best",
};

const EARLIEST_DRAFT_YEAR = 1947;

export function latestDraftYear(now = new Date()) {
  return now.getFullYear();
}

export function usableDraftYear(player, now = new Date()) {
  const year = player?.draftYear;
  return Number.isInteger(year) && year >= EARLIEST_DRAFT_YEAR && year <= latestDraftYear(now);
}

export function usableDraftPick(player) {
  const pick = player?.draftPick;
  return Number.isInteger(pick) && pick >= 1 && pick <= 300;
}

export function draftPool(players, mode, now = new Date()) {
  if (!Array.isArray(players)) return [];
  if (mode === "year") return players.filter((player) => usableDraftYear(player, now));
  if (mode === "pick") return players.filter((player) => usableDraftPick(player));
  return [];
}

export function draftModeLabel(mode) {
  if (mode === "year") return "Draft Year";
  if (mode === "pick") return "Overall Pick";
  return "Draft Pick";
}

export function draftPrompt(mode) {
  if (mode === "pick") return "What overall pick was he?";
  return "What year was he drafted?";
}

export function ordinal(pick) {
  const value = Math.abs(pick);
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${pick}th`;
  const last = value % 10;
  if (last === 1) return `${pick}st`;
  if (last === 2) return `${pick}nd`;
  if (last === 3) return `${pick}rd`;
  return `${pick}th`;
}

export function formatDraftReveal(mode, value) {
  if (mode === "year") return `Drafted in ${value}`;
  return `${ordinal(value)} overall`;
}

export function formatDraftFact(name, mode, value) {
  if (mode === "year") return `${name} was drafted in ${value}.`;
  return `${name} was the ${ordinal(value)} overall pick.`;
}

export function parseDraftAnswer(mode, raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  if (mode === "year") {
    if (!/^\d{4}$/.test(text)) return null;
    return Number(text);
  }

  if (mode === "pick") {
    const match = text.match(/^(\d+)(st|nd|rd|th)?$/i);
    if (!match) return null;
    const pick = Number(match[1]);
    if (!Number.isInteger(pick) || pick < 1) return null;
    return pick;
  }

  return null;
}

export function formatDraftChoice(mode, value) {
  if (mode === "year") return String(value);
  return ordinal(value);
}

export function draftQuestion(player, mode) {
  return {
    id: player.id,
    name: player.name,
    team: player.team || "",
    image: player.image || null,
    teamLogo: player.teamLogo || null,
    teamColors: player.teamColors || null,
    answer: mode === "year" ? player.draftYear : player.draftPick,
    mode,
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function choiceAllowed(mode, value, now) {
  if (!Number.isInteger(value)) return false;
  if (mode === "year") return value >= EARLIEST_DRAFT_YEAR && value <= latestDraftYear(now);
  return value >= 1 && value <= 300;
}

function nearbyChoices(mode, answer, taken, now) {
  const extras = [];
  for (let distance = 1; extras.length < 3 && distance < 80; distance += 1) {
    for (const candidate of [answer - distance, answer + distance]) {
      if (taken.has(candidate) || !choiceAllowed(mode, candidate, now)) continue;
      taken.add(candidate);
      extras.push(candidate);
      if (extras.length >= 3) break;
    }
  }
  return extras;
}

export function draftChoices(players, mode, answer, random = Math.random, now = new Date()) {
  if (!choiceAllowed(mode, answer, now)) return [];
  const values = new Set();
  for (const player of draftPool(players, mode, now)) {
    const value = mode === "year" ? player.draftYear : player.draftPick;
    if (choiceAllowed(mode, value, now) && value !== answer) values.add(value);
  }
  const shortlist = [...values]
    .sort((left, right) => Math.abs(left - answer) - Math.abs(right - answer) || left - right)
    .slice(0, 8);
  const picked = shuffle(shortlist, random).slice(0, 3);
  const taken = new Set([answer, ...picked]);
  if (picked.length < 3) picked.push(...nearbyChoices(mode, answer, taken, now));
  const choices = [answer, ...picked].slice(0, 4);
  if (choices.length !== 4 || new Set(choices).size !== 4) return [];
  return shuffle(choices, random);
}

export function selectDraftQuestion(players, mode, usedIds = [], random = Math.random) {
  const used = new Set(usedIds);
  const pool = draftPool(players, mode).filter((player) => !used.has(player.id));
  for (const player of shuffle(pool, random)) {
    const question = draftQuestion(player, mode);
    const choices = draftChoices(players, mode, question.answer, random);
    if (choices.length === 4) return { ...question, choices };
  }
  return null;
}
