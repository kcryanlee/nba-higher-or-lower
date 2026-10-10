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
import { selectMatchup } from "../src/game/selectMatchup.js";
import { applyAnswer, emptyBadgeState } from "../src/game/badges.js";
import { readJsonStorage, writeStorage } from "../src/game/storage.js";
import { players, careerPlayers } from "../src/data/players.js";
import { careerChoiceAllowed, eligibleCareers, selectCareerQuestion } from "../src/game/careerPath.js";
import { collectPairs } from "../src/game/selectMatchup.js";
import { openingScreen, readActiveRun, restoreCareerRun, restoreDraftRun, writeActiveRun } from "../src/game/activeRun.js";
import { DRAFT_BEST_KEYS, draftPool, ordinal, parseDraftAnswer, selectDraftQuestion, usableDraftYear } from "../src/game/draft.js";
import { DRAFT_BADGE_KEYS, DRAFT_BADGES, applyDraftStreak, readDraftBadges } from "../src/game/draftBadges.js";
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

assert.equal(buildDaily([], "2026-10-09"), null);
assert.equal(buildDaily(null, "2026-10-09"), null);
const first = buildDaily(players, "2026-10-09");
const second = buildDaily(players, "2026-10-09");
assert.equal(first.length, DAILY_LENGTH);
assert.deepEqual(first.map((question) => question.key), second.map((question) => question.key));
assert.ok(first.every((question) => question.left[question.category.id] !== question.right[question.category.id]));

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

console.log("Gameplay checks passed.");
