import { careerPlayers as CAREERS } from "../data/players.js";
import { playerNamesMatch } from "./playerSearch.js";

const LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const POPULARITY = {
  easy: [
    "Anthony Davis",
    "Anthony Edwards",
    "Bam Adebayo",
    "Cade Cunningham",
    "Carmelo Anthony",
    "Chet Holmgren",
    "Cooper Flagg",
    "De'Aaron Fox",
    "DeMar DeRozan",
    "Devin Booker",
    "Donovan Mitchell",
    "Draymond Green",
    "Dwight Howard",
    "Giannis Antetokounmpo",
    "Ja Morant",
    "Jalen Brunson",
    "Jamal Murray",
    "James Harden",
    "Jaylen Brown",
    "Jayson Tatum",
    "Joel Embiid",
    "Karl-Anthony Towns",
    "Kawhi Leonard",
    "Kevin Durant",
    "Klay Thompson",
    "LaMelo Ball",
    "LeBron James",
    "Luka Doncic",
    "Nikola Jokic",
    "Paolo Banchero",
    "Paul George",
    "Russell Westbrook",
    "Scottie Barnes",
    "Shai Gilgeous-Alexander",
    "Stephen Curry",
    "Trae Young",
    "Tyrese Maxey",
    "Victor Wembanyama",
    "Zion Williamson",
  ],
  medium: [
    "Aaron Gordon",
    "Al Horford",
    "Alperen Sengun",
    "Andre Iguodala",
    "Andrew Wiggins",
    "Austin Reaves",
    "Brandon Ingram",
    "Brook Lopez",
    "Buddy Hield",
    "CJ McCollum",
    "Danny Green",
    "Darius Garland",
    "Derrick White",
    "Desmond Bane",
    "Eric Gordon",
    "Evan Mobley",
    "Franz Wagner",
    "Harrison Barnes",
    "JJ Redick",
    "Jalen Williams",
    "Jaren Jackson Jr.",
    "Jarrett Allen",
    "Jrue Holiday",
    "Julius Randle",
    "Kristaps Porzingis",
    "Kyle Korver",
    "Kyle Lowry",
    "Lauri Markkanen",
    "Lou Williams",
    "Michael Porter Jr.",
    "Mikal Bridges",
    "Mike Conley",
    "Myles Turner",
    "Nikola Vucevic",
    "OG Anunoby",
    "Pascal Siakam",
    "Patrick Beverley",
    "Rajon Rondo",
    "Tobias Harris",
    "Tyler Herro",
    "Zach LaVine",
  ],
  hard: [
    "Alex Sarr",
    "Amen Thompson",
    "Andrew Nembhard",
    "Anthony Black",
    "Bennedict Mathurin",
    "Brandon Miller",
    "Coby White",
    "Collin Sexton",
    "Deni Avdija",
    "Dennis Schroder",
    "Dillon Brooks",
    "Grayson Allen",
    "Immanuel Quickley",
    "Jabari Smith Jr.",
    "Jaime Jaquez Jr.",
    "Jalen Duren",
    "Jalen Green",
    "Jalen Johnson",
    "Jerami Grant",
    "Jordan Poole",
    "Josh Giddey",
    "Kevin Porter Jr.",
    "Keyonte George",
    "Kon Knueppel",
    "Malik Monk",
    "Matas Buzelis",
    "Miles Bridges",
    "Naji Marshall",
    "Nickeil Alexander-Walker",
    "Norman Powell",
    "Onyeka Okongwu",
    "Payton Pritchard",
    "RJ Barrett",
    "Ryan Rollins",
    "Saddiq Bey",
    "Shaedon Sharpe",
    "Stephon Castle",
    "Thaddeus Young",
    "Trey Murphy III",
    "VJ Edgecombe",
  ],
};

const BAND_OF = Object.fromEntries(
  Object.entries(POPULARITY).flatMap(([bandId, names]) => names.map((name) => [name, bandId])),
);

export function careerBand(streak) {
  if (streak >= 16) return { id: "hard", label: LABELS.hard };
  if (streak >= 6) return { id: "medium", label: LABELS.medium };
  return { id: "easy", label: LABELS.easy };
}

function popularityBand(career) {
  return BAND_OF[career.name] || "medium";
}

export function careerQuestionKey(answerId, stopIndex) {
  return `${answerId}:${stopIndex}`;
}

export function careerPlayerAccepted(question, choice) {
  return playerNamesMatch(question?.player, choice) || playerNamesMatch(question?.answer, choice);
}

export function eligibleCareers(bandId) {
  if (!LABELS[bandId]) return [];
  return CAREERS.filter((career) => popularityBand(career) === bandId);
}

function poolFor(bandId) {
  return eligibleCareers(bandId);
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

function searchPool(pool, band, random, blocked) {
  let remaining = [...pool];
  while (remaining.length) {
    const answer = remaining[Math.floor(random() * remaining.length)];
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
  const fresh = poolFor(bandId).filter((career) => !used.has(career.id));
  return searchPool(fresh, band, random, blocked);
}

export function selectCareerQuestion(streak, options = {}) {
  return selectCareerQuestionForBand(careerBand(streak).id, options);
}

function integerIds(ids) {
  return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
}

function careerKeyId(key) {
  const id = Number(String(key).split(":")[0]);
  return Number.isInteger(id) ? id : null;
}

export function continueCareerQuestion(streak, {
  usedIds = [],
  usedKeys = [],
  avoidId = null,
  random = Math.random,
} = {}) {
  const band = careerBand(streak);
  const pool = poolFor(band.id);
  if (pool.length === 0) return null;

  const ids = integerIds(usedIds);
  const keys = Array.isArray(usedKeys) ? usedKeys.filter((key) => typeof key === "string" && key) : [];
  const poolIds = new Set(pool.map((career) => career.id));
  const used = new Set(ids);
  const unused = pool.filter((career) => !used.has(career.id));
  let selectionIds = ids;
  let baseIds = ids;
  let baseKeys = keys;
  let cycled = false;

  if (unused.length === 0) {
    cycled = true;
    const lastId = Number.isInteger(avoidId) ? avoidId : ids.at(-1);
    const blockLast = Number.isInteger(lastId) && poolIds.has(lastId) && pool.length > 1;
    baseIds = ids.filter((id) => !poolIds.has(id));
    baseKeys = keys.filter((key) => !poolIds.has(careerKeyId(key)));
    selectionIds = blockLast ? [...baseIds, lastId] : baseIds;
  }

  let question = selectCareerQuestion(streak, { usedIds: selectionIds, usedKeys: baseKeys, random });
  if (!question && cycled && selectionIds.length > baseIds.length) {
    question = selectCareerQuestion(streak, { usedIds: baseIds, usedKeys: baseKeys, random });
  }
  if (!question) return null;

  const nextIds = baseIds.includes(question.answerId) ? baseIds : [...baseIds, question.answerId];
  const nextKeys = baseKeys.includes(question.key) ? baseKeys : [...baseKeys, question.key];
  return { question, usedIds: nextIds, usedKeys: nextKeys, cycled };
}

export function formatYears(stop) {
  const end = String(stop.end).slice(2);
  return `${stop.start}–${end}`;
}
