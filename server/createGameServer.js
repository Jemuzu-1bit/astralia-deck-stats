import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { MemoryBackend, RoomStore, decodeRoom } from "./roomStore.js";
import { publicState } from "./roomState.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const codePattern = /^[A-F0-9]{6}$/;

export async function createGameServer({ backend, socketPath = "/socket.io", serveStatic = true } = {}) {
  if (!backend) {
    if (process.env.REDIS_URL) {
      const { RedisBackend } = await import("./redisBackend.js");
      backend = new RedisBackend(process.env.REDIS_URL, process.env.REDIS_KEY_PREFIX);
    } else {
      if (process.env.VERCEL) throw new Error("REDIS_URL and REDIS_KEY_PREFIX are required on Vercel.");
      backend = new MemoryBackend();
    }
  }
  try { await backend.ping(); }
  catch (error) { await backend.close(); throw error; }
  const store = new RoomStore(backend);
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { path: socketPath, cors: { origin: true }, transports: ["websocket"] });
  app.get(["/api/health", "/api/game", "/api/game/health"], async (_req, res) => {
    try { await backend.ping(); res.json({ ok: true, rooms: await backend.count() }); }
    catch { res.status(503).json({ ok: false }); }
  });
  if (serveStatic) {
    app.use(express.static(path.join(directory, "../client/dist")));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(directory, "../client/dist/index.html")));
  }

  function deliver(socket, event, payload) {
    if (event === "lobby:state") {
      const previous = socket.data.lastState;
      if (previous?.instanceId === payload.instanceId && previous.revision >= payload.revision) return;
      socket.data.lastState = { instanceId: payload.instanceId, revision: payload.revision };
    }
    socket.emit(event, payload);
  }
  const unsubscribe = backend.subscribe((effects) => {
    for (const effect of effects) {
      for (const id of effect.ids) {
        const socket = io.sockets.sockets.get(id);
        if (!socket) continue;
        if (effect.type === "detach") {
          socket.data.membershipGeneration = (socket.data.membershipGeneration || 0) + 1;
          if (socket.data.roomCode === effect.code) {
            delete socket.data.roomCode;
            delete socket.data.role;
            delete socket.data.sessionToken;
          }
        } else deliver(socket, effect.event, effect.payload);
      }
    }
  });

  io.on("connection", (socket) => {
    let queue = Promise.resolve();
    let pending = 0;
    const enqueue = (operation) => {
      if (pending >= 200) return Promise.reject(new Error("Too many pending actions."));
      pending++;
      const result = queue.then(operation);
      queue = result.catch(() => {}).finally(() => { pending--; });
      return result;
    };
    socket.data.enqueue = enqueue;
    const actor = () => ({ id: socket.id, data: {
      roomCode: socket.data.roomCode, role: socket.data.role, sessionToken: socket.data.sessionToken,
    } });
    const execute = async (event, payload, commandId) => {
      const membershipGeneration = socket.data.membershipGeneration || 0;
      let code = socket.data.roomCode;
      if (event === "lobby:host") code = crypto.randomBytes(3).toString("hex").toUpperCase();
      else if (["lobby:join", "lobby:watch", "lobby:resume"].includes(event)) code = String(payload?.code || "").trim().toUpperCase();
      if (!codePattern.test(code || "")) {
        if (event !== "disconnect" && event !== "heartbeat") {
          socket.emit(event === "lobby:resume" ? "lobby:resumeError" : "lobby:error", "Invalid or expired join code.");
        }
        return;
      }
      let result;
      for (let attempt = 0; attempt < 5; attempt++) {
        try { result = await store.execute(code, actor(), event, payload, commandId); break; }
        catch (error) {
          if (event !== "lobby:host" || error.message !== "Room code collision") throw error;
          code = crypto.randomBytes(3).toString("hex").toUpperCase();
        }
      }
      if (!result) throw new Error("Could not allocate a room code.");
      // A remote takeover/room closure can arrive while this command is saving.
      // Its detach must not be undone by the command's older local snapshot.
      if ((socket.data.membershipGeneration || 0) === membershipGeneration) {
        socket.data.roomCode = result.data.roomCode;
        socket.data.role = result.data.role;
        socket.data.sessionToken = result.data.sessionToken;
      }
    };
    socket.onAny((event, packet, acknowledge) => {
      if (!/^(lobby|game):[a-zA-Z]+$/.test(event)) return;
      const commandId = typeof packet?.__commandId === "string" && packet.__commandId.length <= 80 ? packet.__commandId : undefined;
      const payload = commandId ? packet.data : packet;
      enqueue(() => execute(event, payload, commandId)).then(() => {
        if (typeof acknowledge === "function") acknowledge({ ok: true });
      }).catch(() => {
        socket.emit("lobby:error", "The game server is temporarily unavailable. Please try again.");
        if (typeof acknowledge === "function") acknowledge({ ok: false });
      });
    });
    socket.conn.on("packet", (packet) => {
      if (packet.type === "pong" && socket.data.roomCode) enqueue(() => execute("heartbeat")).catch(() => {});
    });
    socket.on("disconnect", () => { enqueue(() => execute("disconnect")).catch(() => {}); });
  });

  let sweeping = false;
  let tick = 0;
  const timer = setInterval(async () => {
    if (sweeping || !io.sockets.sockets.size) return;
    sweeping = true;
    try {
      const codes = new Set([...io.sockets.sockets.values()].map((socket) => socket.data.roomCode).filter(Boolean));
      for (const code of codes) await store.execute(code, { id: "", data: {} }, "maintenance");
      // Pub/Sub is live delivery, not a durable inbox. Repair missed notifications
      // after an interruption by rereading the authoritative snapshot.
      if (++tick % 5 === 0) {
        for (const socket of io.sockets.sockets.values()) {
          await socket.data.enqueue(async () => {
            const code = socket.data.roomCode;
            if (!code) return;
            const room = decodeRoom(await backend.get(code));
            if (!room) {
              socket.data.roomCode = undefined;
              socket.emit("lobby:closed", "This game session has expired.");
              return;
            }
            const state = publicState(room, socket.id);
            if (!state.viewerRole) {
              socket.data.roomCode = undefined;
              socket.data.sessionToken = undefined;
              socket.emit("lobby:replaced");
              return;
            }
            deliver(socket, "lobby:state", state);
          });
        }
      }
    } catch { /* The next tick retries recovery; health checks report store outages. */ }
    finally { sweeping = false; }
  }, 1000);
  timer.unref();

  return { server, io, store, backend, async close() {
    clearInterval(timer);
    unsubscribe();
    await new Promise((resolve) => io.close(resolve));
    await backend.close();
  } };
}
