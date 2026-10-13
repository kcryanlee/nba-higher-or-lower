import { players } from "../src/data/players.js";
import { categoryById } from "../src/game/categories.js";
import { selectCareerQuestion } from "../src/game/careerPath.js";
import { draftPrompt, selectDraftQuestion } from "../src/game/draft.js";
import { playerNamesMatch } from "../src/game/playerSearch.js";
import { selectMatchup } from "../src/game/selectMatchup.js";

function face(player) {
  return {
    id: player.id,
    name: player.name,
    team: player.team || "",
    image: player.image || null,
    teamLogo: player.teamLogo || null,
    teamColors: player.teamColors || null,
  };
}

function higherQuestion({ roundIndex, used }) {
  const matchup = selectMatchup(players, roundIndex, new Set(used));
  if (!matchup) return null;
  const category = categoryById(matchup.category.id);
  if (!category) return null;
  const leftValue = matchup.left[category.id];
  const rightValue = matchup.right[category.id];
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue) || leftValue === rightValue) return null;
  const higherId = leftValue > rightValue ? matchup.left.id : matchup.right.id;
  const leftId = matchup.left.id;
  const rightId = matchup.right.id;
  return {
    usedKey: matchup.key,
    public: {
      kind: "higher",
      categoryId: category.id,
      categoryLabel: category.label,
      prompt: category.question,
      band: matchup.band?.label || "",
      left: face(matchup.left),
      right: face(matchup.right),
    },
    reveal: {
      higherId,
      leftValue,
      rightValue,
    },
    normalize(value) {
      const id = Number(value);
      if (id !== leftId && id !== rightId) return null;
      return id;
    },
    grade(value) {
      return value === higherId;
    },
  };
}

function careerQuestion({ roundIndex, used, usedIds }) {
  const question = selectCareerQuestion(roundIndex, { usedIds, usedKeys: used });
  if (!question?.player || !Array.isArray(question.stops)) return null;
  const official = question.player;
  return {
    usedKey: question.key,
    usedId: question.answerId,
    public: {
      kind: "career",
      prompt: "Who is this player?",
      band: question.band?.label || "",
      bandId: question.band?.id || "",
      position: question.band?.id === "easy" ? question.position : "",
      stops: question.stops.map((stop) => ({
        team: stop.team,
        start: stop.start,
        end: stop.end,
      })),
    },
    reveal: {
      player: official,
    },
    normalize(value) {
      if (typeof value !== "string") return null;
      const name = value.trim().slice(0, 80);
      return name || null;
    },
    grade(value) {
      return playerNamesMatch(official, value);
    },
  };
}

function draftQuestion(mode, { usedIds }) {
  const draftMode = mode === "draft-pick" ? "pick" : "year";
  const question = selectDraftQuestion(players, draftMode, usedIds);
  if (!question || !Array.isArray(question.choices) || question.choices.length !== 4) return null;
  const answer = question.answer;
  const choices = [...question.choices];
  return {
    usedId: question.id,
    public: {
      kind: "draft",
      mode: draftMode,
      prompt: draftPrompt(draftMode),
      id: question.id,
      name: question.name,
      team: question.team || "",
      image: question.image || null,
      teamLogo: question.teamLogo || null,
      teamColors: question.teamColors || null,
      choices,
    },
    reveal: {
      answer,
    },
    normalize(value) {
      const choice = Number(value);
      if (!Number.isInteger(choice) || !choices.includes(choice)) return null;
      return choice;
    },
    grade(value) {
      return value === answer;
    },
  };
}

export function buildQuestion(room) {
  if (room.mode === "career") return careerQuestion(room);
  if (room.mode === "draft-year" || room.mode === "draft-pick") return draftQuestion(room.mode, room);
  return higherQuestion(room);
}
