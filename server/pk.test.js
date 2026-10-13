import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, test } from "node:test";
import { WebSocket } from "ws";
import { attachPkServer } from "./attach.js";
import { createPkLobby } from "./pk.js";
import { buildQuestion } from "./questions.js";

function createClock() {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now() {
      return time;
    },
    schedule(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { at: time + ms, fn });
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = time + ms;
      while (true) {
        let soonest = null;
        for (const [id, timer] of timers) {
          if (timer.at <= end && (!soonest || timer.at < soonest.at || (timer.at === soonest.at && id < soonest.id))) {
            soonest = { id, at: timer.at, fn: timer.fn };
          }
        }
        if (!soonest) break;
        timers.delete(soonest.id);
        time = soonest.at;
        soonest.fn();
      }
      time = end;
    },
  };
}

function fixture() {
  return {
    usedKey: `pair-${Math.random()}`,
    public: {
      kind: "higher",
      categoryId: "ppg",
      categoryLabel: "Points Per Game",
      prompt: "Who averages more points per game?",
      band: "Easy",
      left: { id: 1, name: "Ada Player", team: "Home" },
      right: { id: 2, name: "Grace Player", team: "Away" },
    },
    reveal: {
      higherId: 1,
      leftValue: 28.4,
      rightValue: 12.1,
    },
    normalize(value) {
      const id = Number(value);
      if (id !== 1 && id !== 2) return null;
      return id;
    },
    grade(value) {
      return value === 1;
    },
  };
}

function setup(overrides = {}) {
  const clock = createClock();
  const boxes = new Map();
  const lobby = createPkLobby({
    now: clock.now,
    schedule: clock.schedule,
    cancel: clock.cancel,
    countdownFrom: 3,
    countdownMs: 1000,
    questionMs: 15000,
    revealMs: 2000,
    disconnectMs: 45000,
    lobbyGraceMs: 20000,
    target: 5,
    nextQuestion: () => fixture(),
    ...overrides,
  });

  function track(playerId) {
    const box = [];
    boxes.set(playerId, box);
    lobby.subscribe(playerId, (message) => box.push(message));
    lobby.markConnected(playerId);
    return box;
  }

  const created = lobby.create({ name: "Ada", mode: "higher" });
  assert.equal(created.ok, true);
  const hostBox = track(created.playerId);
  const joined = lobby.join({ name: "Grace", code: hostBox.at(-1).code });
  assert.equal(joined.ok, true);
  const guestBox = track(joined.playerId);

  return {
    clock,
    lobby,
    hostId: created.playerId,
    guestId: joined.playerId,
    hostBox,
    guestBox,
  };
}

function latest(box) {
  assert.ok(box.length > 0);
  return box.at(-1);
}

function readyUp(session) {
  session.lobby.command(session.hostId, { type: "ready", ready: true });
  session.lobby.command(session.guestId, { type: "ready", ready: true });
  session.clock.advance(3000);
  assert.equal(latest(session.hostBox).phase, "question");
  assert.equal(latest(session.guestBox).phase, "question");
}

function scores(box) {
  const state = latest(box);
  return Object.fromEntries(state.players.map((player) => [player.id, player.score]));
}

describe("live race rules", () => {
  test("starts both players on the same hidden question after the countdown", () => {
    const session = setup();
    session.lobby.command(session.hostId, { type: "ready", ready: true });
    assert.equal(latest(session.hostBox).phase, "lobby");
    session.lobby.command(session.guestId, { type: "ready", ready: true });
    assert.equal(latest(session.hostBox).phase, "countdown");
    assert.equal(latest(session.hostBox).countdown, 3);
    assert.equal(latest(session.hostBox).round, null);
    session.clock.advance(3000);
    const host = latest(session.hostBox);
    const guest = latest(session.guestBox);
    assert.equal(host.phase, "question");
    assert.equal(guest.phase, "question");
    assert.deepEqual(host.round.question, guest.round.question);
    assert.equal(host.round.id, guest.round.id);
    assert.equal(host.round.reveal, null);
    assert.equal(JSON.stringify(host.round.question).includes("higherId"), false);
    assert.equal(JSON.stringify(host.round.question).includes("leftValue"), false);
    assert.equal(host.round.timer.remainingMs, 15000);
    assert.equal(host.target, 5);
  });

  test("awards exactly one point to the first correct submission", () => {
    const session = setup();
    readyUp(session);
    const roundId = latest(session.hostBox).round.id;

    session.lobby.command(session.hostId, { type: "answer", roundId, value: 1, score: 99 });
    session.lobby.command(session.guestId, { type: "answer", roundId, value: 1 });
    session.lobby.command(session.hostId, { type: "score", score: 99 });

    const host = latest(session.hostBox);
    const guest = latest(session.guestBox);
    assert.equal(host.phase, "reveal");
    assert.equal(host.round.reason, "correct");
    assert.equal(host.round.winnerId, session.hostId);
    assert.equal(host.round.reveal.higherId, 1);
    assert.equal(scores(session.hostBox)[session.hostId], 1);
    assert.equal(scores(session.hostBox)[session.guestId], 0);
    assert.equal(scores(session.guestBox)[session.hostId], 1);
    assert.equal(guest.round.winnerId, session.hostId);
    assert.equal(host.players.reduce((sum, player) => sum + player.score, 0), 1);
  });

  test("resolves the other arrival order the same way", () => {
    const session = setup();
    readyUp(session);
    const roundId = latest(session.hostBox).round.id;
    session.lobby.command(session.guestId, { type: "answer", roundId, value: 1 });
    session.lobby.command(session.hostId, { type: "answer", roundId, value: 1 });
    assert.equal(latest(session.hostBox).round.winnerId, session.guestId);
    assert.equal(scores(session.hostBox)[session.guestId], 1);
    assert.equal(scores(session.hostBox)[session.hostId], 0);
  });

  test("a wrong answer locks that player and still lets the opponent score", () => {
    const session = setup();
    readyUp(session);
    const roundId = latest(session.hostBox).round.id;
    session.lobby.command(session.hostId, { type: "answer", roundId, value: 2 });
    const locked = latest(session.hostBox);
    assert.equal(locked.phase, "question");
    assert.equal(locked.round.youLocked, true);
    assert.equal(locked.round.reveal, null);
    assert.equal(latest(session.guestBox).round.opponentLocked, true);
    assert.equal(latest(session.guestBox).round.youLocked, false);

    session.lobby.command(session.hostId, { type: "answer", roundId, value: 1 });
    assert.equal(latest(session.hostBox).phase, "question");
    assert.equal(scores(session.hostBox)[session.hostId], 0);

    session.lobby.command(session.guestId, { type: "answer", roundId, value: 1 });
    assert.equal(latest(session.guestBox).round.winnerId, session.guestId);
    assert.equal(scores(session.guestBox)[session.guestId], 1);
    assert.equal(scores(session.guestBox)[session.hostId], 0);
  });

  test("ends with no points when both answers are wrong", () => {
    const session = setup();
    readyUp(session);
    const roundId = latest(session.hostBox).round.id;
    session.lobby.command(session.hostId, { type: "answer", roundId, value: 2 });
    session.lobby.command(session.guestId, { type: "answer", roundId, value: 2 });
    const state = latest(session.hostBox);
    assert.equal(state.phase, "reveal");
    assert.equal(state.round.reason, "both-wrong");
    assert.equal(state.round.winnerId, null);
    assert.equal(scores(session.hostBox)[session.hostId], 0);
    assert.equal(scores(session.hostBox)[session.guestId], 0);
    assert.equal(state.round.guesses.length, 2);
  });

  test("ends with no points when the server timer expires", () => {
    const session = setup();
    readyUp(session);
    session.clock.advance(14999);
    assert.equal(latest(session.hostBox).phase, "question");
    session.clock.advance(1);
    const state = latest(session.hostBox);
    assert.equal(state.phase, "reveal");
    assert.equal(state.round.reason, "timeout");
    assert.equal(state.round.winnerId, null);
    assert.equal(scores(session.hostBox)[session.hostId], 0);
    assert.equal(scores(session.guestBox)[session.guestId], 0);
  });

  test("a late correct answer cannot score after the timer", () => {
    const session = setup();
    readyUp(session);
    const roundId = latest(session.hostBox).round.id;
    session.clock.advance(15000);
    session.lobby.command(session.hostId, { type: "answer", roundId, value: 1 });
    assert.equal(latest(session.hostBox).round.reason, "timeout");
    assert.equal(scores(session.hostBox)[session.hostId], 0);
  });

  test("advances both players together and ends at the target score", () => {
    const session = setup({ target: 2 });
    readyUp(session);
    session.lobby.command(session.hostId, {
      type: "answer",
      roundId: latest(session.hostBox).round.id,
      value: 1,
    });
    assert.equal(latest(session.hostBox).phase, "reveal");
    session.clock.advance(2000);
    assert.equal(latest(session.hostBox).phase, "countdown");
    assert.equal(latest(session.guestBox).phase, "countdown");
    assert.equal(latest(session.hostBox).countdown, 3);
    session.clock.advance(3000);
    assert.equal(latest(session.hostBox).phase, "question");
    assert.equal(latest(session.hostBox).round.index, 2);
    session.lobby.command(session.guestId, {
      type: "answer",
      roundId: latest(session.hostBox).round.id,
      value: 1,
    });
    assert.equal(scores(session.hostBox)[session.guestId], 1);
    session.clock.advance(2000);
    assert.equal(latest(session.hostBox).phase, "countdown");
    session.clock.advance(3000);
    session.lobby.command(session.hostId, {
      type: "answer",
      roundId: latest(session.hostBox).round.id,
      value: 1,
    });
    assert.equal(scores(session.hostBox)[session.hostId], 2);
    session.clock.advance(2000);
    const finished = latest(session.hostBox);
    assert.equal(finished.phase, "results");
    assert.equal(finished.matchWinnerId, session.hostId);
    assert.equal(latest(session.guestBox).phase, "results");
    assert.equal(latest(session.guestBox).matchWinnerId, session.hostId);
  });

  test("rematch starts only after both players agree", () => {
    const session = setup({ target: 1 });
    readyUp(session);
    session.lobby.command(session.hostId, {
      type: "answer",
      roundId: latest(session.hostBox).round.id,
      value: 1,
    });
    session.clock.advance(2000);
    assert.equal(latest(session.hostBox).phase, "results");
    session.lobby.command(session.hostId, { type: "rematch", rematch: true });
    assert.equal(latest(session.hostBox).phase, "results");
    assert.equal(latest(session.hostBox).players.find((player) => player.id === session.hostId).rematch, true);
    assert.equal(latest(session.guestBox).players.find((player) => player.id === session.guestId).rematch, false);
    session.lobby.command(session.guestId, { type: "rematch", rematch: true });
    const restarted = latest(session.hostBox);
    assert.equal(restarted.phase, "countdown");
    assert.equal(scores(session.hostBox)[session.hostId], 0);
    assert.equal(scores(session.hostBox)[session.guestId], 0);
    assert.equal(latest(session.guestBox).phase, "countdown");
  });

  test("the host's mode change reaches the other player before the race starts", () => {
    const session = setup();
    let current = "higher";
    for (const mode of ["scored", "chain", "career", "draft-pick"]) {
      session.lobby.command(session.guestId, { type: "mode", mode });
      assert.equal(latest(session.hostBox).mode, current);
      assert.equal(latest(session.guestBox).mode, current);
      session.lobby.command(session.hostId, { type: "mode", mode });
      assert.equal(latest(session.hostBox).mode, mode);
      assert.equal(latest(session.guestBox).mode, mode);
      current = mode;
    }
  });

  test("who scored more and teammate chain use the same first-correct scoring", () => {
    for (const mode of ["scored", "chain"]) {
      let built = null;
      const session = setup({
        nextQuestion(room) {
          built = buildQuestion(room);
          return built;
        },
      });
      session.lobby.command(session.hostId, { type: "mode", mode });
      assert.equal(latest(session.guestBox).mode, mode);
      readyUp(session);
      const roundId = latest(session.hostBox).round.id;
      assert.equal(latest(session.hostBox).round.question.kind, mode);
      assert.deepEqual(latest(session.hostBox).round.question, latest(session.guestBox).round.question);
      assert.equal(latest(session.hostBox).round.reveal, null);
      const hidden = JSON.stringify(latest(session.hostBox).round.question);
      assert.equal(hidden.includes('"pts"'), false);
      assert.equal(hidden.includes("validIds"), false);

      const wrong = mode === "scored"
        ? [built.reveal.ranking[1], built.reveal.ranking[0], built.reveal.ranking[2]]
        : built.public.choices.find((id) => !built.reveal.validIds.includes(id));
      const right = mode === "scored" ? built.reveal.ranking : built.reveal.validIds[0];
      session.lobby.command(session.hostId, { type: "answer", roundId, value: wrong });
      assert.equal(latest(session.hostBox).phase, "question");
      assert.equal(latest(session.hostBox).round.youLocked, true);
      assert.equal(scores(session.hostBox)[session.hostId], 0);
      session.lobby.command(session.guestId, { type: "answer", roundId, value: right });
      assert.equal(latest(session.guestBox).round.winnerId, session.guestId);
      assert.equal(scores(session.guestBox)[session.guestId], 1);
      assert.equal(scores(session.guestBox)[session.hostId], 0);
      assert.equal(latest(session.hostBox).round.reason, "correct");
    }
  });

  test("only the host can choose the mode, and only before the race starts", () => {
    const session = setup();
    session.lobby.command(session.guestId, { type: "mode", mode: "career" });
    assert.equal(latest(session.hostBox).mode, "higher");
    session.lobby.command(session.hostId, { type: "mode", mode: "draft-pick" });
    assert.equal(latest(session.guestBox).mode, "draft-pick");
    assert.equal(latest(session.hostBox).players.every((player) => player.ready === false), true);
    readyUp(session);
    session.lobby.command(session.hostId, { type: "mode", mode: "career" });
    assert.equal(latest(session.hostBox).mode, "draft-pick");
    assert.equal(latest(session.hostBox).phase, "question");
  });

  test("pauses the round while a player is disconnected", () => {
    const session = setup();
    readyUp(session);
    session.lobby.disconnect(session.guestId);
    assert.equal(latest(session.hostBox).paused, true);
    assert.equal(latest(session.hostBox).players.find((player) => player.id === session.guestId).connected, false);
    session.clock.advance(15000);
    assert.equal(latest(session.hostBox).phase, "question");
    assert.equal(scores(session.hostBox)[session.hostId], 0);
    session.lobby.markConnected(session.guestId);
    assert.equal(latest(session.hostBox).paused, false);
    session.clock.advance(15000);
    assert.equal(latest(session.hostBox).round.reason, "timeout");
  });

  test("ignores a score the client tries to declare", () => {
    const session = setup();
    session.lobby.command(session.hostId, { type: "score", score: 5 });
    session.lobby.command(session.guestId, { type: "players", players: [{ score: 5 }] });
    assert.equal(scores(session.hostBox)[session.hostId], 0);
    assert.equal(scores(session.hostBox)[session.guestId], 0);
  });
});

describe("question payloads", () => {
  test("higher or lower hides both stat lines until reveal data is separate", () => {
    const built = buildQuestion({ mode: "higher", roundIndex: 0, used: [], usedIds: [] });
    assert.ok(built);
    assert.equal(built.public.kind, "higher");
    for (const key of ["ppg", "rpg", "apg", "spg", "bpg", "fgPct", "tpPct", "ftPct", "salary", "heightIn", "threes", "careerPoints", "draftYear", "draftPick"]) {
      assert.equal(Object.hasOwn(built.public.left, key), false);
      assert.equal(Object.hasOwn(built.public.right, key), false);
    }
    assert.equal(built.public.leftValue, undefined);
    assert.equal(built.public.reveal, undefined);
    assert.equal(built.grade(built.reveal.higherId), true);
    const other = built.reveal.higherId === built.public.left.id ? built.public.right.id : built.public.left.id;
    assert.equal(built.grade(other), false);
    assert.equal(built.normalize(999999), null);
  });

  test("career path hides the player name", () => {
    const built = buildQuestion({ mode: "career", roundIndex: 0, used: [], usedIds: [] });
    assert.ok(built);
    assert.equal(built.public.kind, "career");
    assert.equal(JSON.stringify(built.public).includes(built.reveal.player), false);
    assert.equal(built.grade(built.reveal.player), true);
    assert.equal(built.grade("Not A Player"), false);
  });

  test("draft pick hides which choice is correct", () => {
    for (const mode of ["draft-year", "draft-pick"]) {
      const built = buildQuestion({ mode, roundIndex: 0, used: [], usedIds: [] });
      assert.ok(built, mode);
      assert.equal(built.public.kind, "draft");
      assert.equal(built.public.answer, undefined);
      assert.equal(built.public.choices.includes(built.reveal.answer), true);
      assert.equal(built.grade(built.reveal.answer), true);
      const wrong = built.public.choices.find((choice) => choice !== built.reveal.answer);
      assert.equal(built.grade(wrong), false);
    }
  });

  test("who scored more hides point totals and accepts only the perfect order", () => {
    const built = buildQuestion({ mode: "scored", roundIndex: 0, used: [], usedIds: [] });
    assert.ok(built);
    assert.equal(built.public.kind, "scored");
    assert.equal(built.public.ranking, undefined);
    assert.equal(built.public.players.length, 3);
    for (const player of built.public.players) {
      assert.equal(Object.hasOwn(player, "pts"), false);
      assert.equal(Object.hasOwn(player, "points"), false);
    }
    assert.equal(JSON.stringify(built.public).includes('"pts"'), false);
    assert.deepEqual(built.normalize(built.reveal.ranking), built.reveal.ranking);
    assert.equal(built.grade(built.reveal.ranking), true);
    const wrong = [built.reveal.ranking[1], built.reveal.ranking[0], built.reveal.ranking[2]];
    assert.equal(built.grade(wrong), false);
    assert.equal(built.normalize(wrong.slice(0, 2)), null);
    assert.equal(built.normalize("not-an-order"), null);
  });

  test("teammate chain hides which choice links both careers", () => {
    const built = buildQuestion({ mode: "chain", roundIndex: 0, used: [], usedIds: [] });
    assert.ok(built);
    assert.equal(built.public.kind, "chain");
    assert.equal(built.public.validIds, undefined);
    assert.equal(built.public.choices.length, 4);
    assert.equal(JSON.stringify(built.public).includes("validIds"), false);
    assert.ok(built.reveal.validIds.length >= 1);
    for (const id of built.reveal.validIds) {
      assert.equal(built.public.choices.includes(id), true);
      assert.equal(built.grade(id), true);
      assert.equal(built.normalize(id), id);
    }
    const wrong = built.public.choices.find((id) => !built.reveal.validIds.includes(id));
    assert.equal(typeof wrong, "number");
    assert.equal(built.grade(wrong), false);
    assert.equal(built.normalize(999999), null);
  });
});

describe("two sockets", () => {
  test("two sessions share a room and the server score", async () => {
    const server = createServer();
    const attached = attachPkServer(server, {
      countdownFrom: 1,
      countdownMs: 20,
      questionMs: 800,
      revealMs: 30,
      disconnectMs: 25,
      lobbyGraceMs: 25,
      target: 5,
      nextQuestion: () => fixture(),
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    function connect() {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/pk`);
        const messages = [];
        ws.on("message", (data) => messages.push(JSON.parse(String(data))));
        ws.on("open", () => {
          resolve({
            ws,
            messages,
            send(message) {
              ws.send(JSON.stringify(message));
            },
            latestWhere(predicate, timeout = 2000) {
              return new Promise((resolveWait, rejectWait) => {
                const started = Date.now();
                const timer = setInterval(() => {
                  const found = [...messages].reverse().find(predicate);
                  if (found) {
                    clearInterval(timer);
                    resolveWait(found);
                  } else if (Date.now() - started > timeout) {
                    clearInterval(timer);
                    rejectWait(new Error(`timed out waiting. last=${JSON.stringify(messages.at(-1))}`));
                  }
                }, 10);
              });
            },
          });
        });
        ws.on("error", reject);
      });
    }

    const host = await connect();
    const guest = await connect();
    try {
      host.send({ type: "create", name: "Ada", mode: "career" });
      const created = await host.latestWhere((message) => message.type === "state" && message.code);
      guest.send({ type: "join", name: "Grace", code: created.code.toLowerCase() });
      const joined = await guest.latestWhere((message) => message.type === "state" && message.players.length === 2);
      assert.equal(joined.code, created.code);
      assert.equal(joined.mode, "career");
      assert.notEqual(joined.token, created.token);

      host.send({ type: "mode", mode: "higher" });
      await guest.latestWhere((message) => message.mode === "higher");
      host.send({ type: "ready", ready: true });
      guest.send({ type: "ready", ready: true });
      const hostQuestion = await host.latestWhere((message) => message.phase === "question");
      const guestQuestion = await guest.latestWhere((message) => message.phase === "question");
      assert.deepEqual(hostQuestion.round.question, guestQuestion.round.question);
      assert.equal(hostQuestion.round.reveal, null);
      assert.equal(JSON.stringify(hostQuestion).includes("leftValue"), false);
      assert.equal(JSON.stringify(guestQuestion).includes(created.token), false);

      guest.send({ type: "score", score: 4 });
      guest.send({ type: "answer", roundId: guestQuestion.round.id, value: 2 });
      const locked = await guest.latestWhere((message) => message.round?.youLocked === true);
      assert.equal(locked.round.reveal, null);
      const opponentSeesLock = await host.latestWhere((message) => message.round?.opponentLocked === true);
      assert.equal(opponentSeesLock.players.find((player) => player.id === created.you).score, 0);

      host.send({ type: "answer", roundId: hostQuestion.round.id, value: 1 });
      const revealed = await host.latestWhere((message) => message.phase === "reveal");
      assert.equal(revealed.round.winnerId, created.you);
      assert.equal(revealed.round.reveal.higherId, 1);
      assert.equal(revealed.players.find((player) => player.id === created.you).score, 1);
      assert.equal(revealed.players.find((player) => player.id === joined.you).score, 0);
      const guestReveal = await guest.latestWhere((message) => message.phase === "reveal");
      assert.equal(guestReveal.players.find((player) => player.id === created.you).score, 1);
      assert.equal(guestReveal.round.winnerId, created.you);
    } finally {
      host.ws.close();
      guest.ws.close();
      attached.wss.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
