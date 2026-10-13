import react from "@vitejs/plugin-react";
import net from "node:net";
import { spawn } from "node:child_process";
import { defineConfig } from "vite";

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function waitForPort(port) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      portOpen(port).then((open) => {
        if (open) {
          resolve();
          return;
        }
        if (Date.now() - started > 8000) {
          reject(new Error("Live race server did not start"));
          return;
        }
        setTimeout(attempt, 40);
      });
    };
    attempt();
  });
}

function pkLive() {
  let child = null;
  async function ensure(server) {
    if (!(await portOpen(8787))) {
        child = spawn(process.execPath, ["server/index.js"], {
        cwd: process.cwd(),
        stdio: "inherit",
        env: { ...process.env, PORT: "8787", PK_ONLY: "1" },
      });
      await waitForPort(8787);
    }
    const stop = () => {
      child?.kill();
      child = null;
    };
    server.httpServer?.on("close", stop);
  }
  return {
    name: "pk-live",
    configureServer: ensure,
    configurePreviewServer: ensure,
  };
}

const proxy = {
  "/pk": {
    target: "http://127.0.0.1:8787",
    ws: true,
  },
};

export default defineConfig({
  plugins: [react(), pkLive()],
  server: {
    host: true,
    proxy,
  },
  preview: {
    host: true,
    proxy,
  },
});
