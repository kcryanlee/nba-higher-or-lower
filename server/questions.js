import { players } from "../src/data/players.js";
import { isTeammateLink } from "../src/data/teammates.js";
import { categoryById } from "../src/game/categories.js";
import { selectCareerQuestion } from "../src/game/careerPath.js";
import { selectChainQuestion } from "../src/game/chain.js";
import { draftPrompt, selectDraftQuestion } from "../src/game/draft.js";
import { playerNamesMatch } from "../src/game/playerSearch.js";
import { selectScoredQuestion } from "../src/game/scored.js";
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

function scoredQuestion({ roundIndex, used }) {
  const question = selectScoredQuestion(roundIndex, { usedKeys: used });
  if (!question?.players || question.players.length !== 3 || !Array.isArray(question.ranking)) return null;
  const ids = question.players.map((player) => player.id);
  const ranking = [...question.ranking];
  const scores = question.players.map((player) => ({ id: player.id, pts: player.pts }));
  if (scores.some((item) => !Number.isInteger(item.pts))) return null;
  return {
    usedKey: question.key,
    public: {
      kind: "scored",
      prompt: "Rank the scoring",
      dateLabel: question.dateLabel,
      home: question.home,
      away: question.away,
      band: question.band?.label || "",
      players: question.players.map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        image: player.image || null,
      })),
    },
    reveal: {
      ranking,
      scores,
    },
    normalize(value) {
      if (!Array.isArray(value) || value.length !== ids.length) return null;
      const picks = value.map((item) => Number(item));
      if (picks.some((id) => !ids.includes(id))) return null;
      if (new Set(picks).size !== ids.length) return null;
      return picks;
    },
    grade(value) {
      return ranking.every((id, index) => value[index] === id);
    },
  };
}

function chainQuestion({ used }) {
  const question = selectChainQuestion({ usedKeys: used });
  if (!question?.targets || !Array.isArray(question.choices) || !Array.isArray(question.names)) return null;
  const [first, second] = question.targets;
  if (!first || !second) return null;
  const choiceIds = [...question.choices];
  const validIds = choiceIds.filter((id) => isTeammateLink(id, first.id, second.id));
  if (!validIds.length || validIds.length === choiceIds.length) return null;
  return {
    usedKey: question.key,
    public: {
      kind: "chain",
      prompt: "Find the player who links these two careers.",
      targets: question.targets.map((target) => ({ id: target.id, name: target.name })),
      choices: choiceIds,
      names: [...question.names],
    },
    reveal: {
      validIds: [...validIds],
    },
    normalize(value) {
      const id = Number(value);
      if (!choiceIds.includes(id)) return null;
      return id;
    },
    grade(value) {
      return validIds.includes(value);
    },
  };
}

export function buildQuestion(room) {
  if (room.mode === "career") return careerQuestion(room);
  if (room.mode === "draft-year" || room.mode === "draft-pick") return draftQuestion(room.mode, room);
  if (room.mode === "scored") return scoredQuestion(room);
  if (room.mode === "chain") return chainQuestion(room);
  return higherQuestion(room);
}
