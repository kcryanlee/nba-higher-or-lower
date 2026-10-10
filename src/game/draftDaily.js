import { selectDraftQuestion } from "./draft.js";
import { QUIZ_DAILY_LENGTH } from "./quizDaily.js";
import { hashString, mulberry32 } from "./seed.js";

export const DRAFT_DAILY_KEYS = {
  year: "nba-draft-year-daily",
  pick: "nba-draft-pick-daily",
};

export function draftDailyTitle(mode) {
  if (mode === "pick") return "Guess the Draft Pick";
  return "Guess the Draft Year";
}

function readyQuestion(question, mode) {
  return Boolean(question)
    && question.mode === mode
    && Number.isInteger(question.id)
    && Number.isInteger(question.answer)
    && Array.isArray(question.choices)
    && question.choices.length === 4
    && new Set(question.choices).size === 4
    && question.choices.includes(question.answer);
}

export function buildDraftDaily(players, mode, dateKey, now = new Date()) {
  try {
    if (mode !== "year" && mode !== "pick") return null;
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const random = mulberry32(hashString(`nba-draft-daily:${mode}:${dateKey}`));
    const usedIds = [];
    const questions = [];

    for (let index = 0; index < QUIZ_DAILY_LENGTH; index += 1) {
      const question = selectDraftQuestion(players, mode, usedIds, random, now);
      if (!readyQuestion(question, mode)) return null;
      usedIds.push(question.id);
      questions.push(question);
    }

    if (new Set(usedIds).size !== QUIZ_DAILY_LENGTH) return null;
    return questions;
  } catch {
    return null;
  }
}
