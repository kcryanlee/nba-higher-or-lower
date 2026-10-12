import { careerPlayers } from "../data/players.js";
import { careerQuestionKey as careerStopKey } from "./careerPath.js";
import { auditChainQuestion, gradeChainChoice } from "./chain.js";
import { categoryById, statGap } from "./categories.js";
import { bandForStreak } from "./difficulty.js";
import { draftChoices, draftPool, draftQuestion } from "./draft.js";
import { positionCredit, questionFromSaved, SCORED_PERFECT_CREDIT, SCORED_POSITIONS } from "./scored.js";
import { pairKey } from "./selectMatchup.js";
import { readJsonStorage, removeStorage, writeStorage } from "./storage.js";

export const ACTIVE_RUN_KEY = "nba-active-run";

const SLOT_KEYS = {
  classic: "nba-run-classic",
  career: "nba-run-career",
  "draft-year": "nba-run-draft-year",
  "draft-pick": "nba-run-draft-pick",
  scored: "nba-run-scored",
  chain: "nba-run-chain",
};

let foregroundSlot = null;

function slotFor(game, mode) {
  if (game === "draft" && (mode === "year" || mode === "pick")) return `draft-${mode}`;
  if (SLOT_KEYS[game]) return game;
  return null;
}

function validRun(saved) {
  if (!saved || (saved.phase !== "playing" && saved.phase !== "revealing")) return null;
  if (saved.game !== "classic" && saved.game !== "career" && saved.game !== "draft" && saved.game !== "scored" && saved.game !== "chain") return null;
  if (!Number.isInteger(saved.streak) || saved.streak < 0) return null;
  return saved;
}

export function readActiveRun() {
  return validRun(readJsonStorage(ACTIVE_RUN_KEY));
}

export function readRunSlot(game, mode) {
  const slot = slotFor(game, mode);
  const saved = validRun(slot ? readJsonStorage(SLOT_KEYS[slot]) : null);
  if (!saved || saved.game !== game) return null;
  if (game === "draft" && saved.mode !== mode) return null;
  return saved;
}

export function resetRunFocus() {
  foregroundSlot = null;
}

export function focusRun(game, mode) {
  const slot = slotFor(game, mode);
  if (!slot) return;
  foregroundSlot = slot;
  const saved = readRunSlot(game, mode);
  if (saved) writeStorage(ACTIVE_RUN_KEY, JSON.stringify(saved));
}

export function writeActiveRun(run) {
  const payload = JSON.stringify(run);
  const slot = slotFor(run?.game, run?.mode);
  if (slot) writeStorage(SLOT_KEYS[slot], payload);
  if (foregroundSlot == null || foregroundSlot === slot) writeStorage(ACTIVE_RUN_KEY, payload);
}

export function clearActiveRun(game, mode) {
  const slot = slotFor(game, mode);
  if (slot) removeStorage(SLOT_KEYS[slot]);
  const saved = readJsonStorage(ACTIVE_RUN_KEY);
  if (!saved) return;
  const savedSlot = slotFor(saved.game, saved.mode);
  if ((slot && savedSlot === slot) || (!slot && saved.game === game)) removeStorage(ACTIVE_RUN_KEY);
}

function restoreClassicSaved(saved, players) {
  if (!saved || saved.game !== "classic" || !Array.isArray(players)) return null;
  const category = categoryById(saved.categoryId);
  const left = players.find((player) => player.id === saved.leftId);
  const right = players.find((player) => player.id === saved.rightId);
  if (!category || !left || !right) return null;
  if (!Number.isFinite(left[category.id]) || !Number.isFinite(right[category.id])) return null;
  if (left[category.id] === right[category.id]) return null;

  const revealing = saved.phase === "revealing"
    && (saved.result === "correct" || saved.result === "wrong" || saved.result === "push")
    && (saved.pickedId === left.id || saved.pickedId === right.id);
  const currentKey = pairKey(category.id, left, right);
  const usedKeys = Array.isArray(saved.usedKeys)
    ? saved.usedKeys.filter((key) => typeof key === "string" && key.length > 0)
    : [];
  if (!usedKeys.includes(currentKey)) usedKeys.push(currentKey);

  return {
    phase: revealing ? "revealing" : "playing",
    streak: saved.streak,
    pickedId: revealing ? saved.pickedId : null,
    result: revealing ? saved.result : null,
    usedKeys,
    matchup: {
      category,
      left,
      right,
      key: typeof saved.key === "string" ? saved.key : `${category.id}:${left.id}:${right.id}`,
      gap: statGap(category.id, left[category.id], right[category.id]),
      band: bandForStreak(saved.streak),
    },
  };
}

export function restoreClassicRun(players) {
  return restoreClassicSaved(readActiveRun(), players);
}

export function restoreParkedClassicRun(players) {
  return restoreClassicSaved(readRunSlot("classic"), players);
}

function careerAnswerId(question) {
  if (Number.isInteger(question?.answerId)) return question.answerId;
  const match = careerPlayers.find((career) => career.name === question?.player);
  return Number.isInteger(match?.id) ? match.id : null;
}

function careerUsedIds(saved, question) {
  const ids = Array.isArray(saved.usedIds)
    ? saved.usedIds.filter((id) => Number.isInteger(id))
    : [];
  const answerId = careerAnswerId(question);
  if (answerId != null && !ids.includes(answerId)) ids.push(answerId);
  return ids;
}

function careerQuestionKey(question) {
  if (typeof question?.key === "string" && question.key) return question.key;
  const answerId = careerAnswerId(question);
  if (answerId == null || !Number.isInteger(question?.hiddenIndex)) return null;
  return careerStopKey(answerId, question.hiddenIndex);
}

function careerQuestionPlayable(question) {
  const stop = question?.stops?.[question?.hiddenIndex];
  if (typeof question?.player !== "string" || !question.player.trim()) return false;
  if (!Array.isArray(question.stops) || question.stops.length === 0) return false;
  if (!Number.isInteger(question.hiddenIndex) || typeof stop?.team !== "string" || !stop.team) return false;
  return question.answer === question.player || question.answer === stop.team;
}

function careerUsedKeys(saved, question) {
  const keys = Array.isArray(saved.usedKeys)
    ? saved.usedKeys.filter((key) => typeof key === "string" && key.length > 0)
    : [];
  const key = careerQuestionKey(question);
  if (key && !keys.includes(key)) keys.push(key);
  return keys;
}

function restoreCareerSaved(saved) {
  const question = saved?.question;
  if (!saved || saved.game !== "career" || !careerQuestionPlayable(question)) return null;

  const revealing = saved.phase === "revealing"
    && (saved.result === "correct" || saved.result === "wrong")
    && typeof saved.picked === "string"
    && saved.picked.trim().length > 0;
  const normalized = question.answer === question.player
    ? question
    : { ...question, answer: question.player };

  return {
    phase: revealing ? "revealing" : "playing",
    streak: saved.streak,
    picked: revealing ? saved.picked : null,
    result: revealing ? saved.result : null,
    question: normalized,
    usedIds: careerUsedIds(saved, normalized),
    usedKeys: careerUsedKeys(saved, normalized),
  };
}

export function restoreCareerRun() {
  return restoreCareerSaved(readActiveRun());
}

export function restoreParkedCareerRun() {
  return restoreCareerSaved(readRunSlot("career"));
}

function restoreDraftSaved(saved, players) {
  if (!saved || saved.game !== "draft" || !Array.isArray(players)) return null;
  if (saved.mode !== "year" && saved.mode !== "pick") return null;
  if (!Number.isInteger(saved.playerId)) return null;

  const player = draftPool(players, saved.mode).find((item) => item.id === saved.playerId);
  if (!player) return null;

  const usedIds = Array.isArray(saved.usedIds)
    ? saved.usedIds.filter((id) => Number.isInteger(id))
    : [];
  if (!usedIds.includes(player.id)) usedIds.push(player.id);

  const answer = saved.mode === "year" ? player.draftYear : player.draftPick;
  const savedChoices = Array.isArray(saved.choices)
    && saved.choices.length === 4
    && new Set(saved.choices).size === 4
    && saved.choices.every((value) => Number.isInteger(value))
    && saved.choices.includes(answer)
    ? saved.choices
    : draftChoices(players, saved.mode, answer);
  if (savedChoices.length !== 4) return null;

  const question = { ...draftQuestion(player, saved.mode), choices: savedChoices };
  const revealing = saved.phase === "revealing"
    && (saved.result === "correct" || saved.result === "wrong")
    && Number.isInteger(saved.guess)
    && question.choices.includes(saved.guess);

  return {
    phase: revealing ? "revealing" : "playing",
    mode: saved.mode,
    streak: saved.streak,
    guess: revealing ? saved.guess : null,
    result: revealing ? saved.result : null,
    question,
    usedIds,
  };
}

export function restoreDraftRun(players) {
  return restoreDraftSaved(readActiveRun(), players);
}

export function restoreParkedDraftRun(players, mode) {
  if (mode !== "year" && mode !== "pick") return null;
  return restoreDraftSaved(readRunSlot("draft", mode), players);
}

function cleanPicks(picks, question) {
  const ids = new Set(question.players.map((player) => player.id));
  const clean = [];
  if (!Array.isArray(picks)) return clean;
  for (const id of picks) {
    if (!Number.isInteger(id) || !ids.has(id) || clean.includes(id)) break;
    clean.push(id);
    if (clean.length === SCORED_POSITIONS) break;
  }
  return clean;
}

function restoreScoredSaved(saved) {
  if (!saved || saved.game !== "scored") return null;
  if (typeof saved.gameId !== "string" || !Array.isArray(saved.playerIds) || saved.playerIds.length !== SCORED_POSITIONS) {
    return null;
  }
  if (!saved.playerIds.every((id) => Number.isInteger(id))) return null;

  const rawStreak = Number.isInteger(saved.streak) && saved.streak >= 0 ? saved.streak : 0;
  const creditGuess = Number.isInteger(saved.credit) && saved.credit >= 0 && saved.credit <= SCORED_PERFECT_CREDIT
    ? saved.credit
    : null;
  const dealtGuess = Number.isInteger(saved.dealtStreak) && saved.dealtStreak >= 0
    ? saved.dealtStreak
    : (saved.phase === "revealing" && creditGuess != null ? Math.max(0, rawStreak - creditGuess) : rawStreak);
  const question = questionFromSaved(saved.gameId, saved.playerIds, dealtGuess);
  if (!question) return null;

  const usedKeys = Array.isArray(saved.usedKeys)
    ? saved.usedKeys.filter((key) => typeof key === "string" && key.length > 0)
    : [];
  if (!usedKeys.includes(question.key)) usedKeys.push(question.key);

  const picks = cleanPicks(saved.picks, question);
  const credit = picks.length === SCORED_POSITIONS ? positionCredit(question.ranking, picks) : null;
  const revealing = saved.phase === "revealing"
    && credit != null
    && credit === creditGuess
    && ((saved.result === "placed" && credit > 0) || (saved.result === "miss" && credit === 0));

  return {
    phase: revealing ? "revealing" : "playing",
    streak: revealing ? dealtGuess + credit : rawStreak,
    dealtStreak: dealtGuess,
    picks: revealing ? picks : (saved.phase === "playing" ? picks : []),
    credit: revealing ? credit : null,
    result: revealing ? saved.result : null,
    question,
    usedKeys,
  };
}

export function restoreScoredRun() {
  return restoreScoredSaved(readActiveRun());
}

export function restoreParkedScoredRun() {
  return restoreScoredSaved(readRunSlot("scored"));
}

function restoreChainSaved(saved) {
  const question = saved?.question;
  if (!saved || saved.game !== "chain" || auditChainQuestion(question).length) return null;

  const usedKeys = Array.isArray(saved.usedKeys)
    ? saved.usedKeys.filter((key) => typeof key === "string" && key.length > 0)
    : [];
  if (!usedKeys.includes(question.key)) usedKeys.push(question.key);

  if (saved.phase === "revealing") {
    const grade = gradeChainChoice(question, saved.picked);
    const matches = Boolean(grade)
      && ((saved.result === "correct" && grade.correct) || (saved.result === "wrong" && !grade.correct));
    if (!matches) return null;
    return {
      phase: "revealing",
      streak: saved.streak,
      picked: saved.picked,
      result: saved.result,
      question,
      usedKeys,
    };
  }

  return {
    phase: "playing",
    streak: saved.streak,
    picked: null,
    result: null,
    question,
    usedKeys,
  };
}

export function restoreChainRun() {
  return restoreChainSaved(readActiveRun());
}

export function restoreParkedChainRun() {
  return restoreChainSaved(readRunSlot("chain"));
}

export function openingScreen(players) {
  if (restoreClassicRun(players)) return "classic";
  if (restoreCareerRun()) return "career";
  if (restoreDraftRun(players)) return "draft";
  if (restoreScoredRun()) return "scored";
  if (restoreChainRun()) return "chain";
  return "hub";
}
