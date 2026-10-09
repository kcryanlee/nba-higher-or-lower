export const DATA_INFO = {
  statsSeason: "2025-26",
  careerThroughSeason: "2025-26",
  rosterSeason: "2026-27",
  salarySeason: "2026-27",
};

export function dataDisclaimer() {
  return "Player statistics reflect the latest completed NBA season available in our dataset. Team and salary information reflects the current season.";
}

export function dataSeasonLine(info = DATA_INFO) {
  const rosterAndSalary = info.rosterSeason === info.salarySeason
    ? info.rosterSeason
    : `${info.rosterSeason} rosters, ${info.salarySeason} salaries`;
  const career = info.careerThroughSeason === info.statsSeason
    ? ""
    : ` · Career totals: ${info.careerThroughSeason}`;
  return `Stats: ${info.statsSeason} · Rosters & Salaries: ${rosterAndSalary}${career}`;
}
