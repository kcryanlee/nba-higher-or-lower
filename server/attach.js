import { WebSocketServer } from "ws";
import { createPkLobby } from "./pk.js";

const attached = new WeakSet();

function localTransport(lobby) {
  return {
    create: async (message) => lobby.create(message),
    join: async (message) => lobby.join(message),
    resume: async (message) => lobby.resume(message),
    command: async (playerId, message) => {
      lobby.command(playerId, message);
    },
    leave: async (playerId) => {
      lobby.leave(playerId);
    },
    disconnect: async (playerId) => {
      lobby.disconnect(playerId);
    },
    bind: async (playerId, send) => {
      lobby.subscribe(playerId, send);
      lobby.markConnected(playerId);
    },
  };
}

function originAllowed(request) {
  const allowed = String(process.env.PK_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.length) return true;
  const origin = request.headers.origin;
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
    return Boolean(host && url.host === host);
  } catch {
    return false;
  }
}

export function attachPkServer(httpServer, options = {}) {
  if (!httpServer || attached.has(httpServer)) return null;
  attached.add(httpServer);
  const lobby = options.transport ? null : (options.lobby ?? createPkLobby(options));
  const transport = options.transport ?? localTransport(lobby);
  const sockets = new Map();
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    } catch {
      return;
    }
    if (pathname !== "/pk" && pathname !== "/api/pk") return;
    if (!originAllowed(request)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    ws.chain = Promise.resolve();
    ws.on("message", (raw) => {
      ws.chain = ws.chain.then(() => handle(ws, raw)).catch(() => {
        send(ws, { type: "error", message: "Could not reach the live race server." });
      });
    });
    ws.on("close", () => release(ws));
    ws.on("error", () => {
      ws.close();
    });
  });

  function send(ws, message) {
    if (ws.readyState === 1) ws.send(JSON.stringify(message));
  }

  function release(ws) {
    const playerId = ws.playerId;
    if (!playerId) return;
    if (sockets.get(playerId) !== ws) return;
    sockets.delete(playerId);
    ws.playerId = null;
    transport.disconnect(playerId).catch(() => {});
  }

  async function bind(ws, playerId) {
    const previous = sockets.get(playerId);
    if (previous && previous !== ws) {
      previous.playerId = null;
      previous.close();
    }
    ws.playerId = playerId;
    sockets.set(playerId, ws);
    const result = await transport.bind(playerId, (message) => send(ws, message));
    if (result && result.ok === false) {
      ws.playerId = null;
      if (sockets.get(playerId) === ws) sockets.delete(playerId);
      send(ws, { type: "error", message: result.error || "Room not found" });
    }
  }

  async function handle(ws, raw) {
    const text = String(raw ?? "");
    if (text.length > 2000) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) return;

    if (!ws.playerId) {
      if (message.type === "create") {
        const result = await transport.create({ name: message.name, mode: message.mode });
        if (!result?.ok) {
          send(ws, { type: "error", message: result?.error || "Could not create a room." });
          return;
        }
        await bind(ws, result.playerId);
        return;
      }
      if (message.type === "join") {
        const result = await transport.join({ name: message.name, code: message.code });
        if (!result?.ok) {
          send(ws, { type: "error", message: result?.error || "Could not join the room." });
          return;
        }
        await bind(ws, result.playerId);
        return;
      }
      if (message.type === "resume") {
        const result = await transport.resume({
          code: message.code,
          playerId: message.playerId,
          token: message.token,
        });
        if (!result?.ok) {
          send(ws, { type: "error", message: result?.error || "Room not found" });
          return;
        }
        await bind(ws, result.playerId);
        return;
      }
      return;
    }

    if (message.type === "leave") {
      const playerId = ws.playerId;
      ws.playerId = null;
      if (sockets.get(playerId) === ws) sockets.delete(playerId);
      await transport.leave(playerId);
      return;
    }

    await transport.command(ws.playerId, message);
  }

  return { lobby, wss };
}
