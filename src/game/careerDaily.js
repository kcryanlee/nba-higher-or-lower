import { selectCareerQuestionForBand } from "./careerPath.js";
import { QUIZ_DAILY_LENGTH } from "./quizDaily.js";
import { hashString, mulberry32 } from "./seed.js";

export const CAREER_DAILY_KEY = "nba-career-daily";

const SLOT_BANDS = ["easy", "medium", "medium", "hard", "hard"];

function readyQuestion(question) {
  const stop = question?.stops?.[question?.hiddenIndex];
  return Boolean(question)
    && typeof question.answer === "string"
    && question.answer.length > 0
    && typeof question.player === "string"
    && question.player.length > 0
    && question.answer === question.player
    && Number.isInteger(question.answerId)
    && Number.isInteger(question.hiddenIndex)
    && Array.isArray(question.stops)
    && question.stops.length > 0
    && typeof stop?.team === "string"
    && stop.team.length > 0;
}

export function buildCareerDaily(dateKey) {
  try {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const random = mulberry32(hashString(`nba-career-daily:${dateKey}`));
    const usedIds = [];
    const questions = [];

    for (const bandId of SLOT_BANDS) {
      const question = selectCareerQuestionForBand(bandId, { usedIds, random });
      if (!readyQuestion(question)) return null;
      usedIds.push(question.answerId);
      questions.push(question);
    }

    if (questions.length !== QUIZ_DAILY_LENGTH) return null;
    if (new Set(usedIds).size !== QUIZ_DAILY_LENGTH) return null;
    return questions;
  } catch {
    return null;
  }
}
