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

export function teamLogoUrl(team) {
  const abbr = TEAM_ABBR[team];
  if (!abbr) return null;
  return `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`;
}

export function teamColors(team) {
  return TEAM_COLORS[team] ?? FALLBACK_COLORS;
}
