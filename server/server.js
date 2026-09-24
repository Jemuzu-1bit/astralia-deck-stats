import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 2;
const ROOM_TTL_MS = 30 * 60 * 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const rooms = new Map();

app.get("/api/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

const makeId = () => crypto.randomBytes(8).toString("hex");
function makeCode() {
  let code;
  do code = crypto.randomBytes(3).toString("hex").toUpperCase();
  while (rooms.has(code));
  return code;
}
function playerName(value, fallback) {
  const valueText = String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
  return valueText || fallback;
}
function deckData(data) {
  if (!data || typeof data !== "object") return null;
  return {
    deckId: String(data.deckId || "").slice(0, 100) || null,
    deckName: String(data.deckName || "").slice(0, 60) || null,
    faction: String(data.faction || "").slice(0, 30) || null,
    protagonistId: String(data.protagonistId || "").slice(0, 100) || null,
    personaCards: Array.isArray(data.personaCards) ? data.personaCards.slice(0, 20).map(String) : null,
    mainDeckCards: Array.isArray(data.mainDeckCards) ? data.mainDeckCards.slice(0, 100) : null,
  };
}
function publicPlayer(player) {
  const { token: _token, ...safe } = player;
  return safe;
}
function publicState(room) {
  return {
    host: room.host ? publicPlayer(room.host) : null,
    guest: room.guest ? publicPlayer(room.guest) : null,
    started: room.started,
    code: room.code,
  };
}
function emitState(room) {
  io.to(room.code).emit("lobby:state", publicState(room));
}
function fail(socket, message) { socket.emit("lobby:error", message); }
function currentPlayer(socket, room) {
  if (!room) return null;
  if (room.host?.socketId === socket.id) return room.host;
  if (room.guest?.socketId === socket.id) return room.guest;
  return null;
}
function currentRoom(socket) { return rooms.get(socket.data.roomCode); }
function newPlayer(socket, name, role) {
  return {
    socketId: socket.id, token: makeId(), name: playerName(name, role === "host" ? "Host" : "Guest"),
    role, deckId: null, faction: null, protagonistId: null, deckName: null,
    personaCards: null, mainDeckCards: null, handCards: [], deckCards: [], connected: true,
  };
}

function createRoom(socket, name) {
  const code = makeCode();
  const room = { code, host: newPlayer(socket, name, "host"), guest: null, started: false, lastActivity: Date.now() };
  rooms.set(code, room);
  socket.join(code);
  socket.data.roomCode = code;
  socket.data.role = "host";
  socket.emit("lobby:joined", { code, role: "host", token: room.host.token });
  emitState(room);
}
function joinRoom(socket, payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return fail(socket, "Invalid or expired join code.");
  if (room.guest) return fail(socket, "This lobby is full.");
  room.guest = newPlayer(socket, payload?.name, "guest");
  room.lastActivity = Date.now();
  socket.join(code);
  socket.data.roomCode = code;
  socket.data.role = "guest";
  socket.emit("lobby:joined", { code, role: "guest", token: room.guest.token });
  emitState(room);
}

io.on("connection", (socket) => {
  socket.on("lobby:host", (name) => createRoom(socket, name));
  socket.on("lobby:join", (payload) => joinRoom(socket, payload));
  socket.on("lobby:setName", (name) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || room.started) return;
    player.name = playerName(name, player.role === "host" ? "Host" : "Guest"); room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("lobby:setFaction", (faction) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || room.started) return;
    player.faction = faction || null; player.deckId = null; player.deckName = null; room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("lobby:setDeck", (data) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || room.started) return;
    Object.assign(player, deckData(typeof data === "string" ? { deckId: data } : data)); room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("lobby:setHand", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) { player.handCards = Array.isArray(cards) ? cards.slice(0, 100).map(String) : []; emitState(room); }
  });
  socket.on("lobby:setDeckCards", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) { player.deckCards = Array.isArray(cards) ? cards.slice(0, 100).map(String) : []; emitState(room); }
  });
  socket.on("lobby:setPersonaCards", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) { player.personaCards = Array.isArray(cards) ? cards.slice(0, 30).map(String) : []; emitState(room); }
  });
  socket.on("lobby:shuffle", () => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    const opponent = player?.role === "host" ? room?.guest : room?.host;
    if (opponent?.socketId) io.to(opponent.socketId).emit("lobby:opponentShuffle");
  });
  socket.on("lobby:startRequest", () => {
    const room = currentRoom(socket);
    if (!room || room.host?.socketId !== socket.id) return fail(socket, "Only the host can start the match.");
    if (!room.guest || !room.host.deckId || !room.guest.deckId) return fail(socket, "Both players must select a deck first.");
    room.started = true; room.lastActivity = Date.now(); emitState(room);
    io.to(room.code).emit("lobby:started", { hostDeckId: room.host.deckId, guestDeckId: room.guest.deckId });
  });
  socket.on("lobby:leave", () => {
    const room = currentRoom(socket); if (!room) return;
    if (room.host?.socketId === socket.id) rooms.delete(room.code); else room.guest = null;
    socket.leave(room.code); delete socket.data.roomCode; emitState(room);
  });
  socket.on("disconnect", () => {
    const room = currentRoom(socket); if (!room) return;
    const player = currentPlayer(socket, room); if (player) player.connected = false;
    if (room.host?.socketId === socket.id) rooms.delete(room.code); else if (room.guest?.socketId === socket.id) room.guest = null;
    if (rooms.has(room.code)) emitState(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.lastActivity > ROOM_TTL_MS) rooms.delete(code);
}, 60_000).unref();

server.listen(PORT, () => console.log(`Socket.IO server running on http://localhost:${PORT}`));
