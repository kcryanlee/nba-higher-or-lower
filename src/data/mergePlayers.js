export const CURRENT_FIELDS = [
  "name",
  "team",
  "position",
  "age",
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "fgPct",
  "tpPct",
  "ftPct",
  "careerPoints",
  "careerRebounds",
  "careerAssists",
  "salary",
  "heightIn",
  "threes",
  "draftYear",
  "draftPick",
];

function copyStops(stops) {
  return (stops || []).map((stop) => ({ ...stop }));
}

function extendHistory(stops, incoming) {
  const next = copyStops(stops);
  const candidates = [];
  if (incoming.careerStop && typeof incoming.careerStop === "object") candidates.push(incoming.careerStop);
  if (Array.isArray(incoming.careerTeams)) candidates.push(...incoming.careerTeams);

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || typeof candidate.team !== "string") continue;
    if (!Number.isFinite(candidate.start) || !Number.isFinite(candidate.end) || candidate.end < candidate.start) continue;

    const duplicate = next.some((stop) => stop.team === candidate.team && stop.start === candidate.start);
    if (duplicate) continue;

    const last = next.at(-1);
    if (last && candidate.start < last.end && candidate.team !== last.team) continue;
    if (last && candidate.start < last.start) continue;

    if (last && last.team === candidate.team) {
      if (candidate.end >= last.end) last.end = candidate.end;
      continue;
    }

    next.push({ team: candidate.team, start: candidate.start, end: candidate.end });
  }

  return next;
}

function blankPlayer(id) {
  return {
    id,
    name: "",
    team: null,
    position: null,
    age: null,
    ppg: null,
    rpg: null,
    apg: null,
    spg: null,
    bpg: null,
    fgPct: null,
    tpPct: null,
    ftPct: null,
    careerPoints: null,
    careerRebounds: null,
    careerAssists: null,
    salary: null,
    heightIn: null,
    threes: null,
    draftYear: null,
    draftPick: null,
  };
}

export function mergeDataset(players, history, incomingPlayers) {
  const nextPlayers = players.map((player) => ({ ...player }));
  const historyById = new Map(history.map((entry) => [entry.id, { id: entry.id, stops: copyStops(entry.stops) }]));
  const notes = [];

  for (const raw of incomingPlayers) {
    const incoming = { ...raw };
    if (incoming.tpPct == null && Number.isFinite(incoming.threePct)) incoming.tpPct = incoming.threePct;
    if (!Number.isInteger(incoming.id)) {
      throw new Error("Each update needs an official NBA player id.");
    }

    let player = nextPlayers.find((item) => item.id === incoming.id);
    if (!player) {
      player = blankPlayer(incoming.id);
      nextPlayers.push(player);
    }

    const previousTeam = player.team;
    for (const field of CURRENT_FIELDS) {
      if (Object.hasOwn(incoming, field)) player[field] = incoming[field];
    }

    if (!historyById.has(incoming.id)) historyById.set(incoming.id, { id: incoming.id, stops: [] });
    const entry = historyById.get(incoming.id);
    const before = entry.stops.length;
    entry.stops = extendHistory(entry.stops, incoming);
    const lastTeam = entry.stops.at(-1)?.team;
    if (incoming.team && previousTeam && incoming.team !== previousTeam && entry.stops.length === before) {
      notes.push(`${player.name || incoming.id} is now listed on ${incoming.team}. Career history still ends with ${lastTeam || previousTeam}.`);
    }
  }

  return {
    players: nextPlayers,
    history: [...historyById.values()],
    notes,
  };
}
