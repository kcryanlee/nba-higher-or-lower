import { createServer } from "node:http";
import { attachPkServer } from "../server/attach.js";
import { createPkLobby } from "../server/pk.js";
import { startRedisPk } from "../server/redisPk.js";

const redisUrl = process.env.REDIS_URL || process.env.KV_URL || "";

const server = createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify({
    ok: true,
    websocket: true,
    mode: redisUrl ? "redis" : "memory",
  }));
});

if (redisUrl) {
  if (!globalThis.__nbaPkRedis) globalThis.__nbaPkRedis = startRedisPk(redisUrl);
  attachPkServer(server, { transport: globalThis.__nbaPkRedis });
} else {
  if (!globalThis.__nbaPkLobby) globalThis.__nbaPkLobby = createPkLobby();
  attachPkServer(server, { lobby: globalThis.__nbaPkLobby });
}

export default server;
