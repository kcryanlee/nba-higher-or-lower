import { careerPlayers as CAREERS } from "../data/players.js";
import { playerNamesMatch } from "./playerSearch.js";

const LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const TIER = {
  "Stephen Curry": "star",
  "LeBron James": "star",
  "Kevin Durant": "star",
  "James Harden": "star",
  "Nikola Jokic": "star",
  "Luka Doncic": "star",
  "Anthony Edwards": "star",
  "Jayson Tatum": "star",
  "Jaylen Brown": "star",
  "Devin Booker": "star",
  "Donovan Mitchell": "star",
  "Kawhi Leonard": "star",
  "Tyrese Maxey": "star",
  "Jalen Brunson": "star",
  "Jamal Murray": "star",
  "Karl-Anthony Towns": "star",
  "Trae Young": "star",
  "De'Aaron Fox": "star",
  "Paul George": "star",
  "Klay Thompson": "star",
  "Draymond Green": "star",
  "Russell Westbrook": "star",
  "Carmelo Anthony": "star",
  "DeMar DeRozan": "star",
  "Lauri Markkanen": "known",
  "Zach LaVine": "known",
  "Brandon Ingram": "known",
  "Julius Randle": "known",
  "Desmond Bane": "known",
  "Darius Garland": "known",
  "CJ McCollum": "known",
  "Jrue Holiday": "known",
  "Derrick White": "known",
  "OG Anunoby": "known",
  "Kristaps Porzingis": "known",
  "Aaron Gordon": "known",
  "Andrew Wiggins": "known",
  "Mikal Bridges": "known",
  "Nikola Vucevic": "known",
  "Myles Turner": "known",
  "Al Horford": "known",
  "Brook Lopez": "known",
  "Jordan Poole": "known",
  "Tobias Harris": "known",
  "Malik Monk": "known",
  "Harrison Barnes": "known",
  "Tyler Herro": "known",
  "JJ Redick": "known",
  "Andre Iguodala": "known",
  "Kyle Lowry": "known",
  "Norman Powell": "role",
  "Dillon Brooks": "role",
  "Buddy Hield": "role",
  "Mike Conley": "role",
  "Dwight Howard": "role",
  "Lou Williams": "role",
  "Rajon Rondo": "role",
  "Thaddeus Young": "role",
  "Eric Gordon": "role",
  "Dennis Schroder": "role",
  "Kyle Korver": "role",
  "Danny Green": "role",
  "Patrick Beverley": "role",
};

export function careerBand(streak) {
  if (streak >= 6) return { id: "hard", label: LABELS.hard };
  if (streak >= 3) return { id: "medium", label: LABELS.medium };
  return { id: "easy", label: LABELS.easy };
}

function tierOf(career) {
  return TIER[career.name] || "known";
}

export function careerQuestionKey(answerId, stopIndex) {
  return `${answerId}:${stopIndex}`;
}

export function careerPlayerAccepted(question, choice) {
  return playerNamesMatch(question?.player, choice) || playerNamesMatch(question?.answer, choice);
}

export function eligibleCareers(bandId) {
  if (bandId === "hard") return CAREERS.filter((career) => career.stops.length >= 4);
  if (bandId === "medium") return CAREERS.filter((career) => career.stops.length === 2 || career.stops.length === 3);
  return CAREERS.filter((career) => career.stops.length === 1);
}

function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function pickWeighted(careers, weightOf, random) {
  const bag = [];
  for (const career of careers) {
    const weight = Math.max(1, weightOf(career));
    for (let count = 0; count < weight; count += 1) bag.push(career);
  }
  return shuffle(bag, random)[0];
}

function poolFor(bandId) {
  return eligibleCareers(bandId);
}

function weightFor(bandId, career) {
  const tier = tierOf(career);
  if (bandId === "hard") {
    if (tier === "role") return 5;
    if (tier === "known") return 3;
    return 1;
  }
  if (bandId === "medium") {
    let weight = tier === "role" ? 3 : tier === "known" ? 2 : 1;
    if (career.stops.length >= 3) weight += 1;
    return weight;
  }
  return 1;
}

function openStopIndexes(career, blocked) {
  const indexes = [];
  for (let index = 0; index < career.stops.length; index += 1) {
    if (!blocked.has(careerQuestionKey(career.id, index))) indexes.push(index);
  }
  return indexes;
}

function assembleQuestion(answer, band, stopIndex) {
  return {
    band,
    answer: answer.name,
    answerId: answer.id,
    player: answer.name,
    position: answer.position,
    stops: answer.stops,
    hiddenIndex: stopIndex,
    key: careerQuestionKey(answer.id, stopIndex),
  };
}

function blockedKeySet(usedKeys) {
  return new Set(Array.isArray(usedKeys) ? usedKeys.filter((key) => typeof key === "string" && key) : []);
}

function searchPool(pool, bandId, band, random, blocked) {
  let remaining = [...pool];
  while (remaining.length) {
    const answer = pickWeighted(remaining, (career) => weightFor(bandId, career), random);
    const indexes = openStopIndexes(answer, blocked);
    if (indexes.length) {
      const stopIndex = indexes[Math.floor(random() * indexes.length)];
      return assembleQuestion(answer, band, stopIndex);
    }
    remaining = remaining.filter((career) => career.id !== answer.id);
  }
  return null;
}

export function selectCareerQuestionForBand(bandId, { usedIds = [], usedKeys = [], random = Math.random } = {}) {
  if (!LABELS[bandId]) return null;
  const band = { id: bandId, label: LABELS[bandId] };
  const used = new Set(Array.isArray(usedIds) ? usedIds.filter((id) => Number.isInteger(id)) : []);
  const blocked = blockedKeySet(usedKeys);
  const pool = poolFor(bandId);
  const fresh = pool.filter((career) => !used.has(career.id));
  return searchPool(fresh, bandId, band, random, blocked)
    || searchPool(pool, bandId, band, random, blocked);
}

export function selectCareerQuestion(streak, options = {}) {
  return selectCareerQuestionForBand(careerBand(streak).id, options);
}

export function formatYears(stop) {
  const end = String(stop.end).slice(2);
  return `${stop.start}–${end}`;
}
