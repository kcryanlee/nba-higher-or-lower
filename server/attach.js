import { WebSocketServer } from "ws";
import { createPkLobby } from "./pk.js";

const attached = new WeakSet();

export function attachPkServer(httpServer, options = {}) {
  if (!httpServer || attached.has(httpServer)) return null;
  attached.add(httpServer);
  const lobby = options.lobby ?? createPkLobby(options);
  const sockets = new Map();
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    } catch {
      return;
    }
    if (pathname !== "/pk") return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => handle(ws, raw));
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
    lobby.disconnect(playerId);
  }

  function bind(ws, playerId) {
    const previous = sockets.get(playerId);
    if (previous && previous !== ws) {
      previous.playerId = null;
      previous.close();
    }
    ws.playerId = playerId;
    sockets.set(playerId, ws);
    lobby.subscribe(playerId, (message) => send(ws, message));
    lobby.markConnected(playerId);
  }

  function handle(ws, raw) {
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
        const result = lobby.create({ name: message.name, mode: message.mode });
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        bind(ws, result.playerId);
        return;
      }
      if (message.type === "join") {
        const result = lobby.join({ name: message.name, code: message.code });
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        bind(ws, result.playerId);
        return;
      }
      if (message.type === "resume") {
        const result = lobby.resume({
          code: message.code,
          playerId: message.playerId,
          token: message.token,
        });
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        bind(ws, result.playerId);
        return;
      }
      return;
    }

    if (message.type === "leave") {
      const playerId = ws.playerId;
      ws.playerId = null;
      if (sockets.get(playerId) === ws) sockets.delete(playerId);
      lobby.leave(playerId);
      return;
    }

    lobby.command(ws.playerId, message);
  }

  return { lobby, wss };
}
