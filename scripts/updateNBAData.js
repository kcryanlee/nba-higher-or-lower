import { readFileSync } from "node:fs";
import { validateDataset } from "../src/data/validatePlayers.js";

const players = JSON.parse(readFileSync(new URL("../src/data/players.json", import.meta.url), "utf8")).players;
const history = JSON.parse(readFileSync(new URL("../src/data/careerHistory.json", import.meta.url), "utf8"));
const result = validateDataset(players, history);

if (!result.ok) {
  console.error("Player data failed validation. The current dataset was not changed.");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Player data is valid (${players.length} players).`);
console.log("Automatic fetching is not connected yet.");
console.log("When it is, this command will refresh current stats by NBA player id, then append a dated career stop if a player joins a new team.");
console.log("Career history is never replaced. A failed validation keeps the previous dataset.");
