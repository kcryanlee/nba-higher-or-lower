import { randomBytes, randomUUID } from "node:crypto";
import { buildQuestion } from "./questions.js";
import {
  PK_COUNTDOWN_FROM,
  PK_COUNTDOWN_MS,
  PK_QUESTION_MS,
  PK_REVEAL_MS,
  PK_TARGET,
  isPkMode,
} from "../src/game/pkModes.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOMS = 300;

export function cleanName(value) {
  const name = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16);
  return name || "Player";
}

export function cleanCode(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function makeCode(rooms) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return null;
}

function roster(room) {
  return Object.values(room.players).sort((left, right) => Number(right.host) - Number(left.host) || left.joined - right.joined);
}

export function createPkLobby(options = {}) {
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  const countdownFrom = options.countdownFrom ?? PK_COUNTDOWN_FROM;
  const countdownMs = options.countdownMs ?? PK_COUNTDOWN_MS;
  const questionMs = options.questionMs ?? PK_QUESTION_MS;
  const revealMs = options.revealMs ?? PK_REVEAL_MS;
  const disconnectMs = options.disconnectMs ?? 45000;
  const lobbyGraceMs = options.lobbyGraceMs ?? 20000;
  const target = options.target ?? PK_TARGET;
  const nextQuestion = options.nextQuestion ?? buildQuestion;

  const rooms = new Map();
  const membership = new Map();
  const listeners = new Map();

  function emit(playerId, message) {
    listeners.get(playerId)?.(message);
  }

  function sendState(room) {
    for (const player of roster(room)) {
      emit(player.id, { type: "state", ...viewFor(room, player.id) });
    }
  }

  function locate(playerId) {
    const code = membership.get(playerId);
    const room = code ? rooms.get(code) : null;
    const player = room?.players[playerId];
    if (!room || !player) return null;
    return { room, player };
  }

  function bothOnline(room) {
    const players = roster(room);
    return players.length === 2 && players.every((player) => player.connected);
  }

  function arm(room, ms, fn) {
    if (room.timerId != null) cancel(room.timerId);
    room.timerFn = fn;
    room.timerLeft = ms;
    room.timerKey += 1;
    room.paused = false;
    room.timerDue = now() + ms;
    room.timerId = schedule(() => {
      room.timerId = null;
      room.timerLeft = 0;
      const run = room.timerFn;
      room.timerFn = null;
      run?.();
    }, ms);
  }

  function clearClock(room) {
    if (room.timerId != null) cancel(room.timerId);
    room.timerId = null;
    room.timerFn = null;
    room.timerLeft = 0;
    room.paused = false;
  }

  function pauseClock(room) {
    if (room.paused) return;
    if (room.timerId == null) {
      room.paused = true;
      room.timerKey += 1;
      return;
    }
    cancel(room.timerId);
    room.timerId = null;
    room.timerLeft = Math.max(0, room.timerDue - now());
    room.paused = true;
    room.timerKey += 1;
  }

  function resumeClock(room) {
    if (!room.paused) return;
    const fn = room.timerFn;
    if (!fn) {
      room.paused = false;
      return;
    }
    arm(room, Math.max(0, room.timerLeft), fn);
  }

  function ensurePending(room) {
    if (room.pending) return true;
    let built;
    try {
      built = nextQuestion({
        mode: room.mode,
        roundIndex: room.roundIndex,
        used: room.used,
        usedIds: room.usedIds,
      });
    } catch {
      built = null;
    }
    if (!built?.public || typeof built.normalize !== "function" || typeof built.grade !== "function") return false;
    if (built.usedKey) room.used.push(built.usedKey);
    if (Number.isInteger(built.usedId)) room.usedIds.push(built.usedId);
    room.pending = built;
    return true;
  }

  function beginCountdown(room) {
    if (!ensurePending(room)) {
      clearClock(room);
      room.phase = "lobby";
      room.pending = null;
      room.notice = "Could not build a question.";
      for (const player of roster(room)) player.ready = false;
      sendState(room);
      return;
    }
    room.phase = "countdown";
    room.countdown = countdownFrom;
    room.notice = "";
    scheduleStep(room);
    sendState(room);
  }

  function scheduleStep(room) {
    arm(room, countdownMs, () => {
      if (room.phase !== "countdown") return;
      if (room.countdown <= 1) {
        openQuestion(room);
        return;
      }
      room.countdown -= 1;
      sendState(room);
      scheduleStep(room);
    });
  }

  function openQuestion(room) {
    if (!room.pending && !ensurePending(room)) return;
    const built = room.pending;
    room.pending = null;
    room.roundIndex += 1;
    const round = {
      id: randomUUID(),
      public: built.public,
      reveal: built.reveal,
      normalize: built.normalize,
      grade: built.grade,
      answers: {},
      winnerId: null,
      reason: null,
      resolved: false,
    };
    room.round = round;
    room.phase = "question";
    room.countdown = null;
    arm(room, questionMs, () => expireQuestion(room, round.id));
    sendState(room);
  }

  function expireQuestion(room, roundId) {
    const round = room.round;
    if (room.phase !== "question" || !round || round.id !== roundId || round.resolved) return;
    round.resolved = true;
    round.reason = "timeout";
    enterReveal(room);
  }

  function enterReveal(room) {
    if (room.phase === "reveal" || room.phase === "results") return;
    const round = room.round;
    if (!round) return;
    room.phase = "reveal";
    const winnerId = round.winnerId;
    const matchOver = Boolean(winnerId && room.players[winnerId]?.score >= target);
    arm(room, revealMs, () => {
      room.round = null;
      if (matchOver) {
        room.phase = "results";
        room.matchWinnerId = winnerId;
        room.pending = null;
        for (const player of roster(room)) player.rematch = false;
        clearClock(room);
        sendState(room);
        return;
      }
      beginCountdown(room);
    });
    sendState(room);
  }

  function startMatch(room) {
    if (!bothOnline(room)) return;
    for (const player of roster(room)) {
      player.score = 0;
      player.ready = false;
      player.rematch = false;
    }
    room.used = [];
    room.usedIds = [];
    room.roundIndex = 0;
    room.round = null;
    room.pending = null;
    room.matchWinnerId = null;
    room.notice = "";
    beginCountdown(room);
  }

  function submit(room, playerId, message) {
    const round = room.round;
    if (room.phase !== "question" || room.paused) return;
    if (!round || round.resolved || message.roundId !== round.id) return;
    if (round.answers[playerId]) return;
    const value = round.normalize(message.value);
    if (value == null) {
      emit(playerId, { type: "answer-rejected", roundId: round.id });
      return;
    }
    // Arrival order on this process is the only clock that matters.
    // The first correct attempt resolves the round before a later one can score.
    const correct = round.grade(value) === true;
    round.answers[playerId] = { value, correct, receipt: room.receipt };
    room.receipt += 1;
    if (correct) {
      round.resolved = true;
      round.winnerId = playerId;
      round.reason = "correct";
      room.players[playerId].score += 1;
      enterReveal(room);
      return;
    }
    const players = roster(room);
    if (players.every((player) => round.answers[player.id])) {
      round.resolved = true;
      round.reason = "both-wrong";
      enterReveal(room);
      return;
    }
    sendState(room);
  }

  function removePlayer(room, playerId, notice) {
    const player = room.players[playerId];
    if (!player) return;
    if (player.abandonId != null) cancel(player.abandonId);
    delete room.players[playerId];
    membership.delete(playerId);
    listeners.delete(playerId);
    const remaining = roster(room);
    if (remaining.length === 0) {
      clearClock(room);
      rooms.delete(room.code);
      return;
    }
    if (player.host) remaining[0].host = true;
    room.notice = notice;
    const live = room.phase === "countdown" || room.phase === "question" || room.phase === "reveal";
    if (live) {
      clearClock(room);
      room.phase = "abandoned";
      room.round = null;
      room.pending = null;
    }
    sendState(room);
  }

  function scheduleAbandon(room, player) {
    if (player.abandonId != null) cancel(player.abandonId);
    const wait = room.phase === "lobby" ? lobbyGraceMs : disconnectMs;
    player.abandonId = schedule(() => {
      player.abandonId = null;
      if (player.connected) return;
      removePlayer(room, player.id, `${player.name} left`);
    }, wait);
  }

  function viewFor(room, playerId) {
    const you = room.players[playerId];
    return {
      code: room.code,
      you: playerId,
      token: you?.token ?? null,
      mode: room.mode,
      phase: room.phase,
      countdown: room.phase === "countdown" ? room.countdown : null,
      target,
      notice: room.notice,
      matchWinnerId: room.matchWinnerId,
      paused: room.paused,
      players: roster(room).map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        connected: player.connected,
        ready: player.ready,
        rematch: player.rematch,
        host: player.host,
      })),
      round: roundView(room, playerId),
    };
  }

  function roundView(room, playerId) {
    const round = room.round;
    if (!round || (room.phase !== "question" && room.phase !== "reveal")) return null;
    const opponent = roster(room).find((player) => player.id !== playerId);
    const mine = round.answers[playerId];
    const theirs = opponent ? round.answers[opponent.id] : null;
    const showing = room.phase === "reveal";
    return {
      id: round.id,
      index: room.roundIndex,
      question: round.public,
      youAnswered: Boolean(mine),
      youLocked: Boolean(mine && !mine.correct && !showing),
      opponentLocked: Boolean(theirs && !theirs.correct && !showing),
      timer: room.phase === "question" ? {
        key: room.timerKey,
        remainingMs: room.paused ? room.timerLeft : Math.max(0, room.timerDue - now()),
        paused: room.paused,
      } : null,
      reason: showing ? round.reason : null,
      winnerId: showing ? round.winnerId : null,
      reveal: showing ? round.reveal : null,
      guesses: showing
        ? Object.entries(round.answers).map(([id, answer]) => ({
          playerId: id,
          value: answer.value,
          correct: answer.correct,
        }))
        : [],
    };
  }

  function addPlayer(room, name, host) {
    const id = randomUUID();
    const player = {
      id,
      token: randomBytes(18).toString("base64url"),
      name,
      host,
      connected: true,
      ready: false,
      rematch: false,
      score: 0,
      joined: now(),
      abandonId: null,
    };
    room.players[id] = player;
    membership.set(id, room.code);
    return player;
  }

  function create({ name, mode }) {
    if (rooms.size >= MAX_ROOMS) return { ok: false, error: "Servers are full. Try again in a minute." };
    const code = makeCode(rooms);
    if (!code) return { ok: false, error: "Could not create a room." };
    const room = {
      code,
      mode: isPkMode(mode) ? mode : "higher",
      phase: "lobby",
      countdown: null,
      players: {},
      used: [],
      usedIds: [],
      roundIndex: 0,
      round: null,
      pending: null,
      matchWinnerId: null,
      paused: false,
      timerId: null,
      timerDue: 0,
      timerLeft: 0,
      timerFn: null,
      timerKey: 0,
      notice: "",
      receipt: 1,
    };
    rooms.set(code, room);
    const player = addPlayer(room, cleanName(name), true);
    return { ok: true, playerId: player.id };
  }

  function join({ name, code }) {
    const room = rooms.get(cleanCode(code));
    if (!room) return { ok: false, error: "Room not found" };
    if (roster(room).length >= 2) return { ok: false, error: "That room is full" };
    if (room.phase !== "lobby") return { ok: false, error: "That match already started" };
    room.notice = "";
    const player = addPlayer(room, cleanName(name), false);
    sendState(room);
    return { ok: true, playerId: player.id };
  }

  function resume({ code, playerId, token }) {
    const room = rooms.get(cleanCode(code));
    const player = room?.players[playerId];
    if (!room || !player || player.token !== token) return { ok: false, error: "Room not found" };
    return { ok: true, playerId };
  }

  function markConnected(playerId) {
    const located = locate(playerId);
    if (!located) return;
    const { room, player } = located;
    player.connected = true;
    if (player.abandonId != null) {
      cancel(player.abandonId);
      player.abandonId = null;
    }
    const live = room.phase === "countdown" || room.phase === "question" || room.phase === "reveal";
    if (live && room.paused && bothOnline(room)) resumeClock(room);
    if (room.phase === "results" && bothOnline(room) && roster(room).every((item) => item.rematch)) {
      startMatch(room);
      return;
    }
    sendState(room);
  }

  function disconnect(playerId) {
    const located = locate(playerId);
    if (!located) return;
    const { room, player } = located;
    if (!player.connected && player.abandonId != null) return;
    player.connected = false;
    player.ready = false;
    const live = room.phase === "countdown" || room.phase === "question" || room.phase === "reveal";
    if (live) pauseClock(room);
    scheduleAbandon(room, player);
    sendState(room);
  }

  function leave(playerId) {
    const located = locate(playerId);
    if (!located) return;
    removePlayer(located.room, playerId, `${located.player.name} left`);
  }

  function command(playerId, message) {
    const located = locate(playerId);
    if (!located || !message || typeof message !== "object") return;
    const { room, player } = located;
    if (message.type === "mode") {
      if (!player.host) return;
      if (room.phase !== "lobby" && room.phase !== "results") return;
      if (!isPkMode(message.mode) || message.mode === room.mode) return;
      room.mode = message.mode;
      room.pending = null;
      room.used = [];
      room.usedIds = [];
      room.notice = "";
      for (const item of roster(room)) {
        item.ready = false;
        item.rematch = false;
      }
      sendState(room);
      return;
    }
    if (message.type === "ready") {
      if (room.phase !== "lobby") return;
      player.ready = Boolean(message.ready);
      if (bothOnline(room) && roster(room).every((item) => item.ready)) {
        startMatch(room);
        return;
      }
      sendState(room);
      return;
    }
    if (message.type === "answer") {
      submit(room, playerId, message);
      return;
    }
    if (message.type === "rematch") {
      if (room.phase !== "results") return;
      player.rematch = Boolean(message.rematch);
      if (bothOnline(room) && roster(room).every((item) => item.rematch)) {
        startMatch(room);
        return;
      }
      sendState(room);
    }
  }

  return {
    create,
    join,
    resume,
    command,
    disconnect,
    leave,
    markConnected,
    subscribe(playerId, listener) {
      listeners.set(playerId, listener);
    },
    roomCount() {
      return rooms.size;
    },
  };
}
