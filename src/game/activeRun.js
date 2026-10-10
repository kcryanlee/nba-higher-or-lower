import { careerPlayers } from "../data/players.js";
import { categoryById, statGap } from "./categories.js";
import { bandForStreak } from "./difficulty.js";
import { draftChoices, draftPool, draftQuestion } from "./draft.js";
import { readJsonStorage, removeStorage, writeStorage } from "./storage.js";

export const ACTIVE_RUN_KEY = "nba-active-run";

export function readActiveRun() {
  const saved = readJsonStorage(ACTIVE_RUN_KEY);
  if (!saved || (saved.phase !== "playing" && saved.phase !== "revealing")) return null;
  if (saved.game !== "classic" && saved.game !== "career" && saved.game !== "draft") return null;
  if (!Number.isInteger(saved.streak) || saved.streak < 0) return null;
  return saved;
}

export function writeActiveRun(run) {
  writeStorage(ACTIVE_RUN_KEY, JSON.stringify(run));
}

export function clearActiveRun(game) {
  const saved = readJsonStorage(ACTIVE_RUN_KEY);
  if (!saved || saved.game === game) removeStorage(ACTIVE_RUN_KEY);
}

export function restoreClassicRun(players) {
  const saved = readActiveRun();
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

  return {
    phase: revealing ? "revealing" : "playing",
    streak: saved.streak,
    pickedId: revealing ? saved.pickedId : null,
    result: revealing ? saved.result : null,
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

function careerAnswerId(question) {
  if (Number.isInteger(question?.answerId)) return question.answerId;
  const match = careerPlayers.find((career) => career.name === question?.answer);
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

export function restoreCareerRun() {
  const saved = readActiveRun();
  const question = saved?.question;
  if (!saved || saved.game !== "career" || !question) return null;
  if (typeof question.answer !== "string" || !Array.isArray(question.stops) || !Array.isArray(question.choices)) {
    return null;
  }
  if (!question.choices.includes(question.answer)) return null;

  const revealing = saved.phase === "revealing"
    && (saved.result === "correct" || saved.result === "wrong")
    && question.choices.includes(saved.picked);

  return {
    phase: revealing ? "revealing" : "playing",
    streak: saved.streak,
    picked: revealing ? saved.picked : null,
    result: revealing ? saved.result : null,
    question,
    usedIds: careerUsedIds(saved, question),
  };
}

export function restoreDraftRun(players) {
  const saved = readActiveRun();
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

export function openingScreen(players) {
  if (restoreClassicRun(players)) return "classic";
  if (restoreCareerRun()) return "career";
  if (restoreDraftRun(players)) return "draft";
  return "hub";
}
