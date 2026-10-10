import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATEGORIES } from "../src/game/categories.js";
import {
  DAILY_LENGTH,
  activeDailyStreak,
  buildDaily,
  commitOfficialResult,
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
import { careerChoiceAllowed, eligibleCareers, selectCareerQuestion } from "../src/game/careerPath.js";
import { collectPairs } from "../src/game/selectMatchup.js";
import { openingScreen, readActiveRun, restoreCareerRun, restoreClassicRun, restoreDraftRun, writeActiveRun } from "../src/game/activeRun.js";
import { DRAFT_BEST_KEYS, draftPool, ordinal, parseDraftAnswer, selectDraftQuestion, usableDraftYear } from "../src/game/draft.js";
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
  emptyQuizDailyRecord,
  longestConsecutive,
  nextDateKey,
  noteQuizAnswer,
  quizRunStatus,
  readQuizDailyRecord,
  writeQuizDailyRecord,
} from "../src/game/quizDaily.js";
import { useDaily } from "../src/hooks/useDaily.js";

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
  const row = { id, name: `Player ${id}` };
  for (const category of CATEGORIES) row[category.id] = value;
  return row;
}

function answer(record, index, correct) {
  return noteOfficialAnswer(record, {
    date: "2026-10-09",
    index,
    correct,
    score: correct,
    highestId: correct ? "easy" : null,
    total: DAILY_LENGTH,
    difficulty: correct ? "Easy" : "None",
  });
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
for (const career of eligibleCareers("easy")) assert.equal(career.stops.length, 1);
for (const career of eligibleCareers("medium")) {
  assert.ok(career.stops.length === 2 || career.stops.length === 3);
}
for (const career of eligibleCareers("hard")) assert.ok(career.stops.length >= 4);
assert.ok(eligibleCareers("easy").some((career) => career.name === "Amen Thompson"));
assert.equal(eligibleCareers("easy").some((career) => career.name === "LeBron James"), false);

const herro = careerPlayers.find((career) => career.name === "Tyler Herro");
const jaquez = careerPlayers.find((career) => career.name === "Jaime Jaquez Jr.");
assert.equal(careerChoiceAllowed(herro, jaquez, "easy"), true);
assert.equal(careerChoiceAllowed(herro, jaquez, "medium"), true);
assert.equal(careerChoiceAllowed(herro, jaquez, "hard"), false);
assert.equal(careerChoiceAllowed(herro, { ...herro, name: "Clone" }, "easy"), false);

const threes = CATEGORIES.find((category) => category.id === "threes");
const threesPairs = collectPairs(players, threes, { min: 0, max: Infinity });
assert.ok(threesPairs.every((pair) => pair.first.threes > 0 && pair.second.threes > 0));
const duren = players.find((player) => player.name === "Jalen Duren");
assert.equal(duren.threes, 0);
assert.equal(duren.tpPct, 0);
const undrafted = players
  .filter((player) => player.draftYear == null && player.draftPick == null)
  .map((player) => player.name)
  .sort();
assert.deepEqual(undrafted, ["Austin Reaves", "Naji Marshall"]);
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
while (seenDraft.length < 200) {
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
let careerStreak = 0;
while (careerStreak < 500) {
  const question = selectCareerQuestion(careerStreak, { usedIds: seenAnswers });
  if (!question) break;
  assert.equal(seenAnswers.includes(question.answerId), false);
  assert.equal(new Set(question.choices).size, question.choices.length);
  assert.equal(question.choices.length, 4);
  assert.ok(question.choices.includes(question.answer));
  seenAnswers.push(question.answerId);
  careerStreak += 1;
}
assert.ok(seenAnswers.length > 6);
assert.equal(new Set(seenAnswers).size, seenAnswers.length);
assert.equal(selectCareerQuestion(careerStreak, { usedIds: seenAnswers }), null);

const easyIds = eligibleCareers("easy").map((career) => career.id);
assert.equal(selectCareerQuestion(0, { usedIds: easyIds }), null);
const repeated = selectCareerQuestion(0, { usedIds: [easyIds[0]] });
assert.ok(repeated);
assert.notEqual(repeated.answerId, easyIds[0]);

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
const continued = selectCareerQuestion(2, { usedIds: restoredCareer.usedIds });
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
  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(question.choices.includes(question.answer));
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
const firstStep = noteQuizAnswer(quizRecord, { date: careerDailyDate, index: 0, correct: 1, total: 5 });
assert.equal(firstStep.accepted, true);
assert.equal(firstStep.finished, false);
assert.equal(firstStep.record.active.index, 1);
assert.equal(firstStep.record.active.correct, 1);
assert.equal(noteQuizAnswer(firstStep.record, { date: careerDailyDate, index: 0, correct: 1, total: 5 }).accepted, false);
quizRecord = firstStep.record;
for (let index = 1; index < QUIZ_DAILY_LENGTH; index += 1) {
  const noted = noteQuizAnswer(quizRecord, {
    date: careerDailyDate,
    index,
    correct: index === QUIZ_DAILY_LENGTH - 1 ? 4 : index,
    total: 5,
  });
  assert.equal(noted.accepted, true);
  quizRecord = noted.record;
}
assert.equal(quizRecord.days[careerDailyDate].correct, 4);
assert.equal(quizRecord.days[careerDailyDate].total, 5);
assert.equal(quizRecord.active, null);
assert.equal(quizRunStatus(quizRecord, careerDailyDate), "complete");
const lockedQuiz = noteQuizAnswer(quizRecord, { date: careerDailyDate, index: 0, correct: 5, total: 5 });
assert.equal(lockedQuiz.accepted, false);
assert.equal(lockedQuiz.record.days[careerDailyDate].correct, 4);

store.clear();
assert.equal(writeQuizDailyRecord(CAREER_DAILY_KEY, firstStep.record), true);
const resumedQuiz = readQuizDailyRecord(CAREER_DAILY_KEY);
assert.equal(resumedQuiz.active.index, 1);
assert.equal(resumedQuiz.active.correct, 1);
assert.equal(quizRunStatus(resumedQuiz, careerDailyDate), "progress");
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

console.log("Gameplay checks passed.");
