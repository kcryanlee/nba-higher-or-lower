import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { createPkLobby } from "./pk.js";

const LOCK_KEY = "pk:leader";
const STATE_KEY = "pk:state";
const QUEUE_KEY = "pk:rpc";
const OUT_CHANNEL = "pk:out";
const RES_CHANNEL = "pk:res";
const LOCK_MS = 3000;

export function startRedisPk(url) {
  const id = randomUUID();
  const gate = { leading: false };
  const commands = new Redis(url, {
    maxRetriesPerRequest: 2,
    connectTimeout: 4000,
  });
  const subscriber = commands.duplicate();
  const pending = new Map();
  const localSenders = new Map();
  let draining = false;

  const lobby = createPkLobby({
    onEmit(playerId, message) {
      if (!gate.leading) return;
      commands.publish(OUT_CHANNEL, JSON.stringify({ playerId, message })).catch(() => {});
    },
    onChange() {
      if (!gate.leading) return;
      commands.set(STATE_KEY, JSON.stringify(lobby.snapshot())).catch(() => {});
    },
  });

  subscriber.subscribe(OUT_CHANNEL, RES_CHANNEL).catch(() => {});
  subscriber.on("message", (channel, raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (channel === RES_CHANNEL) {
      const waiter = pending.get(data.reqId);
      if (!waiter) return;
      pending.delete(data.reqId);
      clearTimeout(waiter.timer);
      waiter.resolve(data.result);
      return;
    }
    if (channel === OUT_CHANNEL) localSenders.get(data.playerId)?.(data.message);
  });

  async function ensureLeader() {
    if (localSenders.size === 0 && pending.size === 0) return false;
    if (gate.leading) {
      const current = await commands.get(LOCK_KEY);
      if (current === id) {
        await commands.pexpire(LOCK_KEY, LOCK_MS);
        return true;
      }
      gate.leading = false;
      lobby.freeze();
    }
    const acquired = await commands.set(LOCK_KEY, id, "PX", LOCK_MS, "NX");
    if (acquired !== "OK") {
      const current = await commands.get(LOCK_KEY);
      if (current !== id) return false;
    }
    gate.leading = true;
    const raw = await commands.get(STATE_KEY);
    let saved = { rooms: [] };
    try {
      saved = raw ? JSON.parse(raw) : { rooms: [] };
    } catch {
      saved = { rooms: [] };
    }
    lobby.restore(saved);
    return true;
  }

  async function apply(req) {
    let result = { ok: true };
    try {
      if (req.op === "create") result = lobby.create(req.payload);
      else if (req.op === "join") result = lobby.join(req.payload);
      else if (req.op === "resume") result = lobby.resume(req.payload);
      else if (req.op === "command") lobby.command(req.payload.playerId, req.payload.message);
      else if (req.op === "leave") lobby.leave(req.payload.playerId);
      else if (req.op === "disconnect") lobby.disconnect(req.payload.playerId);
      else if (req.op === "bind") {
        if (!lobby.known(req.payload.playerId)) result = { ok: false, error: "Room not found" };
        else {
          lobby.subscribe(req.payload.playerId, () => {});
          lobby.markConnected(req.payload.playerId);
        }
      }
    } catch {
      result = { ok: false, error: "Something went wrong" };
    }
    if (gate.leading) await commands.set(STATE_KEY, JSON.stringify(lobby.snapshot()));
    await commands.publish(RES_CHANNEL, JSON.stringify({ reqId: req.reqId, result }));
  }

  async function leadOnce() {
    if (draining) return;
    if (localSenders.size === 0 && pending.size === 0) return;
    draining = true;
    try {
      const leading = await ensureLeader();
      if (!leading) return;
      for (let step = 0; step < 25; step += 1) {
        if (!gate.leading) return;
        const raw = await commands.lpop(QUEUE_KEY);
        if (!raw) return;
        await apply(JSON.parse(raw));
      }
    } catch {
      // The caller's timeout reports a clear room error if this attempt dies.
    } finally {
      draining = false;
    }
  }

  async function releaseIfIdle() {
    if (localSenders.size > 0 || pending.size > 0 || !gate.leading) return;
    try {
      await commands.set(STATE_KEY, JSON.stringify(lobby.snapshot()));
      const current = await commands.get(LOCK_KEY);
      if (current === id) await commands.del(LOCK_KEY);
    } catch {
      // The lock expires on its own if this instance is going away.
    }
    gate.leading = false;
    lobby.freeze();
  }

  const tick = setInterval(() => {
    leadOnce().catch(() => {});
  }, 400);
  tick.unref?.();

  function rpc(op, payload) {
    const reqId = randomUUID();
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(reqId);
        reject(new Error("timeout"));
      }, 8000);
      pending.set(reqId, { resolve, reject, timer });
    });
    commands.rpush(QUEUE_KEY, JSON.stringify({ reqId, op, payload }))
      .then(() => leadOnce())
      .catch((error) => {
        const waiter = pending.get(reqId);
        if (!waiter) return;
        pending.delete(reqId);
        clearTimeout(waiter.timer);
        waiter.reject(error);
      });
    return result;
  }

  return {
    async create(payload) {
      return rpc("create", payload);
    },
    async join(payload) {
      return rpc("join", payload);
    },
    async resume(payload) {
      return rpc("resume", payload);
    },
    async command(playerId, message) {
      return rpc("command", { playerId, message });
    },
    async leave(playerId) {
      return rpc("leave", { playerId });
    },
    async disconnect(playerId) {
      localSenders.delete(playerId);
      try {
        return await rpc("disconnect", { playerId });
      } finally {
        await releaseIfIdle();
      }
    },
    async bind(playerId, send) {
      localSenders.set(playerId, send);
      return rpc("bind", { playerId });
    },
  };
}
