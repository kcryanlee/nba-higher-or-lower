import { careerExclusionReasons, careerFingerprint, careerVerified } from "../data/careerVerification.js";
import { careerPlayers as CAREERS, players as ROSTER } from "../data/players.js";
import { foldPlayerName, playerNamesMatch } from "./playerSearch.js";

const LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export const CAREER_BANDS = ["easy", "medium", "hard", "expert"];
export const EXPERT_STREAK = 100;

const POPULARITY = {
  easy: [
    "Allen Iverson",
    "Anthony Davis",
    "Anthony Edwards",
    "Bam Adebayo",
    "Bradley Beal",
    "Cade Cunningham",
    "Carmelo Anthony",
    "Charles Barkley",
    "Chet Holmgren",
    "Chris Bosh",
    "Chris Paul",
    "Cooper Flagg",
    "Damian Lillard",
    "David Robinson",
    "De'Aaron Fox",
    "DeMar DeRozan",
    "Devin Booker",
    "Dirk Nowitzki",
    "Dominique Wilkins",
    "Donovan Mitchell",
    "Draymond Green",
    "Dwight Howard",
    "Dwyane Wade",
    "Giannis Antetokounmpo",
    "Hakeem Olajuwon",
    "Ja Morant",
    "Jalen Brunson",
    "Jamal Murray",
    "James Harden",
    "Jaylen Brown",
    "Jayson Tatum",
    "Jimmy Butler III",
    "Joel Embiid",
    "John Stockton",
    "Karl Malone",
    "Karl-Anthony Towns",
    "Kawhi Leonard",
    "Kevin Durant",
    "Kevin Garnett",
    "Klay Thompson",
    "Kobe Bryant",
    "Kyrie Irving",
    "LaMelo Ball",
    "Larry Bird",
    "LeBron James",
    "Luka Doncic",
    "Magic Johnson",
    "Manu Ginobili",
    "Nikola Jokic",
    "Paolo Banchero",
    "Pau Gasol",
    "Paul George",
    "Paul Pierce",
    "Ray Allen",
    "Reggie Miller",
    "Russell Westbrook",
    "Scottie Barnes",
    "Scottie Pippen",
    "Shai Gilgeous-Alexander",
    "Shaquille O'Neal",
    "Stephen Curry",
    "Steve Nash",
    "Tim Duncan",
    "Tony Parker",
    "Tracy McGrady",
    "Trae Young",
    "Tyrese Maxey",
    "Victor Wembanyama",
    "Vince Carter",
    "Yao Ming",
    "Zion Williamson",
  ],
  medium: [
    "Aaron Gordon",
    "Aaron Nesmith",
    "Al Horford",
    "Alex Caruso",
    "Alonzo Mourning",
    "Alperen Sengun",
    "Amar'e Stoudemire",
    "Andre Drummond",
    "Andre Iguodala",
    "Andrew Wiggins",
    "Anfernee Simons",
    "Austin Reaves",
    "Ben Wallace",
    "Blake Griffin",
    "Bobby Portis Jr.",
    "Brandin Podziemski",
    "Brandon Ingram",
    "Brook Lopez",
    "Buddy Hield",
    "Cameron Johnson",
    "Chauncey Billups",
    "Chris Webber",
    "Christian Braun",
    "CJ McCollum",
    "Clint Capela",
    "Danny Green",
    "Darius Garland",
    "De'Andre Hunter",
    "Deandre Ayton",
    "DeAndre Jordan",
    "DeMarcus Cousins",
    "Derrick Rose",
    "Derrick White",
    "Desmond Bane",
    "Devin Vassell",
    "Donte DiVincenzo",
    "Duncan Robinson",
    "Dyson Daniels",
    "Eric Gordon",
    "Evan Mobley",
    "Franz Wagner",
    "Gary Trent Jr.",
    "Gilbert Arenas",
    "Gordon Hayward",
    "Grant Hill",
    "Harrison Barnes",
    "Herbert Jones",
    "Isaiah Hartenstein",
    "Ivica Zubac",
    "Jaden McDaniels",
    "Jakob Poeltl",
    "Jalen Suggs",
    "Jalen Williams",
    "Jaren Jackson Jr.",
    "Jarrett Allen",
    "JJ Redick",
    "Joe Johnson",
    "John Collins",
    "John Wall",
    "Jonathan Kuminga",
    "Josh Hart",
    "Jrue Holiday",
    "Julius Randle",
    "Keegan Murray",
    "Keldon Johnson",
    "Kelly Oubre Jr.",
    "Kemba Walker",
    "Kevin Love",
    "Khris Middleton",
    "Kristaps Porzingis",
    "Kyle Korver",
    "Kyle Kuzma",
    "Kyle Lowry",
    "LaMarcus Aldridge",
    "Lauri Markkanen",
    "Lou Williams",
    "Luguentz Dort",
    "Marc Gasol",
    "Marcus Smart",
    "Max Christie",
    "Michael Porter Jr.",
    "Mikal Bridges",
    "Mike Conley",
    "Myles Turner",
    "Naz Reid",
    "Nic Claxton",
    "Nikola Vucevic",
    "OG Anunoby",
    "P.J. Washington",
    "Pascal Siakam",
    "Patrick Beverley",
    "Peja Stojakovic",
    "Rajon Rondo",
    "Rasheed Wallace",
    "Robert Williams III",
    "Rudy Gobert",
    "Rui Hachimura",
    "Steven Adams",
    "Tari Eason",
    "Tim Hardaway Jr.",
    "Tobias Harris",
    "Tyler Herro",
    "Wendell Carter Jr.",
    "Zach LaVine",
    "Zach Randolph",
  ],
  hard: [
    "Aaron Wiggins",
    "Ace Bailey",
    "Adem Bona",
    "AJ Green",
    "Ajay Mitchell",
    "Alex Sarr",
    "Amen Thompson",
    "Andrew Nembhard",
    "Anthony Black",
    "Ausar Thompson",
    "Ayo Dosunmu",
    "Baylor Scheierman",
    "Ben Sheppard",
    "Bennedict Mathurin",
    "Bilal Coulibaly",
    "Bogdan Bogdanovic",
    "Bones Hyland",
    "Brandon Jennings",
    "Brandon Miller",
    "Brandon Williams",
    "Brice Sensabaugh",
    "Bruce Brown",
    "Bub Carrington",
    "Caleb Martin",
    "Cam Spencer",
    "Cason Wallace",
    "Cedric Coward",
    "Coby White",
    "Cody Williams",
    "Collin Gillespie",
    "Collin Murray-Boyles",
    "Collin Sexton",
    "Corey Kispert",
    "Craig Porter Jr.",
    "Daeqwon Plowden",
    "Dalton Knecht",
    "Daniel Gafford",
    "Daniss Jenkins",
    "Danny Wolf",
    "Davion Mitchell",
    "Day'Ron Sharpe",
    "Dean Wade",
    "Dejounte Murray",
    "Deni Avdija",
    "Dennis Schroder",
    "Derik Queen",
    "Derrick Jones Jr.",
    "Dillon Brooks",
    "Dominick Barlow",
    "Donovan Clingan",
    "Drake Powell",
    "Dru Smith",
    "Dwight Powell",
    "Dylan Cardwell",
    "Dylan Harper",
    "Egor Demin",
    "Evan Turner",
    "GG Jackson",
    "Goga Bitadze",
    "Gradey Dick",
    "Grayson Allen",
    "Gui Santos",
    "Hassan Whiteside",
    "Immanuel Quickley",
    "Isaac Okoro",
    "Isaiah Collier",
    "Isaiah Jackson",
    "Isaiah Joe",
    "Isaiah Stewart",
    "Isaiah Thomas",
    "Ja'Kobe Walter",
    "Jabari Smith Jr.",
    "Jaden Hardy",
    "Jaime Jaquez Jr.",
    "Jake LaRavia",
    "Jalen Duren",
    "Jalen Green",
    "Jalen Johnson",
    "Jalen Smith",
    "Jamal Crawford",
    "Jamal Shead",
    "Jamison Battle",
    "Jarace Walker",
    "Jared McCain",
    "Jarred Vanderbilt",
    "Javonte Green",
    "Jaxson Hayes",
    "Jay Huff",
    "Jaylen Clark",
    "Jaylen Wells",
    "Jaylin Williams",
    "Jaylon Tyson",
    "Jeff Teague",
    "Jerami Grant",
    "Jeremiah Fears",
    "Jericho Sims",
    "Jett Howard",
    "Jevon Carter",
    "Jock Landale",
    "Jonathan Mogbo",
    "Jordan Clarkson",
    "Jordan Goodwin",
    "Jordan Miller",
    "Jordan Poole",
    "Jordan Walsh",
    "Jose Alvarado",
    "Josh Giddey",
    "Josh Okogie",
    "JR Smith",
    "Julian Champagnie",
    "Karlo Matkovic",
    "Kel'el Ware",
    "Kenneth Faried",
    "Kenrich Williams",
    "Kentavious Caldwell-Pope",
    "Keon Ellis",
    "Kevin Huerter",
    "Kevin Porter Jr.",
    "Keyonte George",
    "Kobe Brown",
    "Kobe Sanders",
    "Kon Knueppel",
    "Kris Dunn",
    "Kris Murray",
    "Kyle Anderson",
    "Kyle Filipowski",
    "Kyshawn George",
    "Landry Shamet",
    "Leonard Miller",
    "Luke Kennard",
    "Luke Kornet",
    "Malik Monk",
    "Mark Williams",
    "Marvin Bagley III",
    "Matas Buzelis",
    "Maxime Raynaud",
    "Micah Potter",
    "Michael Beasley",
    "Miles Bridges",
    "Mitchell Robinson",
    "Monta Ellis",
    "Moses Moody",
    "Mouhamed Gueye",
    "Moussa Diabate",
    "Nae'Qwan Tomlin",
    "Naji Marshall",
    "Neemias Queta",
    "Nick Young",
    "Nickeil Alexander-Walker",
    "Nique Clifford",
    "Noah Clowney",
    "Nolan Traore",
    "Norman Powell",
    "Onyeka Okongwu",
    "Oso Ighodaro",
    "Patrick Williams",
    "Payton Pritchard",
    "Pelle Larsson",
    "Peyton Watson",
    "Precious Achiuwa",
    "Quentin Grimes",
    "Quinten Post",
    "Reed Sheppard",
    "RJ Barrett",
    "Ronald Holland II",
    "Royce O'Neale",
    "Rudy Gay",
    "Ryan Dunn",
    "Ryan Kalkbrenner",
    "Ryan Nembhard",
    "Ryan Rollins",
    "Saddiq Bey",
    "Sam Hauser",
    "Sam Merrill",
    "Sandro Mamukelashvili",
    "Santi Aldama",
    "Shaedon Sharpe",
    "Sidy Cissoko",
    "Simone Fontecchio",
    "Sion James",
    "Spencer Jones",
    "Stephon Castle",
    "Svi Mykhailiuk",
    "T.J. McConnell",
    "Taylor Hendricks",
    "Terance Mann",
    "Thaddeus Young",
    "Thomas Bryant",
    "Toumani Camara",
    "Tre Johnson",
    "Tre Jones",
    "Trey Murphy III",
    "Tristan da Silva",
    "Tyus Jones",
    "Vit Krejci",
    "VJ Edgecombe",
    "Walter Clayton Jr.",
    "Will Richard",
    "Will Riley",
    "Yves Missi",
    "Zaccharie Risacher",
    "Ziaire Williams",
  ],
};

const BAND_OF = Object.fromEntries(
  Object.entries(POPULARITY).flatMap(([bandId, names]) => names.map((name) => [name, bandId])),
);

export function careerBand(streak) {
  if (streak >= EXPERT_STREAK) return { id: "expert", label: LABELS.expert };
  if (streak >= 16) return { id: "hard", label: LABELS.hard };
  if (streak >= 6) return { id: "medium", label: LABELS.medium };
  return { id: "easy", label: LABELS.easy };
}

function popularityBand(career) {
  return BAND_OF[career.name] || "medium";
}

export function careerQuestionKey(answerId, stopIndex = null) {
  return Number.isInteger(stopIndex) ? `${answerId}:${stopIndex}` : `${answerId}:path`;
}

export function careerPlayerAccepted(question, choice) {
  return playerNamesMatch(question?.player, choice) || playerNamesMatch(question?.answer, choice);
}

export function formatYears(stop) {
  const end = String(stop.end).slice(2);
  return `${stop.start}–${end}`;
}

export function isHiddenStop(question, index) {
  return Number.isInteger(question?.hiddenIndex) && question.hiddenIndex === index;
}

// Exactly what the board shows: position on Easy, every stop's years, and every team except the hidden one.
export function careerClues(career, bandId, hiddenIndex = null) {
  const hidden = bandId === "expert" && Number.isInteger(hiddenIndex) ? hiddenIndex : null;
  return {
    position: bandId === "easy" ? career.position || null : null,
    stops: (career.stops || []).map((stop, index) => ({
      team: index === hidden ? null : stop.team,
      years: formatYears(stop),
    })),
  };
}

function cluesFit(clues, candidate) {
  const stops = candidate?.stops;
  if (!Array.isArray(stops) || stops.length !== clues.stops.length) return false;
  if (clues.position != null && candidate.position !== clues.position) return false;
  return clues.stops.every((clue, index) => (
    clue.years === formatYears(stops[index]) && (clue.team == null || clue.team === stops[index].team)
  ));
}

const SEARCHABLE = ROSTER.map((player) => ({
  id: player.id,
  name: player.name,
  position: player.position,
  stops: player.careerTeams || [],
}));

export function careerMatches(clues, searchable = SEARCHABLE) {
  return searchable.filter((candidate) => cluesFit(clues, candidate));
}

function yearsKey(stops) {
  return stops.map((stop) => formatYears(stop)).join("|");
}

function groupByYears(searchable) {
  const groups = new Map();
  for (const candidate of searchable) {
    const key = yearsKey(candidate.stops || []);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  return groups;
}

function rejection(career, bandId, hiddenIndex, byYears, names) {
  if (bandId === "expert" && career.stops.length < 2) return "Only one team stop, so hiding it leaves no team on the board.";
  if (names.get(foldPlayerName(career.name)) > 1) return `Another searchable player is also named ${career.name}.`;
  const matches = careerMatches(careerClues(career, bandId, hiddenIndex), byYears.get(yearsKey(career.stops)) || []);
  if (!matches.some((other) => other.id === career.id)) return "The answer is not in the searchable player pool.";
  const others = matches.filter((other) => other.id !== career.id);
  if (others.length) return `The visible clues also fit ${others.map((other) => other.name).join(", ")}.`;
  return null;
}

export function buildCareerPools({
  careers = CAREERS,
  searchable = SEARCHABLE,
  verified = (career) => careerVerified(career.id, career.stops),
  reasonsFor = (career) => careerExclusionReasons(career.id, career.stops),
} = {}) {
  const pools = Object.fromEntries(CAREER_BANDS.map((bandId) => [bandId, []]));
  const rejected = Object.fromEntries(CAREER_BANDS.map((bandId) => [bandId, []]));
  const byYears = groupByYears(searchable);
  const names = new Map();
  for (const candidate of searchable) {
    const folded = foldPlayerName(candidate.name);
    names.set(folded, (names.get(folded) || 0) + 1);
  }
  for (const career of careers) {
    if (!Number.isInteger(career?.id) || !Array.isArray(career.stops) || career.stops.length === 0) continue;
    const trusted = verified(career);
    const unverified = trusted ? null : `Unverified career history: ${reasonsFor(career).join("; ")}`;
    const candidates = [
      { bandId: popularityBand(career), hiddenIndex: null },
      ...career.stops.map((_, index) => ({ bandId: "expert", hiddenIndex: index })),
    ];
    for (const { bandId, hiddenIndex } of candidates) {
      const entry = { id: career.id, name: career.name, hiddenIndex, key: careerQuestionKey(career.id, hiddenIndex) };
      const reason = unverified || rejection(career, bandId, hiddenIndex, byYears, names);
      if (reason) rejected[bandId].push({ ...entry, reason });
      else pools[bandId].push(entry);
    }
  }
  return { pools, rejected };
}

const CAREER_BY_ID = new Map(CAREERS.map((career) => [career.id, career]));
const BUILT = buildCareerPools();
const POOLS = BUILT.pools;

export function careerPoolReport() {
  return CAREER_BANDS.map((bandId) => ({
    bandId,
    label: LABELS[bandId],
    valid: POOLS[bandId].length,
    excluded: BUILT.rejected[bandId].length,
    players: new Set(POOLS[bandId].map((entry) => entry.id)).size,
  }));
}

export function careerRejections(bandId) {
  return BUILT.rejected[bandId] || [];
}

export function eligibleCareers(bandId) {
  if (!POOLS[bandId]) return [];
  const ids = new Set(POOLS[bandId].map((entry) => entry.id));
  return CAREERS.filter((career) => ids.has(career.id));
}

function assembleQuestion(entry, bandId) {
  const career = CAREER_BY_ID.get(entry.id);
  return {
    band: { id: bandId, label: LABELS[bandId] },
    answer: career.name,
    answerId: career.id,
    player: career.name,
    position: career.position,
    stops: career.stops.map((stop) => ({ ...stop })),
    hiddenIndex: entry.hiddenIndex,
    key: entry.key,
  };
}

function integerIds(ids) {
  return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
}

function stringKeys(keys) {
  return Array.isArray(keys) ? keys.filter((key) => typeof key === "string" && key) : [];
}

function careerKeyId(key) {
  const id = Number(String(key).split(":")[0]);
  return Number.isInteger(id) ? id : null;
}

function pickEntry(pool, usedIds, usedKeys, random) {
  const used = new Set(usedIds);
  const blocked = new Set(usedKeys);
  const fresh = pool.filter((entry) => !used.has(entry.id) && !blocked.has(entry.key));
  if (!fresh.length) return null;
  const ids = [...new Set(fresh.map((entry) => entry.id))];
  const id = ids[Math.floor(random() * ids.length)];
  const options = fresh.filter((entry) => entry.id === id);
  return options[Math.floor(random() * options.length)];
}

export function selectCareerQuestionForBand(bandId, { usedIds = [], usedKeys = [], random = Math.random } = {}) {
  if (!POOLS[bandId]) return null;
  const entry = pickEntry(POOLS[bandId], integerIds(usedIds), stringKeys(usedKeys), random);
  return entry ? assembleQuestion(entry, bandId) : null;
}

export function selectCareerQuestion(streak, options = {}) {
  return selectCareerQuestionForBand(careerBand(streak).id, options);
}

// When every player in the band has been used, players come back first with an unused hidden stop,
// then with any question, so the run never runs out of valid questions.
export function continueCareerQuestion(streak, {
  usedIds = [],
  usedKeys = [],
  avoidId = null,
  random = Math.random,
} = {}) {
  const band = careerBand(streak);
  const pool = POOLS[band.id];
  if (!pool.length) return null;

  const ids = integerIds(usedIds);
  const keys = stringKeys(usedKeys);
  const poolIds = new Set(pool.map((entry) => entry.id));
  const lastId = Number.isInteger(avoidId) ? avoidId : ids.at(-1);
  const blockLast = Number.isInteger(lastId) && poolIds.has(lastId) && poolIds.size > 1;
  const otherIds = ids.filter((id) => !poolIds.has(id));
  const otherKeys = keys.filter((key) => !poolIds.has(careerKeyId(key)));
  const attempts = [
    { ids, keys, cycled: false },
    { ids: otherIds, keys, cycled: true },
    { ids: otherIds, keys: otherKeys, cycled: true },
  ];

  for (const attempt of attempts) {
    const selections = attempt.cycled && blockLast ? [[...attempt.ids, lastId], attempt.ids] : [attempt.ids];
    for (const selectionIds of selections) {
      const entry = pickEntry(pool, selectionIds, attempt.keys, random);
      if (!entry) continue;
      return {
        question: assembleQuestion(entry, band.id),
        usedIds: attempt.ids.includes(entry.id) ? attempt.ids : [...attempt.ids, entry.id],
        usedKeys: attempt.keys.includes(entry.key) ? attempt.keys : [...attempt.keys, entry.key],
        cycled: attempt.cycled,
      };
    }
  }
  return null;
}

// Rebuilds a saved question from current data. Returns null when it is no longer a valid question.
export function currentCareerQuestion(question) {
  const bandId = question?.band?.id;
  if (!POOLS[bandId]) return null;
  const career = CAREER_BY_ID.get(question.answerId);
  if (!career || !playerNamesMatch(career.name, question.player)) return null;
  const hiddenIndex = bandId === "expert" ? question.hiddenIndex : null;
  if (bandId === "expert" && !Number.isInteger(hiddenIndex)) return null;
  if (careerFingerprint(question.stops) !== careerFingerprint(career.stops)) return null;
  const key = careerQuestionKey(career.id, hiddenIndex);
  const entry = POOLS[bandId].find((item) => item.key === key);
  return entry ? assembleQuestion(entry, bandId) : null;
}
