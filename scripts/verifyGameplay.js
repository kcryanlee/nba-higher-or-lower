import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ACTIVE_ONLY, CATEGORIES } from "../src/game/categories.js";
import careerHistory from "../src/data/careerHistory.json" with { type: "json" };
import roster from "../src/data/players.json" with { type: "json" };
import { validateDataset } from "../src/data/validatePlayers.js";
import {
  DAILY_LENGTH,
  activeDailyStreak,
  buildDaily,
  commitOfficialResult,
  continueDaily,
  dailyRunStatus,
  emptyDailyRecord,
  noteOfficialAnswer,
  previousDateKey,
  readDailyRecord,
  todayKey,
  writeDailyRecord,
} from "../src/game/daily.js";
import { BADGE_REVEAL_MS, REVEAL_MS } from "../src/game/feedback.js";
import { outcomeFor } from "../src/game/outcome.js";
import { pairKey, selectMatchup } from "../src/game/selectMatchup.js";
import { BADGES, applyAnswer, emptyBadgeState } from "../src/game/badges.js";
import { readJsonStorage, readStoredNumber, writeStorage } from "../src/game/storage.js";
import { players, careerPlayers } from "../src/data/players.js";
import {
  CAREER_BANDS,
  EXPERT_STREAK,
  buildCareerPools,
  careerBand,
  careerClues,
  careerMatches,
  careerPlayerAccepted,
  careerPoolReport,
  careerRejections,
  continueCareerQuestion,
  currentCareerQuestion,
  eligibleCareers,
  selectCareerQuestion,
  selectCareerQuestionForBand,
} from "../src/game/careerPath.js";
import { careerFingerprint, careerVerified } from "../src/data/careerVerification.js";
import careerVerification from "../src/data/careerVerification.json" with { type: "json" };
import { playerNamesMatch, searchPlayers } from "../src/game/playerSearch.js";
import { officialTeamName, searchTeams, teamMatches } from "../src/game/teams.js";
import { collectPairs, hasStat } from "../src/game/selectMatchup.js";
import { clearActiveRun, focusRun, openingScreen, readActiveRun, readRunSlot, resetRunFocus, restoreCareerRun, restoreChainRun, restoreClassicRun, restoreDraftRun, restoreParkedDraftRun, restoreScoredRun, writeActiveRun } from "../src/game/activeRun.js";
import { DRAFT_BEST_KEYS, continueDraftQuestion, draftPool, ordinal, parseDraftAnswer, selectDraftQuestion, usableDraftYear } from "../src/game/draft.js";
import { DRAFT_BADGE_KEYS, DRAFT_BADGES, applyDraftStreak, readDraftBadges } from "../src/game/draftBadges.js";
import { CAREER_BEST_KEY, readCareerBadges } from "../src/game/careerBadges.js";
import { CAREER_DAILY_KEY, buildCareerDaily } from "../src/game/careerDaily.js";
import { DRAFT_DAILY_KEYS, buildDraftDaily } from "../src/game/draftDaily.js";
import {
  CAREER_DAILY_BADGE_KEY,
  DRAFT_DAILY_BADGE_KEY,
  DRAFT_DAILY_BADGE_KEYS,
  HIGHER_DAILY_BADGE_KEY,
  MODE_DAILY_BADGES,
  applyModeDailyBadges,
  mergeModeDailyRecords,
  modeDailyBadgeProgress,
  modeDailyStats,
  readModeDailyBadges,
  readUnlockedModeDailyBadges,
  syncModeDailyBadges,
} from "../src/game/modeDailyBadges.js";
import {
  QUIZ_DAILY_LENGTH,
  activeQuizStreak,
  commitQuizResult,
  continueQuiz,
  emptyQuizDailyRecord,
  longestConsecutive,
  nextDateKey,
  noteQuizAnswer,
  quizRunStatus,
  readQuizDailyRecord,
  writeQuizDailyRecord,
} from "../src/game/quizDaily.js";
import { useDaily } from "../src/hooks/useDaily.js";
import { boxScoreErrors, scoredGames } from "../src/data/boxScores.js";
import { questionFromSaved, positionCredit, scoredTrioKey, selectScoredQuestion } from "../src/game/scored.js";
import { SCORED_DAILY_KEY, buildScoredDaily } from "../src/game/scoredDaily.js";
import {
  SCORED_DAILY_TOTAL,
  emptyScoredDailyRecord,
  continueScoredDaily,
  noteScoredDailyAnswer,
  readScoredDailyRecord,
  writeScoredDailyRecord,
} from "../src/game/scoredDailyRecord.js";
import { SCORED_BEST_KEY, applyScoredStreak, readScoredBadges } from "../src/game/scoredBadges.js";
import {
  chainPlayerByName,
  datesOverlap,
  isTeammateLink,
  linksBetween,
  pairKey as chainPairKey,
  stintsFor,
  teammateErrors,
  teammateReady,
  teammateSource,
  unresolvedTeammates,
  chainPlayers,
} from "../src/data/teammates.js";
import {
  auditChainQuestion,
  chainChoiceCorrect,
  chainPairKeys,
  describeConnections,
  gradeChainChoice,
  selectChainQuestion,
} from "../src/game/chain.js";
import { CHAIN_DAILY_KEY, buildChainDaily } from "../src/game/chainDaily.js";
import { CHAIN_BEST_KEY, applyChainStreak, readChainBadges } from "../src/game/chainBadges.js";
import { mulberry32 } from "../src/game/seed.js";

const store = new Map();
let failRead = false;
let failWrite = false;

globalThis.localStorage = {
  getItem(key) {
    if (failRead) throw new Error("read failed");
    return store.has(key) ? store.get(key) : null;
  },
  setItem(key, value) {
    if (failWrite) throw new Error("write failed");
    store.set(key, String(value));
  },
  removeItem(key) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
};

function player(id, value) {
  const row = { id, name: `Player ${id}`, team: "Boston Celtics" };
  for (const category of CATEGORIES) row[category.id] = value;
  return row;
}

function answer(record, index, correct) {
  const noted = noteOfficialAnswer(record, {
    date: "2026-10-09",
    index,
    correct,
    score: correct,
    highestId: correct ? "easy" : null,
    total: DAILY_LENGTH,
    difficulty: correct ? "Easy" : "None",
    pickedId: 1000 + index,
    result: correct > (record.active?.correct ?? 0) ? "correct" : "wrong",
  });
  if (!noted.accepted) return noted;
  const stepped = continueDaily(noted.record);
  return { record: stepped.record, accepted: true, finished: stepped.finished };
}

const early = new Date(2026, 9, 9, 0, 30, 0);
const late = new Date(2026, 9, 9, 23, 30, 0);
assert.equal(todayKey(early), "2026-10-09");
assert.equal(todayKey(late), "2026-10-09");
if (early.getTimezoneOffset() < 0) {
  assert.notEqual(todayKey(early), early.toISOString().slice(0, 10));
}
if (late.getTimezoneOffset() > 0) {
  assert.notEqual(todayKey(late), late.toISOString().slice(0, 10));
}

assert.equal(previousDateKey("2026-10-09"), "2026-10-08");
assert.equal(previousDateKey("2026-03-01"), "2026-02-28");
assert.equal(previousDateKey("2024-03-01"), "2024-02-29");
assert.equal(previousDateKey("2026-01-01"), "2025-12-31");

const yesterday = commitOfficialResult(emptyDailyRecord(), {
  date: "2026-10-08",
  correct: 10,
  total: 15,
  score: 12,
  difficulty: "Easy",
});
assert.equal(activeDailyStreak(yesterday, "2026-10-09"), 1);
assert.equal(activeDailyStreak(yesterday, "2026-10-10"), 0);
assert.equal(activeDailyStreak(yesterday, "2026-10-08"), 1);

assert.equal(outcomeFor(10, 10), "push");
assert.equal(outcomeFor(11, 10), "correct");
assert.equal(outcomeFor(9, 10), "wrong");
assert.equal(outcomeFor(Number.NaN, 10), "wrong");

assert.equal(selectMatchup([player(1, 10), player(2, 10)], 0), null);
const uneven = selectMatchup([player(1, 10), player(2, 40)], 0);
assert.ok(uneven);
assert.notEqual(uneven.left[uneven.category.id], uneven.right[uneven.category.id]);

const classicRoster = [player(1, 10), player(2, 30), player(3, 55)];
const usedMatchups = new Set();
const classicAppearances = new Map();
for (let round = 0; round < 18; round += 1) {
  const match = selectMatchup(classicRoster, round, usedMatchups);
  assert.ok(match, `classic matchup ${round}`);
  assert.equal(usedMatchups.has(match.key), false);
  assert.equal(match.key, pairKey(match.category.id, match.left, match.right));
  assert.equal(pairKey(match.category.id, match.right, match.left), match.key);
  for (const id of [match.left.id, match.right.id]) {
    classicAppearances.set(id, (classicAppearances.get(id) ?? 0) + 1);
  }
  usedMatchups.add(match.key);
}
assert.ok([...classicAppearances.values()].some((count) => count > 1));
const everyKey = [];
for (const category of CATEGORIES) {
  for (const pair of collectPairs(classicRoster, category, { min: 0, max: Infinity })) everyKey.push(pair.key);
}
assert.equal(selectMatchup(classicRoster, 0, new Set(everyKey)), null);
const resetMatchup = selectMatchup(classicRoster, 0, new Set());
assert.ok(resetMatchup);
assert.equal(everyKey.includes(resetMatchup.key), true);

assert.equal(buildDaily([], "2026-10-09"), null);
assert.equal(buildDaily(null, "2026-10-09"), null);
const first = buildDaily(players, "2026-10-09");
const second = buildDaily(players, "2026-10-09");
assert.equal(first.length, DAILY_LENGTH);
assert.deepEqual(first.map((question) => question.key), second.map((question) => question.key));
assert.ok(first.every((question) => question.left[question.category.id] !== question.right[question.category.id]));
assert.equal(new Set(first.map((question) => question.key)).size, DAILY_LENGTH);
assert.equal(new Set(first.flatMap((question) => [question.left.id, question.right.id])).size, DAILY_LENGTH * 2);

for (const date of ["2026-10-10", "2026-01-01", "2024-02-29", "2026-06-15", "2026-12-31"]) {
  const questions = buildDaily(players, date);
  assert.equal(questions.length, DAILY_LENGTH, date);
  assert.deepEqual(questions, buildDaily(players, date));
  assert.equal(new Set(questions.map((question) => question.key)).size, DAILY_LENGTH, date);
  const ids = questions.flatMap((question) => [question.left.id, question.right.id]);
  assert.equal(new Set(ids).size, ids.length, date);
}

const tinyRoster = [player(1, 5), player(2, 12), player(3, 20), player(4, 40)];
const tinyDaily = buildDaily(tinyRoster, "2026-10-10");
assert.equal(tinyDaily.length, DAILY_LENGTH);
assert.deepEqual(tinyDaily, buildDaily(tinyRoster, "2026-10-10"));
assert.equal(new Set(tinyDaily.map((question) => question.key)).size, DAILY_LENGTH);
const tinyIds = tinyDaily.flatMap((question) => [question.left.id, question.right.id]);
assert.ok(new Set(tinyIds).size < tinyIds.length);

let record = emptyDailyRecord();
assert.equal(dailyRunStatus(record, "2026-10-09"), "new");
for (let index = 0; index < 3; index += 1) {
  const noted = answer(record, index, index + 1);
  assert.equal(noted.accepted, true);
  assert.equal(noted.finished, false);
  record = noted.record;
}
assert.equal(record.active.index, 3);
assert.equal(record.active.credited, 3);
assert.equal(dailyRunStatus(record, "2026-10-09"), "progress");
const replay = answer(record, 0, 99);
assert.equal(replay.accepted, false);
assert.equal(replay.record, record);

for (let index = 3; index < DAILY_LENGTH; index += 1) {
  const noted = answer(record, index, 0);
  assert.equal(noted.accepted, true);
  record = noted.record;
}
assert.equal(record.days["2026-10-09"].correct, 0);
assert.equal(record.days["2026-10-09"].total, 15);
assert.equal(record.active, null);
assert.equal(dailyRunStatus(record, "2026-10-09"), "complete");
assert.equal(dailyRunStatus(emptyDailyRecord(), "2026-10-09"), "new");
const locked = answer(record, 0, 15);
assert.equal(locked.accepted, false);
assert.equal(locked.record.days["2026-10-09"].correct, 0);

store.clear();
assert.equal(writeDailyRecord(record), true);
const restored = readDailyRecord();
assert.equal(restored.days["2026-10-09"].correct, 0);
assert.equal(restored.days["2026-10-09"].total, 15);
assert.equal(dailyRunStatus(restored, "2026-10-09"), "complete");

const heldCorrect = noteOfficialAnswer(emptyDailyRecord(), {
  date: "2026-10-09",
  index: 0,
  correct: 1,
  score: 2,
  highestId: "easy",
  total: DAILY_LENGTH,
  difficulty: "Easy",
  pickedId: 42,
  result: "correct",
});
assert.equal(heldCorrect.accepted, true);
assert.equal(heldCorrect.finished, false);
assert.equal(heldCorrect.record.active.phase, "revealing");
assert.equal(heldCorrect.record.active.index, 0);
assert.equal(heldCorrect.record.active.pickedId, 42);
assert.equal(heldCorrect.record.active.result, "correct");
assert.equal(heldCorrect.record.active.score, 2);
assert.equal(heldCorrect.record.active.correct, 1);
assert.equal(heldCorrect.record.days["2026-10-09"], undefined);
const replayHeld = noteOfficialAnswer(heldCorrect.record, {
  date: "2026-10-09",
  index: 0,
  correct: 2,
  score: 9,
  highestId: "easy",
  total: DAILY_LENGTH,
  difficulty: "Easy",
  pickedId: 42,
  result: "correct",
});
assert.equal(replayHeld.accepted, false);
assert.equal(replayHeld.record.active.score, 2);
assert.equal(replayHeld.record.active.correct, 1);
store.clear();
writeDailyRecord(heldCorrect.record);
writeActiveRun({
  game: "classic",
  phase: "playing",
  streak: 4,
  pickedId: null,
  result: null,
  categoryId: "ppg",
  leftId: players[0].id,
  rightId: players[1].id,
  key: "ppg:test",
});
const resumedHold = readDailyRecord();
assert.equal(resumedHold.active.phase, "revealing");
assert.equal(resumedHold.active.index, 0);
assert.equal(resumedHold.active.pickedId, 42);
assert.equal(resumedHold.active.result, "correct");
assert.equal(resumedHold.active.score, 2);
assert.equal(readActiveRun().game, "classic");
assert.equal(readActiveRun().streak, 4);
const heldWrong = noteOfficialAnswer(emptyDailyRecord(), {
  date: "2026-10-09",
  index: 0,
  correct: 0,
  score: 0,
  highestId: null,
  total: DAILY_LENGTH,
  difficulty: "None",
  pickedId: 77,
  result: "wrong",
});
assert.equal(heldWrong.record.active.result, "wrong");
assert.equal(heldWrong.record.active.pickedId, 77);
assert.equal(heldWrong.record.days["2026-10-09"], undefined);
writeDailyRecord(heldWrong.record);
assert.equal(readDailyRecord().active.result, "wrong");
assert.equal(readDailyRecord().active.score, 0);
const afterWrong = continueDaily(heldWrong.record);
assert.equal(afterWrong.finished, false);
assert.equal(afterWrong.record.active.index, 1);
assert.equal(afterWrong.record.active.phase, "playing");
assert.equal(afterWrong.record.active.correct, 0);
const legacyDaily = {
  version: 3,
  lastCompleted: "",
  streak: 2,
  days: {},
  completedDates: [],
  bestCorrect: 0,
  bestTotal: DAILY_LENGTH,
  active: {
    date: "2026-10-09",
    index: 4,
    correct: 2,
    score: 3,
    highestId: "easy",
    credited: 4,
  },
};
writeDailyRecord(legacyDaily);
const legacyRead = readDailyRecord();
assert.equal(legacyRead.active.index, 4);
assert.equal(legacyRead.active.phase, "playing");
assert.equal(legacyRead.active.correct, 2);
assert.equal(legacyRead.active.score, 3);
assert.equal(legacyRead.streak, 2);
assert.equal(legacyRead.days["2026-10-09"], undefined);
let finalDaily = emptyDailyRecord();
for (let index = 0; index < DAILY_LENGTH; index += 1) {
  const noted = noteOfficialAnswer(finalDaily, {
    date: "2026-10-09",
    index,
    correct: index === DAILY_LENGTH - 1 ? 4 : index,
    score: index + 1,
    highestId: "medium",
    total: DAILY_LENGTH,
    difficulty: "Medium",
    pickedId: 50 + index,
    result: index === 1 ? "wrong" : "correct",
  });
  assert.equal(noted.accepted, true);
  assert.equal(noted.finished, false);
  assert.equal(noted.record.days["2026-10-09"], undefined);
  assert.equal(noted.record.active.phase, "revealing");
  assert.equal(noted.record.active.index, index);
  assert.equal(noted.record.active.pickedId, 50 + index);
  finalDaily = continueDaily(noted.record).record;
}
assert.equal(finalDaily.days["2026-10-09"].correct, 4);
assert.equal(finalDaily.days["2026-10-09"].total, DAILY_LENGTH);
assert.equal(finalDaily.active, null);
assert.equal(finalDaily.completedDates.filter((date) => date === "2026-10-09").length, 1);
const finalAgain = continueDaily(finalDaily);
assert.equal(finalAgain.advanced, false);
assert.equal(finalAgain.record.days["2026-10-09"].correct, 4);
assert.equal(finalAgain.record.completedDates.filter((date) => date === "2026-10-09").length, 1);
store.clear();

store.set("nba-hol-daily", "{");
assert.equal(dailyRunStatus(readDailyRecord(), "2026-10-09"), "new");
failRead = true;
assert.equal(readJsonStorage("nba-hol-daily"), null);
failRead = false;
failWrite = true;
assert.equal(writeStorage("nba-hol-best", "4"), false);
assert.equal(writeDailyRecord(record), false);
failWrite = false;

const badges = emptyBadgeState();
const once = applyAnswer(badges, { correct: true, categoryId: "salary", bandId: "easy", dailyKey: "2026-10-09:0" });
const twice = applyAnswer(once.state, { correct: true, categoryId: "salary", bandId: "easy", dailyKey: "2026-10-09:0" });
assert.equal(once.state.counts.salary, 1);
assert.equal(twice.state.counts.salary, 1);
assert.deepEqual(twice.state, once.state);
const wrongFirst = applyAnswer(badges, { correct: false, categoryId: "ppg", bandId: "hard", dailyKey: "2026-10-09:1" });
const laterCorrect = applyAnswer(wrongFirst.state, { correct: true, categoryId: "ppg", bandId: "hard", dailyKey: "2026-10-09:1" });
assert.equal(laterCorrect.state.counts.ppg, 0);
assert.equal(laterCorrect.state.hardCorrect, 0);

assert.ok(BADGE_REVEAL_MS > REVEAL_MS);
assert.equal(REVEAL_MS, 750);

function Probe({ roster }) {
  const daily = useDaily(roster);
  return createElement(
    "main",
    null,
    createElement("h1", null, "NBA Mini Games"),
    createElement("p", null, daily.available ? "daily-ready" : "Unavailable today"),
  );
}

store.clear();
const failedDaily = renderToStaticMarkup(createElement(Probe, { roster: [] }));
assert.match(failedDaily, /NBA Mini Games/);
assert.match(failedDaily, /Unavailable today/);
const readyDaily = renderToStaticMarkup(createElement(Probe, { roster: players }));
assert.match(readyDaily, /NBA Mini Games/);
assert.match(readyDaily, /daily-ready/);

for (const career of careerPlayers) {
  for (let index = 1; index < career.stops.length; index += 1) {
    const previous = career.stops[index - 1];
    const next = career.stops[index];
    assert.ok(next.start >= previous.start, `${career.name} is out of order`);
    assert.ok(previous.end <= next.start, `${career.name} has overlapping teams`);
    assert.ok(previous.end >= previous.start, `${career.name} has an invalid stop`);
  }
}

assert.ok(careerPlayers.some((career) => career.name === "Anthony Davis" && career.stops.length === 4));
const rejectedFullPaths = new Set(["easy", "medium", "hard"].flatMap((bandId) => careerRejections(bandId).map((item) => item.id)));
assert.equal(
  eligibleCareers("easy").length + eligibleCareers("medium").length + eligibleCareers("hard").length + rejectedFullPaths.size,
  careerPlayers.length,
);

// Every history is verified against the NBA career table and stays verified only while unchanged.
for (const career of careerPlayers) assert.ok(careerVerified(career.id, career.stops), `${career.name} history is verified`);
assert.equal(careerVerified(careerPlayers[0].id, [...careerPlayers[0].stops, { team: "Utah Jazz", start: 2030, end: 2031 }]), false);
assert.deepEqual(careerVerification.excluded, []);
assert.equal(
  careerPlayers.find((career) => career.name === "Anthony Davis").stops.map((stop) => `${stop.team} ${stop.start}-${stop.end}`).join(" > "),
  "New Orleans Pelicans 2012-2019 > Los Angeles Lakers 2019-2025 > Dallas Mavericks 2025-2026 > Washington Wizards 2026-2027",
);

// Every playable question, in every difficulty, fits exactly one searchable player on its visible clues.
const searchablePool = players.map((player) => ({ id: player.id, name: player.name, position: player.position, stops: player.careerTeams }));
for (const bandId of CAREER_BANDS) {
  const pool = eligibleCareers(bandId);
  assert.ok(pool.length > 0, `${bandId} has questions`);
  for (const career of pool) {
    const indexes = bandId === "expert" ? career.stops.map((_, index) => index) : [null];
    for (const hiddenIndex of indexes) {
      const question = currentCareerQuestion({ band: { id: bandId }, answerId: career.id, player: career.name, stops: career.stops, hiddenIndex });
      if (!question) continue;
      const matches = careerMatches(careerClues(career, bandId, question.hiddenIndex), searchablePool);
      assert.deepEqual(matches.map((match) => match.id), [career.id], `${career.name} ${bandId} ${hiddenIndex} is unique`);
    }
  }
}
for (const report of careerPoolReport()) assert.ok(report.valid > 0 && report.excluded >= 0);
assert.ok(careerRejections("expert").every((item) => Number.isInteger(item.hiddenIndex)));
assert.ok(careerRejections("expert").some((item) => /also fit/.test(item.reason)));

// Screenshot 1: NBA id 201607 is Patrick Ewing Jr. (one 2010-11 season with New Orleans), stored under the Hall of Famer's name.
const ewingRecord = {
  id: 201607,
  name: "Patrick Ewing",
  position: "Forward",
  stops: [{ team: "New Orleans Pelicans", start: 2010, end: 2011 }],
};
assert.equal(careerVerified(ewingRecord.id, ewingRecord.stops), false);
const ewingPools = buildCareerPools({ careers: [ewingRecord], searchable: [...searchablePool, ewingRecord] });
for (const bandId of CAREER_BANDS) assert.equal(ewingPools.pools[bandId].length, 0);
const ewingRejected = CAREER_BANDS.flatMap((bandId) => ewingPools.rejected[bandId]);
assert.equal(ewingRejected.length, 2);
assert.ok(ewingRejected.every((item) => /Unverified career history/.test(item.reason)));
for (const bandId of CAREER_BANDS) {
  assert.equal(eligibleCareers(bandId).some((career) => career.id === 201607 || career.name === "Patrick Ewing"), false);
}
const ewingQuestion = {
  band: { id: "easy", label: "Easy" },
  answer: "Patrick Ewing",
  answerId: 201607,
  player: "Patrick Ewing",
  position: "Forward",
  stops: ewingRecord.stops,
  hiddenIndex: 0,
  key: "201607:0",
};
assert.equal(currentCareerQuestion(ewingQuestion), null);

// Screenshot 2: "Orlando Magic · 2021–27" fits both Jalen Suggs and Franz Wagner.
const suggs = careerPlayers.find((career) => career.name === "Jalen Suggs");
const wagner = careerPlayers.find((career) => career.name === "Franz Wagner");
assert.equal(careerFingerprint(suggs.stops), "Orlando Magic:2021-2027");
assert.equal(careerFingerprint(wagner.stops), careerFingerprint(suggs.stops));
assert.deepEqual(
  careerMatches(careerClues(suggs, "medium"), searchablePool).map((match) => match.name).sort(),
  ["Franz Wagner", "Jalen Suggs"],
);
for (const bandId of CAREER_BANDS) {
  assert.equal(eligibleCareers(bandId).some((career) => career.id === suggs.id || career.id === wagner.id), false, bandId);
}
assert.match(careerRejections("medium").find((item) => item.id === suggs.id).reason, /Franz Wagner/);
const suggsQuestion = {
  band: { id: "medium", label: "Medium" },
  answer: suggs.name,
  answerId: suggs.id,
  player: suggs.name,
  position: suggs.position,
  stops: suggs.stops,
  hiddenIndex: 0,
  key: `${suggs.id}:0`,
};
assert.equal(currentCareerQuestion(suggsQuestion), null);

// Hidden-team questions start at question 101, after the 100th correct answer.
assert.equal(EXPERT_STREAK, 100);
assert.equal(careerBand(0).id, "easy");
assert.equal(careerBand(15).id, "medium");
assert.equal(careerBand(16).id, "hard");
assert.equal(careerBand(99).id, "hard");
assert.equal(careerBand(100).id, "expert");
assert.equal(careerBand(5000).id, "expert");
const atNinetyNine = continueCareerQuestion(99, { random: () => 0.3 });
assert.equal(atNinetyNine.question.band.id, "hard");
assert.equal(atNinetyNine.question.hiddenIndex, null);
const atHundred = continueCareerQuestion(100, { usedIds: atNinetyNine.usedIds, usedKeys: atNinetyNine.usedKeys, random: () => 0.3 });
assert.equal(atHundred.question.band.id, "expert");
assert.ok(Number.isInteger(atHundred.question.hiddenIndex));
assert.ok(atHundred.question.stops.length >= 2);
assert.equal(atHundred.question.stops.length, careerPlayers.find((career) => career.id === atHundred.question.answerId).stops.length);
for (const bandId of ["easy", "medium", "hard"]) {
  for (let index = 0; index < 20; index += 1) {
    const question = selectCareerQuestionForBand(bandId, { random: mulberry32(index + 1) });
    assert.equal(question.hiddenIndex, null);
    assert.equal(question.key, `${question.answerId}:path`);
  }
}
assert.ok(eligibleCareers("easy").length >= 6);
assert.ok(eligibleCareers("medium").length >= 10);
assert.ok(eligibleCareers("easy").some((career) => career.name === "LeBron James" && career.stops.length > 1));
assert.ok(eligibleCareers("easy").some((career) => career.name === "Stephen Curry"));
assert.equal(eligibleCareers("easy").some((career) => career.name === "Amen Thompson"), false);
assert.equal(eligibleCareers("medium").some((career) => career.name === "Amen Thompson"), false);
assert.ok(eligibleCareers("hard").some((career) => career.name === "Amen Thompson"));
assert.equal(eligibleCareers("hard").some((career) => career.name === "Kon Knueppel"), false);
assert.match(careerRejections("hard").find((item) => item.name === "Kon Knueppel").reason, /Sion James/);
assert.ok(eligibleCareers("hard").some((career) => career.stops.length === 1));
assert.ok(eligibleCareers("hard").some((career) => career.name === "Dennis Schroder" && career.stops.length > 1));
assert.equal(eligibleCareers("easy").some((career) => career.name === "Dennis Schroder"), false);

assert.deepEqual(searchTeams(""), []);
assert.deepEqual(searchTeams("   "), []);
assert.ok(searchTeams("a").length < 30);
assert.deepEqual(searchTeams("lac"), ["Los Angeles Clippers"]);
assert.deepEqual(searchTeams("Clippers"), ["Los Angeles Clippers"]);
assert.deepEqual(searchTeams("LA Clippers"), ["Los Angeles Clippers"]);
assert.deepEqual(searchTeams("L.A. Clippers"), ["Los Angeles Clippers"]);
assert.equal(officialTeamName("LAC"), "Los Angeles Clippers");
assert.equal(officialTeamName("la"), null);
assert.ok(searchTeams("la").includes("Los Angeles Clippers"));
assert.ok(searchTeams("la").includes("Los Angeles Lakers"));
assert.equal(searchTeams("la").length < 8, true);
assert.equal(teamMatches("Los Angeles Clippers", "Clippers"), true);
assert.equal(teamMatches("Los Angeles Clippers", "Lakers"), false);
assert.equal(teamMatches("Golden State Warriors", "GSW"), true);
assert.equal(teamMatches("Philadelphia 76ers", "Sixers"), true);

assert.deepEqual(searchPlayers(""), []);
assert.deepEqual(searchPlayers("   "), []);
assert.equal(playerNamesMatch("Kristaps Porziņģis", "Kristaps Porzingis"), true);
assert.equal(playerNamesMatch("Kristaps Porzingis", "  kristaps   porziņģis "), true);
assert.equal(playerNamesMatch("Nikola Jokić", "nikola jokic"), true);
assert.equal(playerNamesMatch("Stephen Curry", "LeBron James"), false);
assert.equal(searchPlayers("stephen")[0]?.name, "Stephen Curry");
assert.equal(searchPlayers("Porziņģis").some((player) => player.name === "Kristaps Porzingis"), true);
assert.equal(searchPlayers("zzzqqqnope").length, 0);
assert.ok(searchPlayers("a").length > 0);
assert.ok(searchPlayers("a").length <= 8);
const sampleCareer = selectCareerQuestion(0, { usedIds: [] });
assert.equal(sampleCareer.answer, sampleCareer.player);
assert.equal(careerPlayerAccepted(sampleCareer, sampleCareer.player.toLowerCase()), true);
assert.equal(careerPlayerAccepted(sampleCareer, `  ${sampleCareer.player.replace(/i/gi, "í")}  `), true);
assert.equal(careerPlayerAccepted(sampleCareer, "Not A Real Player"), false);
assert.equal(careerPlayerAccepted({ player: "Kristaps Porziņģis", answer: "Kristaps Porziņģis" }, "Kristaps Porzingis"), true);

const threes = CATEGORIES.find((category) => category.id === "threes");
const threesPairs = collectPairs(players, threes, { min: 0, max: Infinity });
assert.ok(threesPairs.every((pair) => pair.first.threes > 0 && pair.second.threes > 0));
const duren = players.find((player) => player.name === "Jalen Duren");
assert.equal(duren.threes, 0);
assert.equal(duren.tpPct, 0);

assert.deepEqual(validateDataset(roster.players, careerHistory).errors, []);
const playerNamed = (name) => players.find((player) => player.name === name);
assert.equal(playerNamed("DeMar DeRozan").salary, 3876529);
assert.equal(playerNamed("Mike Conley").salary, 3876529);
assert.equal(playerNamed("Cameron Johnson").salary, 22500000);
assert.equal(playerNamed("Klay Thompson").salary, 5600000);
assert.ok(players.filter((player) => !player.team).every((player) => player.salary == null));
for (const name of ["Russell Westbrook", "Kyle Lowry", "Eric Gordon", "Kevin Love", "Chris Paul"]) {
  const retired = playerNamed(name);
  assert.equal(retired.team, null);
  assert.ok(Number.isFinite(retired.ppg) && Number.isFinite(retired.ftPct));
  assert.equal(hasStat(retired, "ppg"), false);
  assert.equal(hasStat(retired, "careerPoints"), true);
}
assert.equal(playerNamed("Russell Westbrook").ppg, 15.2);
assert.equal(playerNamed("Russell Westbrook").careerPoints, 27176);
assert.equal(playerNamed("Carmelo Anthony").careerPoints, 28289);
assert.equal(playerNamed("Kyle Korver").threes, 2450);
for (const categoryId of ACTIVE_ONLY) {
  const category = CATEGORIES.find((item) => item.id === categoryId);
  const pairs = collectPairs(players, category, { min: 0, max: Infinity });
  assert.ok(pairs.length > 0);
  assert.ok(pairs.every((pair) => pair.first.team && pair.second.team));
}
assert.equal(playerNamed("Patrick Ewing"), undefined);
assert.equal(players.some((player) => player.id === 201607), false);
const undrafted = players
  .filter((player) => player.draftYear == null && player.draftPick == null)
  .map((player) => player.name)
  .sort();
assert.deepEqual(undrafted, [
  "AJ Green",
  "Alex Caruso",
  "Austin Reaves",
  "Ben Wallace",
  "Brandon Williams",
  "Caleb Martin",
  "Collin Gillespie",
  "Craig Porter Jr.",
  "Daeqwon Plowden",
  "Daniss Jenkins",
  "Dean Wade",
  "Derrick Jones Jr.",
  "Dominick Barlow",
  "Dru Smith",
  "Duncan Robinson",
  "Dylan Cardwell",
  "Jamison Battle",
  "Javonte Green",
  "Jay Huff",
  "Jock Landale",
  "Jordan Goodwin",
  "Jose Alvarado",
  "Julian Champagnie",
  "Kenrich Williams",
  "Keon Ellis",
  "Luguentz Dort",
  "Luke Kornet",
  "Micah Potter",
  "Nae'Qwan Tomlin",
  "Naji Marshall",
  "Naz Reid",
  "Royce O'Neale",
  "Ryan Nembhard",
  "Sam Hauser",
  "Simone Fontecchio",
  "Spencer Jones",
  "T.J. McConnell",
]);
assert.equal(draftPool(players, "year").length, players.length - undrafted.length);
assert.equal(draftPool(players, "pick").length, players.length - undrafted.length);
assert.equal(draftPool(players, "year").some((player) => player.name === "Austin Reaves"), false);
assert.equal(usableDraftYear({ draftYear: 2009 }, new Date(2026, 9, 10)), true);
assert.equal(usableDraftYear({ draftYear: 2099 }, new Date(2026, 9, 10)), false);
assert.equal(draftPool([{ id: 1, name: "Year Only", draftYear: 2010, draftPick: null }], "pick").length, 0);
assert.equal(parseDraftAnswer("year", "2009"), 2009);
assert.equal(parseDraftAnswer("year", " 2011 "), 2011);
assert.equal(parseDraftAnswer("year", "209"), null);
assert.equal(parseDraftAnswer("year", "20090"), null);
assert.equal(parseDraftAnswer("pick", "1"), 1);
assert.equal(parseDraftAnswer("pick", "1st"), 1);
assert.equal(parseDraftAnswer("pick", "2nd"), 2);
assert.equal(parseDraftAnswer("pick", "3rd"), 3);
assert.equal(parseDraftAnswer("pick", "11th"), 11);
assert.equal(parseDraftAnswer("pick", "21st"), 21);
assert.equal(parseDraftAnswer("pick", " 22nd "), 22);
assert.equal(parseDraftAnswer("pick", "first"), null);
assert.equal(parseDraftAnswer("pick", "1st overall"), null);
assert.equal(ordinal(1), "1st");
assert.equal(ordinal(2), "2nd");
assert.equal(ordinal(3), "3rd");
assert.equal(ordinal(4), "4th");
assert.equal(ordinal(11), "11th");
assert.equal(ordinal(12), "12th");
assert.equal(ordinal(13), "13th");
assert.equal(ordinal(21), "21st");
assert.equal(ordinal(22), "22nd");
assert.equal(ordinal(23), "23rd");
const seenDraft = [];
while (seenDraft.length < draftPool(players, "pick").length) {
  const question = selectDraftQuestion(players, "pick", seenDraft, () => 0);
  if (!question) break;
  assert.equal(seenDraft.includes(question.id), false);
  assert.equal(question.answer, players.find((player) => player.id === question.id).draftPick);
  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(question.choices.includes(question.answer));
  seenDraft.push(question.id);
}
assert.equal(seenDraft.length, draftPool(players, "pick").length);
assert.equal(selectDraftQuestion(players, "pick", seenDraft), null);
assert.equal(selectDraftQuestion(players, "year", draftPool(players, "year").map((player) => player.id)), null);

for (const mode of ["year", "pick"]) {
  const poolSize = draftPool(players, mode).length;
  const random = mulberry32(mode === "year" ? 5 : 9);
  let ids = [];
  let previous = null;
  let seen = new Set();
  let best = 0;
  for (let streak = 0; streak < poolSize + 3; streak += 1) {
    const step = continueDraftQuestion(players, mode, ids, { avoidId: previous, random });
    assert.ok(step, `${mode} continues at ${streak}`);
    assert.equal(step.question.mode, mode);
    assert.equal(step.question.choices.length, 4);
    assert.equal(new Set(step.question.choices).size, 4);
    assert.ok(step.question.choices.includes(step.question.answer));
    if (step.cycled) {
      assert.equal(seen.size, poolSize, `${mode} cycle`);
      assert.notEqual(step.question.id, previous);
      seen = new Set();
    }
    assert.equal(seen.has(step.question.id), false, `${mode} repeats ${step.question.id}`);
    seen.add(step.question.id);
    best = streak + 1;
    previous = step.question.id;
    ids = step.usedIds;
  }
  assert.equal(best, poolSize + 3);
  assert.ok(seen.size > 1);
}

const yearBoundary = (() => {
  const poolSize = draftPool(players, "year").length;
  const random = mulberry32(21);
  let ids = [];
  let previous = null;
  let step = null;
  for (let streak = 0; streak < poolSize; streak += 1) {
    step = continueDraftQuestion(players, "year", ids, { avoidId: previous, random });
    previous = step.question.id;
    ids = step.usedIds;
  }
  return { ids, previous, step, poolSize };
})();
assert.equal(yearBoundary.ids.length, yearBoundary.poolSize);
assert.equal(selectDraftQuestion(players, "year", yearBoundary.ids), null);
store.clear();
writeActiveRun({
  game: "draft",
  mode: "year",
  phase: "revealing",
  streak: yearBoundary.poolSize,
  guess: yearBoundary.step.question.answer,
  result: "correct",
  playerId: yearBoundary.previous,
  choices: yearBoundary.step.question.choices,
  usedIds: yearBoundary.ids,
});
const parkedBoundary = restoreParkedDraftRun(players, "year");
assert.equal(parkedBoundary.phase, "revealing");
assert.equal(parkedBoundary.streak, yearBoundary.poolSize);
assert.equal(parkedBoundary.question.id, yearBoundary.previous);
assert.equal(parkedBoundary.result, "correct");
assert.equal(parkedBoundary.guess, yearBoundary.step.question.answer);
assert.deepEqual(parkedBoundary.usedIds, yearBoundary.ids);
const nextCycle = continueDraftQuestion(players, "year", parkedBoundary.usedIds, {
  avoidId: parkedBoundary.question.id,
  random: mulberry32(22),
});
assert.equal(nextCycle.cycled, true);
assert.notEqual(nextCycle.question.id, parkedBoundary.question.id);
assert.equal(nextCycle.question.choices.length, 4);
assert.equal(new Set(nextCycle.question.choices).size, 4);
assert.ok(nextCycle.question.choices.includes(nextCycle.question.answer));
writeActiveRun({
  game: "draft",
  mode: "year",
  phase: "playing",
  streak: yearBoundary.poolSize,
  guess: null,
  result: null,
  playerId: nextCycle.question.id,
  choices: nextCycle.question.choices,
  usedIds: nextCycle.usedIds,
});
const restoredCycle = restoreDraftRun(players);
assert.equal(restoredCycle.streak, yearBoundary.poolSize);
assert.equal(restoredCycle.question.id, nextCycle.question.id);
assert.deepEqual(restoredCycle.usedIds, nextCycle.usedIds);
writeStorage(DRAFT_BEST_KEYS.year, "12");
assert.equal(readStoredNumber(DRAFT_BEST_KEYS.year), 12);
assert.equal(restoredCycle.streak > 12, true);
const solo = [{ id: 7, name: "Only", draftYear: 2011, draftPick: 9 }];
let soloIds = [];
let soloPrevious = null;
for (let streak = 0; streak < 3; streak += 1) {
  const step = continueDraftQuestion(solo, "year", soloIds, { avoidId: soloPrevious, random: () => 0 });
  assert.equal(step.question.id, 7);
  assert.equal(step.question.choices.length, 4);
  assert.equal(new Set(step.question.choices).size, 4);
  assert.ok(step.question.choices.includes(2011));
  if (streak > 0) assert.equal(step.cycled, true);
  soloPrevious = step.question.id;
  soloIds = step.usedIds;
}
store.clear();

store.clear();
writeActiveRun({
  game: "classic",
  phase: "playing",
  streak: 4,
  pickedId: null,
  result: null,
  categoryId: "ppg",
  leftId: players[0].id,
  rightId: players[1].id,
  key: "ppg:test",
});
assert.equal(openingScreen(players), "classic");
const classicLeft = players.find((item) => item.ppg !== players[0].ppg) ?? players[1];
const classicKey = pairKey("ppg", players[0], classicLeft);
writeActiveRun({
  game: "classic",
  phase: "playing",
  streak: 4,
  pickedId: null,
  result: null,
  categoryId: "ppg",
  leftId: players[0].id,
  rightId: classicLeft.id,
  key: classicKey,
  usedKeys: ["ppg:1:2", classicKey],
});
const restoredClassic = restoreClassicRun(players);
assert.equal(restoredClassic.matchup.key, classicKey);
assert.ok(restoredClassic.usedKeys.includes("ppg:1:2"));
assert.ok(restoredClassic.usedKeys.includes(classicKey));
assert.equal(restoredClassic.usedKeys.filter((key) => key === classicKey).length, 1);
store.clear();
writeActiveRun({
  game: "classic",
  phase: "playing",
  streak: 4,
  pickedId: null,
  result: null,
  categoryId: "ppg",
  leftId: players[0].id,
  rightId: classicLeft.id,
  key: classicKey,
});
assert.equal(openingScreen(players), "classic");
const activeRun = readActiveRun();
assert.equal(activeRun.game, "classic");
assert.equal(activeRun.streak, 4);
store.clear();

const seenAnswers = [];
const seenCareerKeys = [];
let careerStreak = 0;
const careerRunLength = EXPERT_STREAK + 30;
while (careerStreak < careerRunLength) {
  const question = selectCareerQuestion(careerStreak, { usedIds: seenAnswers, usedKeys: seenCareerKeys });
  assert.ok(question, `career question at streak ${careerStreak}`);
  assert.equal(seenCareerKeys.includes(question.key), false);
  assert.equal(seenAnswers.includes(question.answerId), false);
  assert.equal(question.answer, question.player);
  if (careerStreak <= 5) assert.equal(question.band.id, "easy");
  else if (careerStreak <= 15) assert.equal(question.band.id, "medium");
  else if (careerStreak <= 99) assert.equal(question.band.id, "hard");
  else assert.equal(question.band.id, "expert");
  if (question.band.id === "expert") {
    assert.ok(Number.isInteger(question.hiddenIndex));
    assert.equal(typeof question.stops[question.hiddenIndex].team, "string");
  } else {
    assert.equal(question.hiddenIndex, null);
  }
  assert.ok(eligibleCareers(question.band.id).some((career) => career.id === question.answerId));
  seenAnswers.push(question.answerId);
  seenCareerKeys.push(question.key);
  careerStreak += 1;
}
assert.equal(careerStreak, careerRunLength);
assert.equal(new Set(seenAnswers).size, seenAnswers.length);
assert.equal(new Set(seenCareerKeys).size, seenCareerKeys.length);
const hardIdList = eligibleCareers("hard").map((career) => career.id);
assert.equal(selectCareerQuestionForBand("hard", { usedIds: hardIdList }), null);
const hardBoundary = continueCareerQuestion(50, {
  usedIds: hardIdList,
  avoidId: hardIdList.at(-1),
  random: () => 0,
});
assert.equal(hardBoundary.cycled, true);
assert.equal(hardBoundary.question.band.id, "hard");
assert.equal(hardBoundary.question.answer, hardBoundary.question.player);
assert.notEqual(hardBoundary.question.answerId, hardIdList.at(-1));
const hardIds = new Set(hardIdList);
assert.equal(hardBoundary.usedIds.filter((id) => hardIds.has(id)).length, 1);
const expertIdList = eligibleCareers("expert").map((career) => career.id);
const expertBoundary = continueCareerQuestion(400, {
  usedIds: expertIdList,
  usedKeys: [`${expertIdList[0]}:0`],
  avoidId: expertIdList[0],
  random: () => 0,
});
assert.equal(expertBoundary.cycled, true);
assert.equal(expertBoundary.question.band.id, "expert");
assert.notEqual(expertBoundary.question.answerId, expertIdList[0]);
assert.ok(expertBoundary.usedKeys.includes(`${expertIdList[0]}:0`));

const easyIds = eligibleCareers("easy").map((career) => career.id);
const easyCycle = continueCareerQuestion(4, {
  usedIds: easyIds,
  avoidId: easyIds[0],
  random: () => 0,
});
assert.equal(easyCycle.cycled, true);
assert.equal(easyCycle.question.band.id, "easy");
assert.notEqual(easyCycle.question.answerId, easyIds[0]);
const mediumIds = eligibleCareers("medium").map((career) => career.id);
const mediumCycle = continueCareerQuestion(10, {
  usedIds: mediumIds,
  avoidId: mediumIds[0],
  random: () => 0,
});
assert.equal(mediumCycle.cycled, true);
assert.equal(mediumCycle.question.band.id, "medium");
assert.notEqual(mediumCycle.question.answerId, mediumIds[0]);
const enteredMedium = continueCareerQuestion(6, { usedIds: easyIds, random: () => 0 });
assert.equal(enteredMedium.cycled, false);
assert.equal(enteredMedium.question.band.id, "medium");
const enteredHard = continueCareerQuestion(16, { usedIds: [...easyIds, ...mediumIds], random: () => 0 });
assert.equal(enteredHard.cycled, false);
assert.equal(enteredHard.question.band.id, "hard");

const careerRandom = mulberry32(11);
let cycleIds = [];
let cycleKeys = [];
let cyclePrevious = null;
let lastCareerStep = null;
const cycleSeen = { easy: new Set(), medium: new Set(), hard: new Set(), expert: new Set() };
const expertKeysSeen = new Set();
const careerTarget = EXPERT_STREAK + eligibleCareers("expert").length + 40;
for (let streak = 0; streak < careerTarget; streak += 1) {
  const step = continueCareerQuestion(streak, {
    usedIds: cycleIds,
    usedKeys: cycleKeys,
    avoidId: cyclePrevious,
    random: careerRandom,
  });
  assert.ok(step, `career continues at ${streak}`);
  assert.equal(step.question.answer, step.question.player);
  assert.ok(currentCareerQuestion(step.question), `career question at ${streak} is valid`);
  const band = careerBand(streak).id;
  assert.equal(step.question.band.id, band);
  if (band === "expert") {
    assert.equal(expertKeysSeen.has(step.question.key), false, "expert questions do not repeat before every hidden stop is used");
    expertKeysSeen.add(step.question.key);
  }
  if (step.cycled) {
    assert.notEqual(step.question.answerId, cyclePrevious);
    cycleSeen[band] = new Set([step.question.answerId]);
  } else {
    assert.equal(cycleSeen[band].has(step.question.answerId), false);
    cycleSeen[band].add(step.question.answerId);
  }
  cyclePrevious = step.question.answerId;
  cycleIds = step.usedIds;
  cycleKeys = step.usedKeys;
  lastCareerStep = step;
}
assert.ok(careerTarget > EXPERT_STREAK + 200);
assert.equal(lastCareerStep.question.band.id, "expert");
store.clear();
writeStorage(CAREER_BEST_KEY, "20");
writeActiveRun({
  game: "career",
  phase: "playing",
  streak: careerTarget,
  picked: null,
  result: null,
  question: lastCareerStep.question,
  usedIds: cycleIds,
  usedKeys: cycleKeys,
});
const parkedCareer = restoreCareerRun();
assert.equal(parkedCareer.streak, careerTarget);
assert.equal(parkedCareer.phase, "playing");
assert.deepEqual(parkedCareer.usedIds, cycleIds);
assert.equal(readStoredNumber(CAREER_BEST_KEY), 20);
const resumedCareer = continueCareerQuestion(parkedCareer.streak, {
  usedIds: parkedCareer.usedIds,
  usedKeys: parkedCareer.usedKeys,
  avoidId: parkedCareer.question.answerId,
  random: () => 0.2,
});
assert.ok(resumedCareer);
assert.equal(parkedCareer.usedIds.includes(resumedCareer.question.answerId), false);
store.clear();
assert.equal(selectCareerQuestion(0, { usedIds: easyIds }), null);
const repeated = selectCareerQuestion(0, { usedIds: [easyIds[0]] });
assert.ok(repeated);
assert.notEqual(repeated.answerId, easyIds[0]);
assert.equal(repeated.band.id, "easy");

const firstCareer = selectCareerQuestion(0, { usedIds: [] });
const secondCareer = selectCareerQuestion(1, { usedIds: [firstCareer.answerId] });
writeActiveRun({
  game: "career",
  phase: "playing",
  streak: 1,
  picked: null,
  result: null,
  question: secondCareer,
  usedIds: [firstCareer.answerId, secondCareer.answerId],
});
const restoredCareer = restoreCareerRun();
assert.deepEqual(restoredCareer.usedIds, [firstCareer.answerId, secondCareer.answerId]);
assert.ok(restoredCareer.usedKeys.includes(secondCareer.key));
const continued = selectCareerQuestion(2, { usedIds: restoredCareer.usedIds, usedKeys: restoredCareer.usedKeys });
assert.ok(continued);
assert.equal(restoredCareer.usedIds.includes(continued.answerId), false);
store.clear();

writeActiveRun({
  game: "career",
  phase: "revealing",
  streak: 1,
  picked: secondCareer.answer,
  result: "correct",
  question: { ...secondCareer, answerId: undefined },
  usedIds: [firstCareer.answerId],
});
const refreshed = restoreCareerRun();
assert.ok(refreshed.usedIds.includes(firstCareer.answerId));
assert.ok(refreshed.usedIds.includes(secondCareer.answerId));
const afterRefresh = selectCareerQuestion(refreshed.streak, { usedIds: refreshed.usedIds });
assert.equal(refreshed.usedIds.includes(afterRefresh.answerId), false);
store.clear();

const legacyCareer = {
  ...secondCareer,
  hiddenIndex: 0,
  key: `${secondCareer.answerId}:0`,
  answer: secondCareer.stops[0].team,
};
writeActiveRun({
  game: "career",
  phase: "playing",
  streak: 2,
  picked: null,
  result: null,
  question: legacyCareer,
  usedIds: [legacyCareer.answerId],
});
const migratedCareer = restoreCareerRun();
assert.equal(migratedCareer.question.answer, legacyCareer.player);
assert.equal(migratedCareer.question.answerId, legacyCareer.answerId);
assert.equal(migratedCareer.question.hiddenIndex, null);
assert.equal(migratedCareer.question.key, `${legacyCareer.answerId}:path`);
assert.equal(migratedCareer.streak, 2);
store.clear();

// Saved runs holding a question that is no longer valid get a fresh question at the same streak.
for (const [label, question, streak] of [["Ewing", ewingQuestion, 7], ["Suggs", suggsQuestion, 99]]) {
  for (const phase of ["playing", "revealing"]) {
    writeStorage(CAREER_BEST_KEY, "140");
    writeActiveRun({
      game: "career",
      phase,
      streak,
      picked: phase === "revealing" ? "Somebody Else" : null,
      result: phase === "revealing" ? "wrong" : null,
      question,
      usedIds: [question.answerId],
      usedKeys: [question.key],
    });
    const replaced = restoreCareerRun();
    assert.ok(replaced, `${label} ${phase} run restores`);
    assert.equal(replaced.phase, "playing");
    assert.equal(replaced.streak, streak);
    assert.equal(replaced.result, null);
    assert.equal(replaced.picked, null);
    assert.notEqual(replaced.question.answerId, question.answerId);
    assert.ok(currentCareerQuestion(replaced.question));
    assert.equal(replaced.question.band.id, careerBand(streak).id);
    assert.deepEqual(restoreCareerRun().question, replaced.question);
    assert.equal(readStoredNumber(CAREER_BEST_KEY), 140);
    store.clear();
  }
}
const expertSaved = continueCareerQuestion(100, { random: () => 0.5 }).question;
writeActiveRun({ game: "career", phase: "playing", streak: 100, picked: null, result: null, question: expertSaved, usedIds: [expertSaved.answerId] });
assert.deepEqual(restoreCareerRun().question, expertSaved);
store.clear();

const firstDraft = selectDraftQuestion(players, "year", [], () => 0);
writeActiveRun({
  game: "draft",
  mode: "year",
  phase: "playing",
  streak: 2,
  guess: "",
  result: null,
  playerId: firstDraft.id,
  usedIds: [firstDraft.id],
});
assert.equal(openingScreen(players), "draft");
const restoredDraft = restoreDraftRun(players);
assert.equal(restoredDraft.question.id, firstDraft.id);
assert.equal(restoredDraft.question.answer, firstDraft.answer);
assert.equal(restoredDraft.usedIds.includes(firstDraft.id), true);
assert.equal(restoredDraft.question.choices.length, 4);
assert.ok(restoredDraft.question.choices.includes(restoredDraft.question.answer));
const nextDraft = selectDraftQuestion(players, "year", restoredDraft.usedIds, () => 0);
assert.notEqual(nextDraft.id, firstDraft.id);
store.clear();

const yearQuestion = selectDraftQuestion(players, "year", [], () => 0.2);
assert.equal(yearQuestion.choices.length, 4);
assert.ok(yearQuestion.choices.every((choice) => Number.isInteger(choice) && choice >= 1947 && choice <= 2026));
const sameDraft = selectDraftQuestion(players, "year", [], () => 0);
assert.notEqual(selectDraftQuestion(players, "year", [sameDraft.id], () => 0).id, sameDraft.id);
assert.equal(selectDraftQuestion(players, "year", [], () => 0).id, sameDraft.id);

let draftState = { unlocked: [] };
const firstBadge = applyDraftStreak(draftState, 1);
assert.equal(firstBadge.fresh[0].name, "First Pick");
assert.equal(applyDraftStreak(firstBadge.state, 1).fresh.length, 0);
const boardBadge = applyDraftStreak(firstBadge.state, 5);
assert.equal(boardBadge.fresh[0].name, "On the Board");
assert.equal(applyDraftStreak({ unlocked: [] }, 30).fresh.some((badge) => badge.name === "No. 1 Pick"), false);
const allBadges = applyDraftStreak({ unlocked: [] }, 50);
assert.equal(allBadges.fresh.length, DRAFT_BADGES.length);
assert.equal(allBadges.fresh.at(-1).name, "Hall of Fame");
assert.equal(applyDraftStreak(allBadges.state, 50).fresh.length, 0);
writeStorage(DRAFT_BADGE_KEYS.year, JSON.stringify(boardBadge.state));
writeStorage(DRAFT_BEST_KEYS.year, "10");
const savedYearBadges = readDraftBadges("year");
assert.ok(savedYearBadges.unlocked.includes("first-pick"));
assert.ok(savedYearBadges.unlocked.includes("draft-expert"));
assert.equal(savedYearBadges.unlocked.includes("hall-of-fame"), false);
assert.equal(readDraftBadges("pick").unlocked.length, 0);
store.clear();

assert.equal(nextDateKey("2026-10-10"), "2026-10-11");
assert.equal(nextDateKey("2026-12-31"), "2027-01-01");
assert.equal(nextDateKey("2024-02-28"), "2024-02-29");
assert.equal(nextDateKey("2026-02-28"), "2026-03-01");

const careerDailyDate = "2026-10-10";
const careerDailyQuestions = buildCareerDaily(careerDailyDate);
assert.equal(careerDailyQuestions.length, QUIZ_DAILY_LENGTH);
assert.deepEqual(careerDailyQuestions, buildCareerDaily(careerDailyDate));
assert.deepEqual(careerDailyQuestions.map((question) => question.band.id), ["easy", "medium", "medium", "hard", "hard"]);
assert.equal(new Set(careerDailyQuestions.map((question) => question.answerId)).size, QUIZ_DAILY_LENGTH);
for (const question of careerDailyQuestions) {
  assert.equal(question.answer, question.player);
  assert.equal(question.hiddenIndex, null);
  assert.ok(currentCareerQuestion(question));
  assert.equal(careerPlayerAccepted(question, question.player), true);
}
for (let day = 1; day <= 28; day += 1) {
  for (const question of buildCareerDaily(`2026-11-${String(day).padStart(2, "0")}`)) {
    assert.ok(currentCareerQuestion(question));
    assert.notEqual(question.answerId, suggs.id);
    assert.notEqual(question.answerId, wagner.id);
  }
}
assert.notDeepEqual(
  careerDailyQuestions.map((question) => question.answerId),
  buildCareerDaily("2026-10-11").map((question) => question.answerId),
);
assert.equal(buildCareerDaily("bad-date"), null);
for (const date of ["2024-02-29", "2026-01-01", "2026-06-15", "2026-12-31"]) {
  const questions = buildCareerDaily(date);
  assert.equal(questions.length, QUIZ_DAILY_LENGTH);
  assert.deepEqual(questions, buildCareerDaily(date));
}

const draftNow = new Date(2026, 9, 10);
const draftYearDaily = buildDraftDaily(players, "year", careerDailyDate, draftNow);
const draftPickDaily = buildDraftDaily(players, "pick", careerDailyDate, draftNow);
assert.equal(draftYearDaily.length, QUIZ_DAILY_LENGTH);
assert.equal(draftPickDaily.length, QUIZ_DAILY_LENGTH);
assert.deepEqual(draftYearDaily, buildDraftDaily(players, "year", careerDailyDate, draftNow));
assert.deepEqual(draftPickDaily, buildDraftDaily(players, "pick", careerDailyDate, draftNow));
assert.notDeepEqual(
  draftYearDaily.map((question) => [question.id, ...question.choices]),
  buildDraftDaily(players, "year", "2026-11-02", draftNow).map((question) => [question.id, ...question.choices]),
);
for (const question of draftYearDaily) {
  const player = players.find((item) => item.id === question.id);
  assert.equal(question.mode, "year");
  assert.equal(question.answer, player.draftYear);
  assert.ok(question.choices.includes(player.draftYear));
  assert.equal(new Set(question.choices).size, 4);
}
for (const question of draftPickDaily) {
  const player = players.find((item) => item.id === question.id);
  assert.equal(question.mode, "pick");
  assert.equal(question.answer, player.draftPick);
  assert.ok(question.choices.includes(player.draftPick));
  assert.equal(new Set(question.choices).size, 4);
}
assert.equal(buildDraftDaily([], "year", careerDailyDate, draftNow), null);
assert.equal(buildDraftDaily(players, "other", careerDailyDate, draftNow), null);
assert.ok(draftYearDaily.every((question) => question.mode === "year"));
assert.ok(draftPickDaily.every((question) => question.mode === "pick"));

let quizRecord = emptyQuizDailyRecord();
assert.equal(quizRunStatus(quizRecord, careerDailyDate), "new");
assert.equal(noteQuizAnswer(quizRecord, { date: careerDailyDate, index: 0, correct: 2, total: 5 }).accepted, false);
const revealedQuiz = noteQuizAnswer(quizRecord, {
  date: careerDailyDate,
  index: 0,
  correct: 1,
  total: 5,
  choice: "Stephen Curry",
  result: "correct",
});
assert.equal(revealedQuiz.accepted, true);
assert.equal(revealedQuiz.finished, false);
assert.equal(revealedQuiz.record.active.phase, "revealing");
assert.equal(revealedQuiz.record.active.index, 0);
assert.equal(revealedQuiz.record.active.choice, "Stephen Curry");
assert.equal(revealedQuiz.record.active.result, "correct");
assert.equal(revealedQuiz.record.active.correct, 1);
assert.equal(revealedQuiz.record.days[careerDailyDate], undefined);
assert.equal(noteQuizAnswer(revealedQuiz.record, {
  date: careerDailyDate,
  index: 0,
  correct: 1,
  total: 5,
  choice: "Stephen Curry",
  result: "correct",
}).accepted, false);
const wrongQuiz = noteQuizAnswer(emptyQuizDailyRecord(), {
  date: careerDailyDate,
  index: 0,
  correct: 0,
  total: 5,
  choice: 2014,
  result: "wrong",
});
assert.equal(wrongQuiz.record.active.result, "wrong");
assert.equal(wrongQuiz.record.active.choice, 2014);
assert.equal(wrongQuiz.record.active.index, 0);
assert.equal(wrongQuiz.record.days[careerDailyDate], undefined);
const firstStep = continueQuiz(revealedQuiz.record);
assert.equal(firstStep.advanced, true);
assert.equal(firstStep.finished, false);
assert.equal(firstStep.record.active.index, 1);
assert.equal(firstStep.record.active.phase, "playing");
assert.equal(firstStep.record.active.correct, 1);
quizRecord = firstStep.record;
for (let index = 1; index < QUIZ_DAILY_LENGTH; index += 1) {
  const correct = index === QUIZ_DAILY_LENGTH - 1 ? 4 : index;
  const noted = noteQuizAnswer(quizRecord, {
    date: careerDailyDate,
    index,
    correct,
    total: 5,
    choice: index,
    result: correct > quizRecord.active.correct ? "correct" : "wrong",
  });
  assert.equal(noted.accepted, true);
  assert.equal(noted.finished, false);
  assert.equal(noted.record.days[careerDailyDate], undefined);
  assert.equal(noted.record.active.phase, "revealing");
  assert.equal(noted.record.active.index, index);
  const stepped = continueQuiz(noted.record);
  quizRecord = stepped.record;
}
assert.equal(quizRecord.days[careerDailyDate].correct, 4);
assert.equal(quizRecord.days[careerDailyDate].total, 5);
assert.equal(quizRecord.active, null);
assert.equal(quizRunStatus(quizRecord, careerDailyDate), "complete");
assert.equal(quizRecord.completedDates.filter((date) => date === careerDailyDate).length, 1);
const lockedQuiz = noteQuizAnswer(quizRecord, {
  date: careerDailyDate,
  index: 0,
  correct: 5,
  total: 5,
  choice: "Stephen Curry",
  result: "correct",
});
assert.equal(lockedQuiz.accepted, false);
assert.equal(lockedQuiz.record.days[careerDailyDate].correct, 4);
const quizAgain = continueQuiz(quizRecord);
assert.equal(quizAgain.advanced, false);
assert.equal(quizAgain.record.days[careerDailyDate].correct, 4);

store.clear();
assert.equal(writeQuizDailyRecord(CAREER_DAILY_KEY, revealedQuiz.record), true);
const resumedReveal = readQuizDailyRecord(CAREER_DAILY_KEY);
assert.equal(resumedReveal.active.phase, "revealing");
assert.equal(resumedReveal.active.index, 0);
assert.equal(resumedReveal.active.choice, "Stephen Curry");
assert.equal(resumedReveal.active.result, "correct");
assert.equal(resumedReveal.active.correct, 1);
assert.equal(writeQuizDailyRecord(CAREER_DAILY_KEY, wrongQuiz.record), true);
assert.equal(readQuizDailyRecord(CAREER_DAILY_KEY).active.result, "wrong");
assert.equal(readQuizDailyRecord(CAREER_DAILY_KEY).active.choice, 2014);
assert.equal(writeQuizDailyRecord(CAREER_DAILY_KEY, firstStep.record), true);
const resumedQuiz = readQuizDailyRecord(CAREER_DAILY_KEY);
assert.equal(resumedQuiz.active.index, 1);
assert.equal(resumedQuiz.active.phase, "playing");
assert.equal(resumedQuiz.active.correct, 1);
assert.equal(quizRunStatus(resumedQuiz, careerDailyDate), "progress");
writeQuizDailyRecord(CAREER_DAILY_KEY, {
  version: 1,
  lastCompleted: "",
  streak: 0,
  days: {},
  completedDates: [],
  active: { date: careerDailyDate, index: 2, correct: 1, credited: 2 },
});
const legacyQuiz = readQuizDailyRecord(CAREER_DAILY_KEY);
assert.equal(legacyQuiz.active.index, 2);
assert.equal(legacyQuiz.active.phase, "playing");
assert.equal(legacyQuiz.active.correct, 1);
assert.equal(legacyQuiz.days[careerDailyDate], undefined);
assert.deepEqual(buildCareerDaily(careerDailyDate), careerDailyQuestions);
failWrite = true;
assert.equal(writeQuizDailyRecord(CAREER_DAILY_KEY, quizRecord), false);
failWrite = false;
store.clear();

function finishDates(dates, correct) {
  return dates.reduce((record, date) => commitQuizResult(record, {
    date,
    correct,
    total: QUIZ_DAILY_LENGTH,
  }), emptyQuizDailyRecord());
}

const scattered = finishDates(["2026-10-01", "2026-10-03", "2026-10-10"], 2);
assert.equal(activeQuizStreak(scattered, "2026-10-10"), 1);
assert.equal(longestConsecutive(scattered.completedDates), 1);
const scatteredBadges = applyModeDailyBadges({ unlocked: [] }, scattered, "2026-10-10");
assert.deepEqual(scatteredBadges.fresh.map((badge) => badge.name), ["Daily Debut", "Daily Regular"]);
assert.equal(scatteredBadges.state.unlocked.includes("perfect-day"), false);
assert.equal(scatteredBadges.state.unlocked.includes("daily-streak"), false);

const week = finishDates(["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"], 5);
assert.equal(activeQuizStreak(week, "2026-10-10"), 7);
assert.equal(activeQuizStreak(week, "2026-10-12"), 0);
const weekBadges = applyModeDailyBadges({ unlocked: [] }, week, "2026-10-10");
assert.ok(weekBadges.state.unlocked.includes("perfect-day"));
assert.ok(weekBadges.state.unlocked.includes("daily-streak"));
assert.ok(weekBadges.state.unlocked.includes("perfect-week"));
assert.equal(weekBadges.state.unlocked.includes("perfect-month"), false);
assert.equal(weekBadges.state.unlocked.includes("ten-day-player"), false);
assert.equal(weekBadges.state.unlocked.includes("monthly-master"), false);
assert.equal(applyModeDailyBadges(weekBadges.state, week, "2026-10-10").fresh.length, 0);

const monthDates = [];
let cursor = "2026-09-11";
for (let count = 0; count < 30; count += 1) {
  monthDates.push(cursor);
  cursor = nextDateKey(cursor);
}
assert.equal(monthDates.at(-1), "2026-10-10");
const month = finishDates(monthDates, 3);
const monthBadges = applyModeDailyBadges({ unlocked: [] }, month, "2026-10-10");
assert.equal(longestConsecutive(month.completedDates), 30);
assert.ok(monthBadges.state.unlocked.includes("monthly-master"));
assert.ok(monthBadges.state.unlocked.includes("ten-day-player"));
assert.ok(monthBadges.state.unlocked.includes("dedicated-fan"));
assert.equal(monthBadges.state.unlocked.includes("perfect-day"), false);
assert.equal(monthBadges.state.unlocked.includes("perfect-week"), false);
assert.equal(monthBadges.state.unlocked.includes("perfect-month"), false);
assert.equal(monthBadges.state.unlocked.includes("half-century-club"), false);
assert.equal(monthBadges.fresh.length, 6);
assert.equal(BADGES.some((badge) => badge.id === "daily-grinder" || badge.id === "monthly-regular"), false);
assert.equal(BADGES.some((badge) => badge.id === "perfect-week" || badge.id === "daily-legend"), false);

const higherPerfectDay = commitOfficialResult(emptyDailyRecord(), {
  date: "2026-10-10",
  correct: DAILY_LENGTH,
  total: DAILY_LENGTH,
  score: 20,
  difficulty: "Easy",
});
const higherPerfectBadges = applyModeDailyBadges({ unlocked: [] }, higherPerfectDay, "2026-10-10");
assert.ok(higherPerfectBadges.state.unlocked.includes("daily-debut"));
assert.ok(higherPerfectBadges.state.unlocked.includes("perfect-day"));
const higherShort = commitOfficialResult(emptyDailyRecord(), {
  date: "2026-10-10",
  correct: DAILY_LENGTH - 1,
  total: DAILY_LENGTH,
  score: 10,
  difficulty: "Easy",
});
assert.equal(applyModeDailyBadges({ unlocked: [] }, higherShort, "2026-10-10").state.unlocked.includes("perfect-day"), false);

function dateSpan(start, count) {
  const dates = [];
  let cursor = start;
  for (let index = 0; index < count; index += 1) {
    dates.push(cursor);
    cursor = nextDateKey(cursor);
  }
  return dates;
}

const sixPerfect = finishDates(dateSpan("2026-10-05", 6), QUIZ_DAILY_LENGTH);
assert.equal(applyModeDailyBadges({ unlocked: [] }, sixPerfect, "2026-10-10").state.unlocked.includes("perfect-week"), false);
const perfectMonth = finishDates(dateSpan("2026-09-11", 30), QUIZ_DAILY_LENGTH);
const perfectMonthBadges = applyModeDailyBadges({ unlocked: [] }, perfectMonth, "2026-10-10");
assert.ok(perfectMonthBadges.state.unlocked.includes("perfect-week"));
assert.ok(perfectMonthBadges.state.unlocked.includes("perfect-month"));
assert.equal(modeDailyStats(perfectMonth, "2026-10-10").perfectStreak, 30);

const tenDays = finishDates(dateSpan("2026-01-01", 10), 1);
const tenStats = modeDailyStats(tenDays, "2026-01-10");
assert.equal(tenStats.differentDays, 10);
assert.ok(applyModeDailyBadges({ unlocked: [] }, tenDays, "2026-01-10").state.unlocked.includes("ten-day-player"));
assert.equal(applyModeDailyBadges({ unlocked: [] }, tenDays, "2026-01-10").state.unlocked.includes("dedicated-fan"), false);
const tenBadge = MODE_DAILY_BADGES.find((badge) => badge.id === "ten-day-player");
const dedicatedBadge = MODE_DAILY_BADGES.find((badge) => badge.id === "dedicated-fan");
const perfectWeekBadge = MODE_DAILY_BADGES.find((badge) => badge.id === "perfect-week");
assert.equal(modeDailyBadgeProgress(dedicatedBadge, { unlocked: [] }, tenStats), "10 of 25 days");
assert.equal(modeDailyBadgeProgress(tenBadge, { unlocked: ["ten-day-player"] }, tenStats), "Unlocked");
assert.equal(modeDailyBadgeProgress(perfectWeekBadge, { unlocked: [] }, modeDailyStats(sixPerfect, "2026-10-10")), "6 of 7 days");

const fifty = finishDates(dateSpan("2026-01-01", 50), 2);
const hundred = finishDates(dateSpan("2025-01-01", 100), 2);
const legend = finishDates(dateSpan("2025-01-01", 365), 2);
assert.ok(applyModeDailyBadges({ unlocked: [] }, fifty, "2026-02-19").state.unlocked.includes("half-century-club"));
assert.equal(applyModeDailyBadges({ unlocked: [] }, fifty, "2026-02-19").state.unlocked.includes("century-club"), false);
assert.ok(applyModeDailyBadges({ unlocked: [] }, hundred, "2025-04-10").state.unlocked.includes("century-club"));
assert.equal(applyModeDailyBadges({ unlocked: [] }, hundred, "2025-04-10").state.unlocked.includes("daily-legend"), false);
assert.ok(applyModeDailyBadges({ unlocked: [] }, legend, "2025-12-31").state.unlocked.includes("daily-legend"));
assert.equal(applyModeDailyBadges({ unlocked: [] }, legend, "2025-12-31").state.unlocked.includes("perfect-day"), false);

function finishHigher(dates, correct) {
  return dates.reduce((record, date) => commitOfficialResult(record, {
    date,
    correct,
    total: DAILY_LENGTH,
    score: correct,
    difficulty: "Easy",
  }), emptyDailyRecord());
}
const higherWeek = finishHigher(dateSpan("2026-10-04", 7), DAILY_LENGTH);
const higherWeekBadges = applyModeDailyBadges({ unlocked: [] }, higherWeek, "2026-10-10");
assert.ok(higherWeekBadges.state.unlocked.includes("perfect-week"));
assert.equal(higherWeekBadges.state.unlocked.includes("perfect-month"), false);
const higherImperfectWeek = finishHigher(dateSpan("2026-10-04", 7), DAILY_LENGTH - 1);
assert.equal(applyModeDailyBadges({ unlocked: [] }, higherImperfectWeek, "2026-10-10").state.unlocked.includes("perfect-week"), false);
assert.ok(applyModeDailyBadges({ unlocked: [] }, higherImperfectWeek, "2026-10-10").state.unlocked.includes("daily-streak"));

const yearSameDay = finishDates(["2026-10-09"], 4);
const pickSameDay = finishDates(["2026-10-09"], QUIZ_DAILY_LENGTH);
const sameDay = mergeModeDailyRecords([yearSameDay, pickSameDay]);
assert.deepEqual(sameDay.completedDates, ["2026-10-09"]);
assert.equal(modeDailyStats(sameDay, "2026-10-09").differentDays, 1);
assert.equal(modeDailyStats(sameDay, "2026-10-09").perfect, true);
assert.equal(sameDay.days["2026-10-09"].correct, QUIZ_DAILY_LENGTH);
const bothImperfect = mergeModeDailyRecords([
  finishDates(["2026-10-09"], 3),
  finishDates(["2026-10-09"], 4),
]);
assert.equal(modeDailyStats(bothImperfect, "2026-10-09").perfect, false);
assert.equal(bothImperfect.days["2026-10-09"].correct, 4);
const yearDays = finishDates(["2026-10-01", "2026-10-02"], QUIZ_DAILY_LENGTH);
const pickDays = finishDates(["2026-10-02", "2026-10-03"], 3);
const sharedDays = mergeModeDailyRecords([yearDays, pickDays]);
assert.deepEqual(sharedDays.completedDates, ["2026-10-01", "2026-10-02", "2026-10-03"]);
assert.equal(sharedDays.days["2026-10-02"].correct, QUIZ_DAILY_LENGTH);
assert.equal(modeDailyStats(sharedDays, "2026-10-03").perfectStreak, 0);
assert.equal(modeDailyStats(sharedDays, "2026-10-02").perfectStreak, 2);

store.clear();
writeStorage(CAREER_BEST_KEY, "12");
writeStorage(DRAFT_BEST_KEYS.year, "9");
writeStorage(DRAFT_BEST_KEYS.pick, "6");
writeStorage(DRAFT_DAILY_KEYS.year, JSON.stringify(week));
writeStorage(CAREER_DAILY_BADGE_KEY, JSON.stringify(weekBadges.state));
assert.equal(readStoredNumber(CAREER_BEST_KEY), 12);
assert.equal(readStoredNumber(DRAFT_BEST_KEYS.year), 9);
assert.equal(readStoredNumber(DRAFT_BEST_KEYS.pick), 6);
assert.equal(readCareerBadges().unlocked.includes("daily-debut"), false);
assert.equal(readDraftBadges("year").unlocked.includes("daily-debut"), false);
assert.equal(readDraftBadges("pick").unlocked.includes("perfect-day"), false);
assert.ok(readModeDailyBadges(CAREER_DAILY_BADGE_KEY, week, "2026-10-10").unlocked.includes("daily-streak"));
assert.equal(readModeDailyBadges(DRAFT_DAILY_BADGE_KEYS.year, readQuizDailyRecord(DRAFT_DAILY_KEYS.year), "2026-10-10").unlocked.includes("perfect-day"), true);
assert.equal(readModeDailyBadges(DRAFT_DAILY_BADGE_KEYS.pick, emptyQuizDailyRecord(), "2026-10-10").unlocked.includes("daily-debut"), false);
writeStorage(DRAFT_DAILY_BADGE_KEYS.year, JSON.stringify({ unlocked: ["daily-debut"] }));
writeStorage(DRAFT_DAILY_BADGE_KEYS.pick, JSON.stringify({ unlocked: ["daily-regular"] }));
const migrated = readUnlockedModeDailyBadges(DRAFT_DAILY_BADGE_KEY);
assert.ok(migrated.unlocked.includes("daily-debut"));
assert.ok(migrated.unlocked.includes("daily-regular"));
const sharedDraft = syncModeDailyBadges(
  DRAFT_DAILY_BADGE_KEY,
  DRAFT_DAILY_KEYS.year,
  "2026-10-10",
  () => mergeModeDailyRecords([
    readQuizDailyRecord(DRAFT_DAILY_KEYS.year),
    readQuizDailyRecord(DRAFT_DAILY_KEYS.pick),
  ]),
);
assert.ok(sharedDraft.unlocked.includes("perfect-day"));
assert.ok(sharedDraft.unlocked.includes("perfect-week"));
assert.ok(sharedDraft.unlocked.includes("daily-debut"));
const reloaded = readUnlockedModeDailyBadges(DRAFT_DAILY_BADGE_KEY);
assert.ok(reloaded.unlocked.includes("perfect-week"));
assert.equal(applyModeDailyBadges(reloaded, readQuizDailyRecord(DRAFT_DAILY_KEYS.year), "2026-10-10").fresh.length, 0);
writeStorage(HIGHER_DAILY_BADGE_KEY, JSON.stringify(higherWeekBadges.state));
assert.ok(readUnlockedModeDailyBadges(HIGHER_DAILY_BADGE_KEY).unlocked.includes("perfect-week"));
assert.equal(readQuizDailyRecord(CAREER_DAILY_KEY).completedDates.length, 0);
store.clear();

assert.equal(boxScoreErrors.length, 0);
assert.ok(scoredGames.length >= 1200);
const openingNight = scoredGames.find((game) => (
  game.date === "2025-10-22"
  && game.home === "New York Knicks"
  && game.away === "Cleveland Cavaliers"
));
assert.ok(openingNight);
assert.equal(openingNight.awayScore, 111);
assert.equal(openingNight.homeScore, 119);
assert.equal(openingNight.players.find((player) => player.name === "Donovan Mitchell")?.pts, 31);
assert.equal(openingNight.players.find((player) => player.name === "Jalen Brunson")?.pts, 23);
assert.equal(openingNight.players.some((player) => player.name === "Luke Travers"), false);
assert.equal(scoredGames.some((game) => game.home === "Team Stars" || game.away === "World"), false);
for (const game of scoredGames) {
  for (const player of game.players) {
    assert.equal(Number.isInteger(player.pts), true);
    assert.ok(player.pts >= 0);
    assert.ok(player.name);
    assert.ok(player.team === game.home || player.team === game.away);
  }
  const awayPoints = game.players.filter((player) => player.team === game.away).reduce((sum, player) => sum + player.pts, 0);
  const homePoints = game.players.filter((player) => player.team === game.home).reduce((sum, player) => sum + player.pts, 0);
  assert.equal(awayPoints, game.awayScore);
  assert.equal(homePoints, game.homeScore);
}

const tiedGame = [{
  id: "tie",
  date: "2025-10-22",
  home: "Boston Celtics",
  away: "New York Knicks",
  players: [
    { id: 1, name: "A", team: "Boston Celtics", pts: 10 },
    { id: 2, name: "B", team: "New York Knicks", pts: 10 },
  ],
}];
assert.equal(selectScoredQuestion(0, { games: tiedGame }), null);
const missingPoints = [{
  id: "missing",
  date: "2025-10-22",
  home: "Boston Celtics",
  away: "New York Knicks",
  players: [
    { id: 1, name: "A", team: "Boston Celtics", pts: 12 },
    { id: 2, name: "B", team: "New York Knicks", pts: null },
    { id: 3, name: "C", team: "Boston Celtics", pts: 4 },
  ],
}];
assert.equal(selectScoredQuestion(0, { games: missingPoints }), null);
const tiedTrio = [{
  id: "tied-trio",
  date: "2025-10-22",
  home: "Boston Celtics",
  away: "New York Knicks",
  players: [
    { id: 1, name: "A", team: "Boston Celtics", pts: 20 },
    { id: 2, name: "B", team: "New York Knicks", pts: 10 },
    { id: 3, name: "C", team: "Boston Celtics", pts: 10 },
  ],
}];
assert.equal(selectScoredQuestion(0, { games: tiedTrio }), null);

const usedScored = [];
for (let round = 0; round < 24; round += 1) {
  const question = selectScoredQuestion(round, { usedKeys: usedScored });
  assert.ok(question, `scored ranking ${round}`);
  assert.equal(question.players.length, 3);
  assert.equal(usedScored.includes(question.key), false);
  assert.equal(question.key, scoredTrioKey(question.gameId, question.players.map((player) => player.id)));
  assert.equal(new Set(question.players.map((player) => player.pts)).size, 3);
  const ranking = [...question.players].sort((left, right) => right.pts - left.pts || left.id - right.id);
  assert.deepEqual(question.ranking, ranking.map((player) => player.id));
  assert.equal(positionCredit(question.ranking, question.ranking), 2);
  assert.equal(positionCredit(question.ranking, [question.ranking[1], question.ranking[2], question.ranking[0]]), 0);
  assert.equal(positionCredit(question.ranking, [...question.ranking].reverse()), 1);
  usedScored.push(question.key);
}

const scoredToday = buildScoredDaily("2026-10-11");
const scoredTodayAgain = buildScoredDaily("2026-10-11");
assert.equal(scoredToday.length, QUIZ_DAILY_LENGTH);
assert.deepEqual(scoredToday.map((question) => question.key), scoredTodayAgain.map((question) => question.key));
assert.equal(new Set(scoredToday.map((question) => question.key)).size, QUIZ_DAILY_LENGTH);
assert.notDeepEqual(
  scoredToday.map((question) => question.key),
  buildScoredDaily("2026-10-12").map((question) => question.key),
);
for (const question of scoredToday) {
  assert.equal(new Set(question.players.map((player) => player.pts)).size, 3);
}

const mitchell = openingNight.players.find((player) => player.name === "Donovan Mitchell");
const brunson = openingNight.players.find((player) => player.name === "Jalen Brunson");
const third = openingNight.players.find((player) => (
  player.id !== mitchell.id && player.id !== brunson.id && player.pts !== mitchell.pts && player.pts !== brunson.pts
));
const trioIds = [brunson.id, mitchell.id, third.id];
const savedQuestion = questionFromSaved(openingNight.id, trioIds, 4);
assert.equal(savedQuestion.players[0].pts, 23);
assert.equal(savedQuestion.players[1].pts, 31);
assert.equal(savedQuestion.dateLabel, "Oct 22, 2025");
assert.equal(savedQuestion.away, "Cleveland Cavaliers");
assert.equal(savedQuestion.home, "New York Knicks");
assert.equal(savedQuestion.key, scoredTrioKey(openingNight.id, [...trioIds].reverse()));
assert.equal(questionFromSaved(openingNight.id, [mitchell.id, brunson.id, third.id].filter((id, index, ids) => ids.indexOf(id) === index && id === mitchell.id)), null);
assert.equal(questionFromSaved(openingNight.id, [third.id, brunson.id, openingNight.players.find((player) => player.pts === third.pts && player.id !== third.id)?.id].filter(Boolean)), null);
writeActiveRun({
  game: "scored",
  phase: "revealing",
  streak: 6,
  dealtStreak: 4,
  picks: [...savedQuestion.ranking].reverse(),
  credit: 1,
  result: "placed",
  gameId: openingNight.id,
  playerIds: [...trioIds].reverse(),
  key: savedQuestion.key,
  usedKeys: ["other-game"],
});
assert.equal(openingScreen(players), "scored");
const restoredScored = restoreScoredRun();
assert.equal(restoredScored.phase, "revealing");
assert.equal(restoredScored.result, "placed");
assert.equal(restoredScored.credit, 1);
assert.equal(restoredScored.streak, 5);
assert.equal(restoredScored.question.players[0].id, trioIds[2]);
assert.equal(restoredScored.question.key, savedQuestion.key);
assert.ok(restoredScored.usedKeys.includes("other-game"));
assert.ok(restoredScored.usedKeys.includes(savedQuestion.key));
store.clear();
writeActiveRun({
  game: "scored",
  phase: "playing",
  streak: 1,
  gameId: "missing-game",
  playerIds: [1, 2, 3],
});
assert.equal(restoreScoredRun(), null);
writeActiveRun({
  game: "scored",
  phase: "playing",
  streak: 1,
  gameId: openingNight.id,
  leftId: mitchell.id,
  rightId: brunson.id,
});
assert.equal(restoreScoredRun(), null);
assert.equal(openingScreen(players), "hub");

let scoredRecord = emptyScoredDailyRecord();
let scoredNote = noteScoredDailyAnswer(scoredRecord, {
  date: "2026-10-11",
  index: 0,
  correct: 2,
  total: SCORED_DAILY_TOTAL,
  picks: [11, 12, 13],
  credit: 2,
  result: "placed",
});
assert.equal(scoredNote.accepted, true);
assert.equal(scoredNote.finished, false);
assert.equal(scoredNote.record.active.phase, "revealing");
assert.equal(scoredNote.record.active.index, 0);
assert.equal(scoredNote.record.active.correct, 2);
assert.deepEqual(scoredNote.record.active.picks, [11, 12, 13]);
assert.equal(scoredNote.record.active.result, "placed");
assert.equal(scoredNote.record.days["2026-10-11"], undefined);
assert.equal(noteScoredDailyAnswer(scoredNote.record, {
  date: "2026-10-11",
  index: 0,
  correct: 4,
  total: SCORED_DAILY_TOTAL,
  picks: [11, 12, 13],
  credit: 2,
  result: "placed",
}).accepted, false);
scoredNote = continueScoredDaily(scoredNote.record);
assert.equal(scoredNote.record.active.index, 1);
assert.equal(scoredNote.record.active.phase, "playing");
scoredNote = noteScoredDailyAnswer(scoredNote.record, {
  date: "2026-10-11",
  index: 1,
  correct: 5,
  total: SCORED_DAILY_TOTAL,
  picks: [11, 12, 13],
  credit: 3,
  result: "placed",
});
assert.equal(scoredNote.accepted, false);
scoredRecord = noteScoredDailyAnswer(scoredNote.record, {
  date: "2026-10-11",
  index: 1,
  correct: 4,
  total: SCORED_DAILY_TOTAL,
  picks: [21, 22, 23],
  credit: 2,
  result: "placed",
}).record;
assert.equal(scoredRecord.active.result, "placed");
scoredRecord = continueScoredDaily(scoredRecord).record;
for (let index = 2; index < QUIZ_DAILY_LENGTH; index += 1) {
  const noted = noteScoredDailyAnswer(scoredRecord, {
    date: "2026-10-11",
    index,
    correct: scoredRecord.active.correct + 2,
    total: SCORED_DAILY_TOTAL,
    picks: [31, 32, 33],
    credit: 2,
    result: "placed",
  });
  assert.equal(noted.accepted, true);
  assert.equal(noted.finished, false);
  assert.equal(noted.record.days["2026-10-11"], undefined);
  scoredRecord = continueScoredDaily(noted.record).record;
}
assert.equal(scoredRecord.days["2026-10-11"].correct, 10);
assert.equal(scoredRecord.days["2026-10-11"].total, 10);
assert.equal(scoredRecord.active, null);
assert.equal(continueScoredDaily(scoredRecord).advanced, false);
writeScoredDailyRecord(SCORED_DAILY_KEY, { version: 1, days: { "2026-10-11": { correct: 5, total: 5 } }, completedDates: ["2026-10-11"] });
assert.equal(readScoredDailyRecord(SCORED_DAILY_KEY).completedDates.length, 0);
store.clear();

const scoredUnlock = applyScoredStreak({ unlocked: [] }, 5);
assert.ok(scoredUnlock.state.unlocked.includes("heating-up"));
assert.equal(scoredUnlock.state.unlocked.includes("scoring-eye"), false);
store.clear();
writeStorage(SCORED_BEST_KEY, "20");
assert.ok(readScoredBadges().unlocked.includes("box-score"));
assert.equal(readScoredBadges().unlocked.includes("sharp-shooter"), false);

assert.equal(teammateReady, true);
assert.deepEqual(teammateErrors, []);
const rosterNames = new Set(players.map((player) => player.name));
assert.ok(unresolvedTeammates.every((name) => rosterNames.has(name)));
assert.equal(new Set([...chainPlayers.map((player) => player.name), ...unresolvedTeammates]).size, players.length);
assert.match(teammateSource.source, /ESPN/);
assert.match(teammateSource.rule, /regular-season appearance/);
assert.match(teammateSource.rule, /appearance dates overlap/);
assert.match(teammateSource.rule, /not enough/);
assert.equal(chainPlayers.length + unresolvedTeammates.length, players.length);

const curry = chainPlayerByName("Stephen Curry");
const durant = chainPlayerByName("Kevin Durant");
const lebron = chainPlayerByName("LeBron James");
const draymond = chainPlayerByName("Draymond Green");
const harden = chainPlayerByName("James Harden");
assert.ok(curry && durant && lebron && draymond && harden);

const curryDurant = linksBetween(curry.id, durant.id);
assert.ok(curryDurant.some((link) => link.season === "2016-17" && link.team === "Golden State Warriors"));
assert.ok(curryDurant.some((link) => link.season === "2017-18" && link.team === "Golden State Warriors"));
assert.ok(curryDurant.some((link) => link.season === "2018-19" && link.team === "Golden State Warriors"));
assert.equal(curryDurant.some((link) => link.season === "2015-16"), false);
assert.equal(linksBetween(curry.id, lebron.id).length, 0);
assert.equal(isTeammateLink(curry.id, lebron.id, durant.id), false);

const durantEarly = stintsFor(durant.id).filter((stint) => stint.season === "2007-08");
assert.deepEqual(durantEarly.map((stint) => stint.team), ["Seattle SuperSonics"]);
const hardenSplit = stintsFor(harden.id).filter((stint) => stint.season === "2020-21").map((stint) => stint.team).sort();
assert.deepEqual(hardenSplit, ["Brooklyn Nets", "Houston Rockets"]);

const lowry = chainPlayerByName("Kyle Lowry");
const rondo = chainPlayerByName("Rajon Rondo");
const lou = chainPlayerByName("Lou Williams");
assert.ok(lowry && rondo && lou);
const lou2021 = stintsFor(lou.id).filter((stint) => stint.season === "2020-21");
const rondo2021 = stintsFor(rondo.id).filter((stint) => stint.season === "2020-21");
for (const slug of ["la-clippers", "atlanta-hawks"]) {
  const louStint = lou2021.find((stint) => stint.slug === slug);
  const rondoStint = rondo2021.find((stint) => stint.slug === slug);
  assert.ok(louStint && rondoStint, `2020-21 ${slug} stints should both exist`);
  assert.equal(datesOverlap(louStint, rondoStint), false, `${slug} dates must not overlap`);
}
assert.equal(linksBetween(lou.id, rondo.id).length, 0);
assert.equal(isTeammateLink(lou.id, lowry.id, rondo.id), false);
assert.equal(stintsFor(lowry.id).some((stint) => stint.season === "2020-21" && stint.team === "Toronto Raptors"), true);
const lowryRondoLinkers = chainPlayers.filter((player) => isTeammateLink(player.id, lowry.id, rondo.id));
const lowryRondoInvalids = chainPlayers.filter((player) => (
  player.id !== lowry.id
  && player.id !== rondo.id
  && player.id !== lou.id
  && !isTeammateLink(player.id, lowry.id, rondo.id)
));
assert.equal(lowryRondoLinkers.some((player) => player.id === lou.id), false);
assert.ok(lowryRondoLinkers.length >= 1);
assert.ok(lowryRondoInvalids.length >= 2);
const lowryRondoChoices = [lou.id, lowryRondoLinkers[0].id, lowryRondoInvalids[0].id, lowryRondoInvalids[1].id];
const lowryRondoQuestion = {
  key: chainPairKey(lowry.id, rondo.id),
  targets: [
    { id: lowry.id, name: lowry.name },
    { id: rondo.id, name: rondo.name },
  ],
  choices: lowryRondoChoices,
  names: lowryRondoChoices.map((id) => chainPlayers.find((player) => player.id === id).name),
};
assert.deepEqual(auditChainQuestion(lowryRondoQuestion), []);
assert.equal(gradeChainChoice(lowryRondoQuestion, lou.id).correct, false);
assert.equal(chainChoiceCorrect(lowryRondoQuestion, lou.id), false);
assert.equal(gradeChainChoice(lowryRondoQuestion, lowryRondoLinkers[0].id).correct, true);
assert.equal(describeConnections(gradeChainChoice(lowryRondoQuestion, lou.id).guess.connections).includes("No shared team"), true);

const chainNames = new Map(chainPlayers.map((player) => [player.id, player.name]));
const seasonGroups = new Map();
let datedStints = 0;
for (const player of chainPlayers) {
  for (const stint of stintsFor(player.id)) {
    datedStints += 1;
    assert.ok(Array.isArray(stint.spans) && stint.spans.length > 0);
    const key = `${stint.season}|${stint.slug}`;
    if (!seasonGroups.has(key)) seasonGroups.set(key, []);
    seasonGroups.get(key).push({ id: player.id, name: player.name, stint });
  }
}
let coMemberships = 0;
let removedFalseLinks = 0;
let overlappingLinks = 0;
let removedLouRondo = 0;
const removedSamples = [];
for (const group of seasonGroups.values()) {
  for (let left = 0; left < group.length; left += 1) {
    for (let right = left + 1; right < group.length; right += 1) {
      coMemberships += 1;
      const overlap = datesOverlap(group[left].stint, group[right].stint);
      const linked = linksBetween(group[left].id, group[right].id).some((link) => (
        link.season === group[left].stint.season && link.slug === group[left].stint.slug
      ));
      assert.equal(linked, overlap);
      if (overlap) overlappingLinks += 1;
      else {
        removedFalseLinks += 1;
        const pairNames = [group[left].name, group[right].name];
        if (pairNames.includes("Lou Williams") && pairNames.includes("Rajon Rondo")) removedLouRondo += 1;
        if (removedSamples.length < 12) {
          removedSamples.push(`${group[left].name} / ${group[right].name} ${group[left].stint.season} ${group[left].stint.team}`);
        }
      }
    }
  }
}
assert.ok(removedFalseLinks > 0, "mid-season trades should remove at least one false link");
assert.equal(removedLouRondo, 2);

let auditedQuestions = 0;
let auditedAnswers = 0;
let auditedDistractors = 0;
const chainIds = chainPlayers.map((player) => player.id);
for (let left = 0; left < chainIds.length; left += 1) {
  for (let right = left + 1; right < chainIds.length; right += 1) {
    const targetA = chainIds[left];
    const targetB = chainIds[right];
    const linkers = [];
    const invalids = [];
    for (const id of chainIds) {
      if (id === targetA || id === targetB) continue;
      if (isTeammateLink(id, targetA, targetB)) linkers.push(id);
      else invalids.push(id);
    }
    if (!linkers.length || invalids.length < 3) continue;
    const choices = [linkers[0], ...invalids.slice(0, 3)];
    const question = {
      key: chainPairKey(targetA, targetB),
      targets: [
        { id: targetA, name: chainNames.get(targetA) },
        { id: targetB, name: chainNames.get(targetB) },
      ],
      choices,
      names: choices.map((id) => chainNames.get(id)),
    };
    assert.deepEqual(auditChainQuestion(question), []);
    auditedQuestions += 1;
    auditedAnswers += 1;
    auditedDistractors += 3;
    if (linkers[1] != null) {
      const both = {
        ...question,
        choices: [linkers[0], linkers[1], invalids[0], invalids[1]],
        names: [linkers[0], linkers[1], invalids[0], invalids[1]].map((id) => chainNames.get(id)),
      };
      assert.equal(gradeChainChoice(both, linkers[0]).correct, true);
      assert.equal(gradeChainChoice(both, linkers[1]).correct, true);
      assert.equal(gradeChainChoice(both, invalids[0]).correct, false);
      assert.equal(describeConnections(gradeChainChoice(both, linkers[1]).connections).includes("No shared team"), false);
      auditedAnswers += 1;
    }
  }
}
assert.equal(auditedQuestions, chainPairKeys().length);

let auditedDailyQuestions = 0;
for (let month = 1; month <= 12; month += 1) {
  for (let day = 1; day <= 28; day += 1) {
    const questions = buildChainDaily(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    assert.equal(questions.length, QUIZ_DAILY_LENGTH);
    for (const question of questions) {
      assert.deepEqual(auditChainQuestion(question), []);
      const targetIds = question.targets.map((target) => target.id).sort((a, b) => a - b);
      if (targetIds[0] === Math.min(lowry.id, rondo.id) && targetIds[1] === Math.max(lowry.id, rondo.id)) {
        assert.equal(question.choices.includes(lou.id) && chainChoiceCorrect(question, lou.id), false);
      }
      auditedDailyQuestions += 1;
    }
  }
}

for (const player of chainPlayers) {
  for (const stint of stintsFor(player.id)) {
    assert.equal(/total/i.test(`${stint.team} ${stint.slug}`), false);
    assert.equal(stint.team === "LA Clippers", false);
    assert.ok(stint.games >= 1 && stint.games <= 82);
  }
}
assert.ok(chainPlayers.some((player) => stintsFor(player.id).some((stint) => stint.team === "Los Angeles Clippers")));

const chainRandom = mulberry32(11);
const chainUsed = [];
for (let index = 0; index < 30; index += 1) {
  const question = selectChainQuestion({ usedKeys: chainUsed, random: chainRandom });
  assert.ok(question, "a chain question should be available");
  assert.equal(chainUsed.includes(question.key), false);
  assert.equal(chainPairKey(question.targets[1].id, question.targets[0].id), question.key);
  assert.deepEqual(auditChainQuestion(question), []);
  for (const choiceId of question.choices) {
    const linked = isTeammateLink(choiceId, question.targets[0].id, question.targets[1].id);
    assert.equal(gradeChainChoice(question, choiceId).correct, linked);
    assert.equal(chainChoiceCorrect(question, choiceId), linked);
  }
  chainUsed.push(question.key);
}

const firstChain = selectChainQuestion({ random: () => 0 });
const reversedChain = selectChainQuestion({
  usedKeys: [chainPairKey(firstChain.targets[1].id, firstChain.targets[0].id)],
  random: () => 0,
});
assert.notEqual(reversedChain.key, firstChain.key);
assert.equal(selectChainQuestion({ usedKeys: chainPairKeys(), random: () => 0.4 }), null);

const chainInvalids = chainPlayers.filter((player) => (
  player.id !== curry.id
  && player.id !== durant.id
  && !isTeammateLink(player.id, curry.id, durant.id)
)).slice(0, 4);
const unanswered = {
  key: chainPairKey(curry.id, durant.id),
  targets: [
    { id: curry.id, name: curry.name },
    { id: durant.id, name: durant.name },
  ],
  choices: chainInvalids.map((player) => player.id),
  names: chainInvalids.map((player) => player.name),
};
assert.ok(auditChainQuestion(unanswered).includes("no valid answer"));
assert.equal(gradeChainChoice(unanswered, chainInvalids[0].id), null);

const chainLinkers = chainPlayers.filter((player) => isTeammateLink(player.id, curry.id, durant.id));
assert.ok(chainLinkers.some((player) => player.id === draymond.id));
assert.ok(chainLinkers.length >= 2);
const secondLinker = chainLinkers.find((player) => player.id !== draymond.id);
const multiChain = {
  key: chainPairKey(curry.id, durant.id),
  targets: [
    { id: curry.id, name: curry.name },
    { id: durant.id, name: durant.name },
  ],
  choices: [draymond.id, secondLinker.id, chainInvalids[0].id, chainInvalids[1].id],
  names: [draymond.name, secondLinker.name, chainInvalids[0].name, chainInvalids[1].name],
};
assert.deepEqual(auditChainQuestion(multiChain), []);
assert.equal(gradeChainChoice(multiChain, draymond.id).correct, true);
assert.equal(gradeChainChoice(multiChain, secondLinker.id).correct, true);
assert.equal(gradeChainChoice(multiChain, chainInvalids[0].id).correct, false);
assert.equal(gradeChainChoice(multiChain, chainInvalids[1].id).correct, false);
const draymondGrade = gradeChainChoice(multiChain, draymond.id);
const durantSide = draymondGrade.connections.find((row) => row.targetId === durant.id);
const currySide = draymondGrade.connections.find((row) => row.targetId === curry.id);
assert.ok(currySide.groups.some((group) => group.team === "Golden State Warriors" && group.seasons.includes("2016-17")));
assert.ok(durantSide.groups.some((group) => group.team === "Golden State Warriors" && group.seasons.includes("2016-17")));
assert.equal(durantSide.groups.some((group) => group.seasons.includes("2015-16")), false);
assert.match(describeConnections(draymondGrade.connections), /Golden State Warriors \([^)]*2016-17/);
const missedGrade = gradeChainChoice(multiChain, chainInvalids[0].id);
assert.equal(missedGrade.correct, false);
assert.equal(missedGrade.subjectId, draymond.id);
assert.match(describeConnections(missedGrade.connections), /Golden State Warriors/);

const chainDay = "2026-10-11";
const chainDailyA = buildChainDaily(chainDay);
const chainDailyB = buildChainDaily(chainDay);
assert.deepEqual(chainDailyA, chainDailyB);
assert.equal(chainDailyA.length, QUIZ_DAILY_LENGTH);
assert.equal(new Set(chainDailyA.map((question) => question.key)).size, QUIZ_DAILY_LENGTH);
assert.notDeepEqual(chainDailyA.map((question) => question.key), buildChainDaily("2026-01-02").map((question) => question.key));
assert.equal(buildChainDaily("not-a-date"), null);
for (let day = 1; day <= 8; day += 1) {
  const questions = buildChainDaily(`2026-04-${String(day).padStart(2, "0")}`);
  assert.equal(questions.length, QUIZ_DAILY_LENGTH);
  assert.equal(new Set(questions.map((question) => question.key)).size, QUIZ_DAILY_LENGTH);
  for (const question of questions) assert.deepEqual(auditChainQuestion(question), []);
}

let chainRecord = emptyQuizDailyRecord();
const chainNoted = noteQuizAnswer(chainRecord, {
  date: chainDay,
  index: 0,
  correct: 1,
  total: QUIZ_DAILY_LENGTH,
  choice: 44,
  result: "correct",
});
assert.equal(chainNoted.accepted, true);
assert.equal(chainNoted.record.active.phase, "revealing");
assert.equal(chainNoted.record.active.index, 0);
assert.equal(chainNoted.record.active.choice, 44);
assert.equal(writeQuizDailyRecord(CHAIN_DAILY_KEY, chainNoted.record), true);
assert.equal(readQuizDailyRecord(CHAIN_DAILY_KEY).active.result, "correct");
chainRecord = continueQuiz(chainNoted.record).record;
assert.equal(writeQuizDailyRecord(CHAIN_DAILY_KEY, chainRecord), true);
chainRecord = readQuizDailyRecord(CHAIN_DAILY_KEY);
assert.equal(chainRecord.active.date, chainDay);
assert.equal(chainRecord.active.index, 1);
assert.equal(chainRecord.active.phase, "playing");
assert.equal(chainRecord.active.correct, 1);
assert.equal(quizRunStatus(chainRecord, chainDay, true), "progress");

store.clear();
const chainSample = selectChainQuestion({ random: mulberry32(3) });
const chainValidPick = chainSample.choices.find((id) => chainChoiceCorrect(chainSample, id));
writeActiveRun({
  game: "chain",
  phase: "revealing",
  streak: 4,
  picked: chainValidPick,
  result: "correct",
  question: chainSample,
  usedKeys: ["other-pair"],
});
assert.equal(openingScreen(players), "chain");
const restoredChain = restoreChainRun();
assert.equal(restoredChain.phase, "revealing");
assert.equal(restoredChain.result, "correct");
assert.equal(restoredChain.streak, 4);
assert.equal(restoredChain.picked, chainValidPick);
assert.ok(restoredChain.usedKeys.includes(chainSample.key));
assert.ok(restoredChain.usedKeys.includes("other-pair"));
const chainInvalidPick = chainSample.choices.find((id) => !chainChoiceCorrect(chainSample, id));
writeActiveRun({
  game: "chain",
  phase: "revealing",
  streak: 1,
  picked: chainInvalidPick,
  result: "correct",
  question: chainSample,
  usedKeys: [chainSample.key],
});
assert.equal(restoreChainRun(), null);
assert.equal(openingScreen(players), "hub");

const chainUnlock = applyChainStreak({ unlocked: [] }, 5);
assert.ok(chainUnlock.state.unlocked.includes("in-the-rotation"));
assert.equal(chainUnlock.state.unlocked.includes("glue-guy"), false);
store.clear();
writeStorage(CHAIN_BEST_KEY, "20");
assert.ok(readChainBadges().unlocked.includes("locker-room"));
assert.equal(readChainBadges().unlocked.includes("veteran-link"), false);

store.clear();
resetRunFocus();
const parkedYear = selectDraftQuestion(players, "year", [], () => 0);
const parkedPick = selectDraftQuestion(players, "pick", [], () => 0);
writeActiveRun({
  game: "draft",
  mode: "year",
  phase: "playing",
  streak: 4,
  guess: null,
  result: null,
  playerId: parkedYear.id,
  choices: parkedYear.choices,
  usedIds: [parkedYear.id],
});
focusRun("draft", "year");
writeActiveRun({
  game: "career",
  phase: "playing",
  streak: 6,
  picked: null,
  result: null,
  question: parkedYear,
  usedIds: [],
  usedKeys: [],
});
writeActiveRun({
  game: "draft",
  mode: "pick",
  phase: "playing",
  streak: 2,
  guess: null,
  result: null,
  playerId: parkedPick.id,
  choices: parkedPick.choices,
  usedIds: [parkedPick.id],
});
assert.equal(readActiveRun().game, "draft");
assert.equal(readActiveRun().mode, "year");
assert.equal(readActiveRun().streak, 4);
assert.equal(readRunSlot("draft", "year").streak, 4);
assert.equal(readRunSlot("draft", "pick").streak, 2);
assert.equal(readRunSlot("career").streak, 6);
assert.equal(restoreParkedDraftRun(players, "pick").streak, 2);
assert.equal(restoreParkedDraftRun(players, "pick").mode, "pick");
assert.equal(openingScreen(players), "draft");
clearActiveRun("draft", "pick");
assert.equal(readRunSlot("draft", "pick"), null);
assert.equal(readRunSlot("draft", "year").streak, 4);
assert.equal(readRunSlot("career").streak, 6);
assert.equal(readActiveRun().streak, 4);
resetRunFocus();
store.clear();

console.log(`Teammate overlap audit: ${datedStints} stints, ${coMemberships} same-team season pairings, ${removedFalseLinks} false links removed, ${overlappingLinks} overlapping links kept, ${auditedQuestions} questions, ${auditedAnswers} correct answers, ${auditedDistractors} distractors, ${auditedDailyQuestions} daily questions.`);
for (const sample of removedSamples) console.log(`- removed ${sample}`);
console.log("Gameplay checks passed.");
