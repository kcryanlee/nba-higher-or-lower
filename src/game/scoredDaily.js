import { hashString, mulberry32 } from "./seed.js";
import { scoredGames } from "../data/boxScores.js";
import { SCORED_DAILY_QUESTIONS } from "./scoredDailyRecord.js";
import { SCORED_POSITIONS, selectScoredQuestion } from "./scored.js";

export const SCORED_DAILY_KEY = "nba-scored-daily";

const SLOT_STREAKS = [0, 6, 6, 11, 11];

function readyQuestion(question) {
  if (!question) return false;
  if (typeof question.key !== "string" || !question.key) return false;
  if (typeof question.date !== "string" || typeof question.home !== "string" || typeof question.away !== "string") {
    return false;
  }
  if (!Array.isArray(question.players) || question.players.length !== SCORED_POSITIONS) return false;
  if (!Array.isArray(question.ranking) || question.ranking.length !== SCORED_POSITIONS) return false;
  const points = question.players.map((player) => player.pts);
  if (points.some((pointsTotal) => !Number.isInteger(pointsTotal))) return false;
  if (new Set(question.players.map((player) => player.id)).size !== SCORED_POSITIONS) return false;
  if (new Set(points).size !== SCORED_POSITIONS) return false;
  const ranking = [...question.players].sort((left, right) => right.pts - left.pts || left.id - right.id);
  return question.ranking.every((id, index) => id === ranking[index].id);
}

export function buildScoredDaily(dateKey, games = scoredGames) {
  try {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const random = mulberry32(hashString(`nba-scored-daily:${dateKey}`));
    const usedKeys = [];
    const questions = [];

    for (const streak of SLOT_STREAKS) {
      const question = selectScoredQuestion(streak, { usedKeys, random, games });
      if (!readyQuestion(question)) return null;
      usedKeys.push(question.key);
      questions.push(question);
    }

    if (questions.length !== SCORED_DAILY_QUESTIONS) return null;
    if (new Set(questions.map((question) => question.key)).size !== SCORED_DAILY_QUESTIONS) return null;
    return questions;
  } catch {
    return null;
  }
}
