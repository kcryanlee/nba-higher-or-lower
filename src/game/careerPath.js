import { CAREERS } from "../data/careers.js";

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

const EASY_NAMES = new Set([
  "Stephen Curry",
  "LeBron James",
  "Kevin Durant",
  "James Harden",
  "Nikola Jokic",
  "Luka Doncic",
  "Anthony Edwards",
  "Jayson Tatum",
  "Jaylen Brown",
  "Devin Booker",
  "Donovan Mitchell",
  "Kawhi Leonard",
  "Tyrese Maxey",
  "Jalen Brunson",
  "Jamal Murray",
  "Karl-Anthony Towns",
  "Trae Young",
  "De'Aaron Fox",
  "Paul George",
  "Klay Thompson",
  "Draymond Green",
]);

export function careerBand(streak) {
  if (streak >= 6) return { id: "hard", label: LABELS.hard };
  if (streak >= 3) return { id: "medium", label: LABELS.medium };
  return { id: "easy", label: LABELS.easy };
}

function tierOf(career) {
  return TIER[career.name] || "known";
}

function pathKey(career) {
  return career.stops.map((stop) => stop.team).join("|");
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function pickWeighted(careers, weightOf) {
  const bag = [];
  for (const career of careers) {
    const weight = Math.max(1, weightOf(career));
    for (let count = 0; count < weight; count += 1) bag.push(career);
  }
  return shuffle(bag)[0];
}

function poolFor(bandId) {
  if (bandId === "hard") return CAREERS.filter((career) => career.stops.length >= 4);
  if (bandId === "medium") return CAREERS.filter((career) => career.stops.length >= 2);
  return CAREERS.filter((career) => EASY_NAMES.has(career.name));
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
    if (career.stops.length >= 4) weight += 1;
    return weight;
  }
  return 1;
}

function sharedTeamCount(answer, candidate) {
  const teams = new Set(answer.stops.map((stop) => stop.team));
  return new Set(candidate.stops.filter((stop) => teams.has(stop.team)).map((stop) => stop.team)).size;
}

function eraOverlap(answer, candidate) {
  const start = Math.max(answer.stops[0].start, candidate.stops[0].start);
  const end = Math.min(answer.stops.at(-1).end, candidate.stops.at(-1).end);
  return end - start;
}

function distractorScore(answer, candidate) {
  const shared = sharedTeamCount(answer, candidate);
  const samePosition = candidate.position === answer.position;
  const overlap = eraOverlap(answer, candidate);
  let score = shared * 4;
  if (samePosition) score += 3;
  if (overlap >= 6) score += Math.min(4, Math.floor(overlap / 4));
  score -= Math.abs(candidate.stops.length - answer.stops.length);
  if (shared === 0 && !(samePosition && overlap >= 6)) score -= 6;
  return score;
}

function selectDistractors(answer) {
  const ranked = CAREERS.filter((career) => career.name !== answer.name && pathKey(career) !== pathKey(answer))
    .map((career) => ({ career, score: distractorScore(answer, career) }))
    .sort((left, right) => right.score - left.score);
  const plausible = ranked.filter((item) => item.score >= 3);
  const shortlist = (plausible.length >= 3 ? plausible : ranked).slice(0, 6);
  return shuffle(shortlist)
    .slice(0, 3)
    .map((item) => item.career);
}

export function selectCareerQuestion(streak, previousName = null) {
  const band = careerBand(streak);
  let pool = poolFor(band.id).filter((career) => career.name !== previousName);
  if (!pool.length) pool = poolFor(band.id);
  const answer = pickWeighted(pool, (career) => weightFor(band.id, career));
  const distractors = selectDistractors(answer);

  return {
    band,
    answer: answer.name,
    position: answer.position,
    stops: answer.stops,
    choices: shuffle([answer.name, ...distractors.map((career) => career.name)]),
  };
}

export function formatYears(stop) {
  const end = String(stop.end).slice(2);
  return `${stop.start}–${end}`;
}
