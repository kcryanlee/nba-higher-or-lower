const TEAM_ABBR = {
  "Atlanta Hawks": "atl",
  "Boston Celtics": "bos",
  "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha",
  "Chicago Bulls": "chi",
  "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal",
  "Denver Nuggets": "den",
  "Detroit Pistons": "det",
  "Golden State Warriors": "gs",
  "Houston Rockets": "hou",
  "Indiana Pacers": "ind",
  "Los Angeles Clippers": "lac",
  "Los Angeles Lakers": "lal",
  "Memphis Grizzlies": "mem",
  "Miami Heat": "mia",
  "Milwaukee Bucks": "mil",
  "Minnesota Timberwolves": "min",
  "New Orleans Pelicans": "no",
  "New York Knicks": "ny",
  "Oklahoma City Thunder": "okc",
  "Orlando Magic": "orl",
  "Philadelphia 76ers": "phi",
  "Phoenix Suns": "phx",
  "Portland Trail Blazers": "por",
  "Sacramento Kings": "sac",
  "San Antonio Spurs": "sa",
  "Toronto Raptors": "tor",
  "Utah Jazz": "utah",
  "Washington Wizards": "wsh",
};

const TEAM_COLORS = {
  "Atlanta Hawks": { primary: "#E03A3E", secondary: "#C1D32F", ink: "#fff8ee" },
  "Boston Celtics": { primary: "#007A33", secondary: "#BA9653", ink: "#fff8ee" },
  "Brooklyn Nets": { primary: "#111111", secondary: "#FFFFFF", ink: "#fff8ee" },
  "Charlotte Hornets": { primary: "#1D1160", secondary: "#00788C", ink: "#fff8ee" },
  "Chicago Bulls": { primary: "#CE1141", secondary: "#000000", ink: "#fff8ee" },
  "Cleveland Cavaliers": { primary: "#860038", secondary: "#FDBB30", ink: "#fff8ee" },
  "Dallas Mavericks": { primary: "#00538C", secondary: "#B8C4CA", ink: "#fff8ee" },
  "Denver Nuggets": { primary: "#0E2240", secondary: "#FEC524", ink: "#fff8ee" },
  "Detroit Pistons": { primary: "#C8102E", secondary: "#1D42BA", ink: "#fff8ee" },
  "Golden State Warriors": { primary: "#1D428A", secondary: "#FFC72C", ink: "#fff8ee" },
  "Houston Rockets": { primary: "#CE1141", secondary: "#000000", ink: "#fff8ee" },
  "Indiana Pacers": { primary: "#002D62", secondary: "#FDBB30", ink: "#fff8ee" },
  "Los Angeles Clippers": { primary: "#C8102E", secondary: "#1D428A", ink: "#fff8ee" },
  "Los Angeles Lakers": { primary: "#552583", secondary: "#FDB927", ink: "#FDB927" },
  "Memphis Grizzlies": { primary: "#12173F", secondary: "#5D76A9", ink: "#fff8ee" },
  "Miami Heat": { primary: "#98002E", secondary: "#F9A01B", ink: "#fff8ee" },
  "Milwaukee Bucks": { primary: "#00471B", secondary: "#EEE1C6", ink: "#EEE1C6" },
  "Minnesota Timberwolves": { primary: "#0C2340", secondary: "#78BE20", ink: "#fff8ee" },
  "New Orleans Pelicans": { primary: "#0C2340", secondary: "#C8102E", ink: "#fff8ee" },
  "New York Knicks": { primary: "#006BB6", secondary: "#F58426", ink: "#fff8ee" },
  "Oklahoma City Thunder": { primary: "#007AC1", secondary: "#EF3B24", ink: "#fff8ee" },
  "Orlando Magic": { primary: "#0077C0", secondary: "#C4CED4", ink: "#fff8ee" },
  "Philadelphia 76ers": { primary: "#006BB6", secondary: "#ED174C", ink: "#fff8ee" },
  "Phoenix Suns": { primary: "#1D1160", secondary: "#E56020", ink: "#fff8ee" },
  "Portland Trail Blazers": { primary: "#E03A3E", secondary: "#000000", ink: "#fff8ee" },
  "Sacramento Kings": { primary: "#5A2D81", secondary: "#63727A", ink: "#fff8ee" },
  "San Antonio Spurs": { primary: "#000000", secondary: "#C4CED4", ink: "#fff8ee" },
  "Toronto Raptors": { primary: "#CE1141", secondary: "#000000", ink: "#fff8ee" },
  "Utah Jazz": { primary: "#002B5C", secondary: "#F9A01B", ink: "#fff8ee" },
  "Washington Wizards": { primary: "#002B5C", secondary: "#E31837", ink: "#fff8ee" },
};

const FALLBACK_COLORS = { primary: "#20406a", secondary: "#c5a572", ink: "#f4efe4" };

const TEAM_CODE = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

const EXTRA_ALIASES = {
  "Atlanta Hawks": ["Hawks", "Atlanta", "ATL"],
  "Boston Celtics": ["Celtics", "Boston", "BOS"],
  "Brooklyn Nets": ["Nets", "Brooklyn", "BKN"],
  "Charlotte Hornets": ["Hornets", "Charlotte", "CHA"],
  "Chicago Bulls": ["Bulls", "Chicago", "CHI"],
  "Cleveland Cavaliers": ["Cavaliers", "Cavs", "Cleveland", "CLE"],
  "Dallas Mavericks": ["Mavericks", "Mavs", "Dallas", "DAL"],
  "Denver Nuggets": ["Nuggets", "Denver", "DEN"],
  "Detroit Pistons": ["Pistons", "Detroit", "DET"],
  "Golden State Warriors": ["Warriors", "Golden State", "Dubs", "GSW", "GS"],
  "Houston Rockets": ["Rockets", "Houston", "HOU"],
  "Indiana Pacers": ["Pacers", "Indiana", "IND"],
  "Los Angeles Clippers": ["Clippers", "Clips", "LA Clippers", "L.A. Clippers", "LAC"],
  "Los Angeles Lakers": ["Lakers", "LA Lakers", "L.A. Lakers", "LAL"],
  "Memphis Grizzlies": ["Grizzlies", "Grizz", "Memphis", "MEM"],
  "Miami Heat": ["Heat", "Miami", "MIA"],
  "Milwaukee Bucks": ["Bucks", "Milwaukee", "MIL"],
  "Minnesota Timberwolves": ["Timberwolves", "Wolves", "T-Wolves", "Twolves", "Minnesota", "Minny", "MIN"],
  "New Orleans Pelicans": ["Pelicans", "Pels", "New Orleans", "NOLA", "NOP", "NO"],
  "New York Knicks": ["Knicks", "New York", "NYK", "NY"],
  "Oklahoma City Thunder": ["Thunder", "Oklahoma City", "OKC"],
  "Orlando Magic": ["Magic", "Orlando", "ORL"],
  "Philadelphia 76ers": ["76ers", "Sixers", "Philadelphia", "Philly", "PHI"],
  "Phoenix Suns": ["Suns", "Phoenix", "PHX", "PHO"],
  "Portland Trail Blazers": ["Trail Blazers", "Blazers", "Portland", "POR"],
  "Sacramento Kings": ["Kings", "Sacramento", "SAC"],
  "San Antonio Spurs": ["Spurs", "San Antonio", "SAS", "SA"],
  "Toronto Raptors": ["Raptors", "Toronto", "TOR"],
  "Utah Jazz": ["Jazz", "Utah", "UTA"],
  "Washington Wizards": ["Wizards", "Wiz", "Washington", "WAS", "WSH"],
};

const TEAM_NAMES = Object.keys(TEAM_ABBR);

function joinInitials(text) {
  let current = text;
  let next = current.replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1");
  while (next !== current) {
    current = next;
    next = current.replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1");
  }
  return current;
}

export function normalizeTeamText(value) {
  const cleaned = String(value ?? "")
    .toLowerCase()
    .replace(/[.’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^the /, "");
  return joinInitials(cleaned);
}

const ALIAS_INDEX = new Map(TEAM_NAMES.map((team) => {
  const aliases = new Set([
    normalizeTeamText(team),
    normalizeTeamText(TEAM_ABBR[team]),
    normalizeTeamText(TEAM_CODE[team]),
    ...(EXTRA_ALIASES[team] || []).map((alias) => normalizeTeamText(alias)),
  ]);
  aliases.delete("");
  return [team, aliases];
}));

function matchRank(team, query) {
  const aliases = ALIAS_INDEX.get(team);
  if (!aliases) return null;
  if (aliases.has(query)) return 0;
  for (const alias of aliases) {
    if (alias.startsWith(query)) return 1;
  }
  const words = normalizeTeamText(team).split(" ");
  if (words.some((word) => word.startsWith(query))) return 2;
  return null;
}

export function teamCode(team) {
  return TEAM_CODE[team] || "";
}

export function officialTeamName(guess) {
  const query = normalizeTeamText(guess);
  if (!query) return null;
  const hits = TEAM_NAMES.filter((team) => ALIAS_INDEX.get(team)?.has(query));
  return hits.length === 1 ? hits[0] : null;
}

export function teamMatches(official, guess) {
  if (typeof official !== "string" || !ALIAS_INDEX.has(official)) return false;
  return officialTeamName(guess) === official;
}

export function searchTeams(guess) {
  const query = normalizeTeamText(guess);
  if (!query) return [];
  return TEAM_NAMES
    .map((team) => ({ team, rank: matchRank(team, query) }))
    .filter((item) => item.rank != null)
    .sort((left, right) => left.rank - right.rank || left.team.localeCompare(right.team))
    .slice(0, 8)
    .map((item) => item.team);
}

export function teamLogoUrl(team) {
  const abbr = TEAM_ABBR[team];
  if (!abbr) return null;
  return `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`;
}

export function teamColors(team) {
  return TEAM_COLORS[team] ?? FALLBACK_COLORS;
}
