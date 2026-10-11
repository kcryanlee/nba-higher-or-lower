import { auditChainQuestion, selectChainQuestion } from "./chain.js";
import { QUIZ_DAILY_LENGTH } from "./quizDaily.js";
import { hashString, mulberry32 } from "./seed.js";

export const CHAIN_DAILY_KEY = "nba-chain-daily";

export function buildChainDaily(dateKey) {
  try {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const random = mulberry32(hashString(`nba-chain-daily:${dateKey}`));
    const usedKeys = [];
    const questions = [];

    for (let slot = 0; slot < QUIZ_DAILY_LENGTH; slot += 1) {
      const question = selectChainQuestion({ usedKeys, random });
      if (!question || auditChainQuestion(question).length) return null;
      usedKeys.push(question.key);
      questions.push(question);
    }

    if (questions.length !== QUIZ_DAILY_LENGTH) return null;
    if (new Set(questions.map((question) => question.key)).size !== QUIZ_DAILY_LENGTH) return null;
    return questions;
  } catch {
    return null;
  }
}
