import {
  chainPlayers,
  isTeammateLink,
  linksBetween,
  pairKey,
  teammateIds,
  teammateReady,
} from "../data/teammates.js";

const CHOICE_COUNT = 4;

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function playerRecord(id) {
  const player = chainPlayers.find((item) => item.id === id);
  return player ? { id: player.id, name: player.name } : null;
}

let cachedPairs = null;

function chainPairs() {
  if (cachedPairs) return cachedPairs;
  if (!teammateReady) {
    cachedPairs = [];
    return cachedPairs;
  }
  const ids = chainPlayers.map((player) => player.id);
  const pairs = [];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const a = ids[left];
      const b = ids[right];
      const matesA = teammateIds(a);
      const matesB = teammateIds(b);
      const linkers = [];
      for (const id of matesA) {
        if (id !== b && matesB.has(id)) linkers.push(id);
      }
      if (!linkers.length) continue;
      if (chainPlayers.length - 2 - linkers.length < CHOICE_COUNT - 1) continue;
      pairs.push({ key: pairKey(a, b), a, b, linkers });
    }
  }
  cachedPairs = pairs;
  return cachedPairs;
}

export function chainPairKeys() {
  return chainPairs().map((pair) => pair.key);
}

function groupLinks(links) {
  const groups = [];
  const bySlug = new Map();
  for (const link of links) {
    let group = bySlug.get(link.slug);
    if (!group) {
      group = { team: link.team, slug: link.slug, seasons: [] };
      bySlug.set(link.slug, group);
      groups.push(group);
    }
    if (!group.seasons.includes(link.season)) group.seasons.push(link.season);
  }
  for (const group of groups) group.seasons.sort();
  groups.sort((left, right) => left.seasons[0].localeCompare(right.seasons[0]) || left.team.localeCompare(right.team));
  return groups;
}

export function connectionsFor(playerId, targets) {
  return targets.map((target) => ({
    targetId: target.id,
    targetName: target.name,
    groups: groupLinks(linksBetween(playerId, target.id)),
  }));
}

export function choiceName(question, choiceId) {
  const index = question?.choices?.indexOf(choiceId) ?? -1;
  return index >= 0 && typeof question.names?.[index] === "string" ? question.names[index] : "";
}

export function describeConnections(connections) {
  return (connections || []).map((row) => {
    const detail = row.groups.length
      ? row.groups.map((group) => `${group.team} (${group.seasons.join(", ")})`).join("; ")
      : "No shared team";
    return `${row.targetName}: ${detail}`;
  }).join(" | ");
}

export function gradeChainChoice(question, choiceId) {
  if (!question || !Array.isArray(question.targets) || question.targets.length !== 2) return null;
  if (!Array.isArray(question.choices) || !question.choices.includes(choiceId)) return null;
  const [first, second] = question.targets;
  if (!Number.isInteger(first?.id) || !Number.isInteger(second?.id) || first.id === second.id) return null;
  const validIds = question.choices.filter((id) => isTeammateLink(id, first.id, second.id));
  if (!validIds.length) return null;
  const correct = validIds.includes(choiceId);
  const subjectId = correct ? choiceId : validIds[0];
  return {
    correct,
    validIds,
    subjectId,
    subjectName: choiceName(question, subjectId),
    connections: connectionsFor(subjectId, question.targets),
    guess: correct ? null : {
      id: choiceId,
      name: choiceName(question, choiceId),
      connections: connectionsFor(choiceId, question.targets),
    },
  };
}

export function chainChoiceCorrect(question, choiceId) {
  return gradeChainChoice(question, choiceId)?.correct === true;
}

export function auditChainQuestion(question) {
  const errors = [];
  if (!question) return ["missing question"];
  const targets = question.targets;
  if (!Array.isArray(targets) || targets.length !== 2 || targets[0]?.id === targets[1]?.id) errors.push("targets");
  if (!Number.isInteger(targets?.[0]?.id) || !Number.isInteger(targets?.[1]?.id)) errors.push("target ids");
  if (typeof targets?.[0]?.name !== "string" || typeof targets?.[1]?.name !== "string") errors.push("target names");
  if (targets?.[0]?.id != null && pairKey(targets[0].id, targets[1].id) !== question.key) errors.push("pair key");
  if (!Array.isArray(question.choices) || question.choices.length !== CHOICE_COUNT) errors.push("choice count");
  if (!Array.isArray(question.names) || question.names.length !== question.choices?.length) errors.push("names");
  const seen = new Set();
  for (const id of question.choices || []) {
    if (!Number.isInteger(id) || seen.has(id)) errors.push("duplicate choice");
    seen.add(id);
    if (id === targets?.[0]?.id || id === targets?.[1]?.id) errors.push("target is a choice");
    const name = choiceName(question, id);
    if (!name) errors.push("blank choice");
  }
  if (errors.length) return errors;
  const valid = question.choices.filter((id) => isTeammateLink(id, targets[0].id, targets[1].id));
  const invalid = question.choices.filter((id) => !isTeammateLink(id, targets[0].id, targets[1].id));
  if (!valid.length) errors.push("no valid answer");
  if (valid.length + invalid.length !== CHOICE_COUNT) errors.push("classification");
  for (const id of valid) {
    const grade = gradeChainChoice(question, id);
    if (!grade?.correct) errors.push("valid choice rejected");
    if (grade && describeConnections(grade.connections).includes("No shared team")) errors.push("valid choice missing a shared season");
  }
  for (const id of invalid) {
    if (gradeChainChoice(question, id)?.correct) errors.push("invalid choice accepted");
    if (isTeammateLink(id, targets[0].id, targets[1].id)) errors.push("invalid choice is a link");
  }
  return errors;
}

function questionFromPair(pair, random) {
  const matesA = teammateIds(pair.a);
  const matesB = teammateIds(pair.b);
  const linkerSet = new Set(pair.linkers);
  const answer = playerRecord(shuffle(pair.linkers, random)[0]);
  const oneSided = [];
  const neither = [];
  for (const player of chainPlayers) {
    if (player.id === pair.a || player.id === pair.b || linkerSet.has(player.id)) continue;
    if (isTeammateLink(player.id, pair.a, pair.b)) continue;
    if (matesA.has(player.id) || matesB.has(player.id)) oneSided.push(player);
    else neither.push(player);
  }
  const distractors = [...shuffle(oneSided, random), ...shuffle(neither, random)].slice(0, CHOICE_COUNT - 1);
  if (!answer || distractors.length < CHOICE_COUNT - 1) return null;
  const targets = shuffle([playerRecord(pair.a), playerRecord(pair.b)], random);
  const choices = shuffle([answer, ...distractors], random);
  return {
    key: pair.key,
    targets,
    choices: choices.map((player) => player.id),
    names: choices.map((player) => player.name),
  };
}

export function selectChainQuestion({ usedKeys = [], random = Math.random } = {}) {
  if (!teammateReady) return null;
  const used = new Set(Array.isArray(usedKeys) ? usedKeys.filter((key) => typeof key === "string") : []);
  const open = chainPairs().filter((pair) => !used.has(pair.key));
  if (!open.length) return null;
  for (const pair of shuffle(open, random)) {
    const question = questionFromPair(pair, random);
    if (question && auditChainQuestion(question).length === 0) return question;
  }
  return null;
}
