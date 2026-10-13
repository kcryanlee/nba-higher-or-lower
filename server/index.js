import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachPkServer } from "./attach.js";

const port = Number(process.env.PORT) || 8787;
const pkOnly = process.env.PK_ONLY === "1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendFile(res, file) {
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(file).pipe(res);
}

function serveStatic(req, res) {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(root, `.${requested}`);
  const relative = path.relative(root, file);
  const inside = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (inside && existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file);
    return;
  }
  const fallback = path.join(root, "index.html");
  if (existsSync(fallback)) {
    sendFile(res, fallback);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Build the app first, then start the server.");
}

const server = createServer((req, res) => {
  if (pkOnly) {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  serveStatic(req, res);
});

attachPkServer(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`Live race server listening on ${port}`);
});
