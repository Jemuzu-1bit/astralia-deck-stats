import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { publicState } from "./roomState.js";
import { cardInstance, dealOpeningHand, makeId } from "./gameTable.js";
import { registerCardEvents } from "./registerCardEvents.js";
import { registerDeckEvents } from "./registerDeckEvents.js";
import { startingPlayer } from "./turnOrder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const MAX_SPECTATORS = 20;
const ROOM_TTL_MS = 30 * 60 * 1000;
const TARGET_DURATION_MS = 5 * 1000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const rooms = new Map();

app.get("/api/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

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
function emitState(room) {
  for (const player of [room.host, room.guest]) {
    if (player?.socketId) io.to(player.socketId).emit("lobby:state", publicState(room, player.socketId));
  }
  for (const spectatorId of room.spectators) {
    io.to(spectatorId).emit("lobby:state", publicState(room, spectatorId));
  }
}
function showTargetArrow(room, card, targetUid, kind) {
  card.targetUid = targetUid;
  card.targetKind = kind;
  card.targetExpiresAt = Date.now() + TARGET_DURATION_MS;
  const expiresAt = card.targetExpiresAt;
  setTimeout(() => {
    if (card.targetUid !== targetUid || card.targetExpiresAt !== expiresAt) return;
    delete card.targetUid;
    delete card.targetKind;
    delete card.targetExpiresAt;
    emitState(room);
  }, TARGET_DURATION_MS);
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
    personaCards: null, mainDeckCards: null, handCards: [], deckCards: [],
    graveyardCards: [], oblivionCards: [], connected: true,
  };
}

function attachPlayer(socket, room, player) {
  room.spectators.delete(socket.id);
  const previousSocketId = player.socketId;
  if (previousSocketId && previousSocketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(previousSocketId);
    previousSocket?.leave(room.code);
    if (previousSocket) {
      delete previousSocket.data.roomCode;
      delete previousSocket.data.role;
      previousSocket.emit("lobby:error", "This game session was opened in another tab.");
    }
  }
  player.socketId = socket.id;
  player.connected = true;
  room.lastActivity = Date.now();
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.role = player.role;
}

function createRoom(socket, name) {
  if (socket.data.roomCode) return fail(socket, "Leave the current room first.");
  const code = makeCode();
  const room = { code, host: newPlayer(socket, name, "host"), guest: null, spectators: new Set(), started: false, lastActivity: Date.now() };
  rooms.set(code, room);
  attachPlayer(socket, room, room.host);
  socket.emit("lobby:joined", { code, role: "host", token: room.host.token });
  emitState(room);
}
function joinRoom(socket, payload) {
  if (socket.data.roomCode) return fail(socket, "Leave the current room first.");
  const code = String(payload?.code || "").trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return fail(socket, "Invalid or expired join code.");
  if (room.started) return fail(socket, "This match has started. Watch it instead.");
  if (room.guest) return fail(socket, "This lobby is full.");
  room.guest = newPlayer(socket, payload?.name, "guest");
  attachPlayer(socket, room, room.guest);
  socket.emit("lobby:joined", { code, role: "guest", token: room.guest.token });
  emitState(room);
}

function watchRoom(socket, payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return fail(socket, "Invalid or expired match code.");
  if (socket.data.roomCode && socket.data.roomCode !== code) return fail(socket, "Leave the current room first.");
  if (currentPlayer(socket, room)) return fail(socket, "You are already playing in this match.");
  if (!room.spectators.has(socket.id) && room.spectators.size >= MAX_SPECTATORS) return fail(socket, "This match has reached its spectator limit.");
  room.spectators.add(socket.id);
  socket.join(code);
  socket.data.roomCode = code;
  socket.data.role = "spectator";
  room.lastActivity = Date.now();
  socket.emit("lobby:joined", { code, role: "spectator" });
  emitState(room);
}

function resumeRoom(socket, payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  const token = String(payload?.token || "");
  const room = rooms.get(code);
  if (!room) return socket.emit("lobby:resumeError", "This game session has expired.");
  if (socket.data.roomCode && socket.data.roomCode !== code) return fail(socket, "Leave the current room first.");
  const player = [room.host, room.guest].find((entry) => entry?.token === token);
  if (!player) return socket.emit("lobby:resumeError", "This game session does not belong to this browser.");
  attachPlayer(socket, room, player);
  socket.emit("lobby:joined", { code, role: player.role, token: player.token, resumed: true });
  emitState(room);
  if (room.started) socket.emit("lobby:started", { hostDeckId: room.host.deckId, guestDeckId: room.guest?.deckId });
}

io.on("connection", (socket) => {
  socket.on("lobby:host", (name) => createRoom(socket, name));
  socket.on("lobby:join", (payload) => joinRoom(socket, payload));
  socket.on("lobby:watch", (payload) => watchRoom(socket, payload));
  socket.on("lobby:resume", (payload) => resumeRoom(socket, payload));
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
    if (player && room.started) {
      player.handCards = Array.isArray(cards) ? cards.slice(0, 100).map(String) : [];
      if (player.table) player.table.hand = player.handCards.map(cardInstance);
      emitState(room);
    }
  });
  socket.on("lobby:setDeckCards", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) {
      player.deckCards = Array.isArray(cards) ? cards.slice(0, 100).map(String) : [];
      if (player.table) player.table.deck = player.deckCards.map(cardInstance);
      emitState(room);
    }
  });
  socket.on("lobby:setPersonaCards", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) {
      player.personaCards = Array.isArray(cards) ? cards.slice(0, 30).map(String) : [];
      if (player.table) player.table.persona = player.personaCards.map(cardInstance);
      emitState(room);
    }
  });
  socket.on("lobby:setGraveyardCards", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) {
      player.graveyardCards = Array.isArray(cards) ? cards.slice(0, 100).map(String) : [];
      if (player.table) player.table.graveyard = player.graveyardCards.map(cardInstance);
      emitState(room);
    }
  });
  socket.on("lobby:setOblivionCards", (cards) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (player && room.started) {
      player.oblivionCards = Array.isArray(cards) ? cards.slice(0, 100).map(String) : [];
      if (player.table) player.table.oblivion = player.oblivionCards.map(cardInstance);
      emitState(room);
    }
  });
  registerCardEvents(socket, { currentRoom, currentPlayer, emitState, showTargetArrow });
  registerDeckEvents(socket, { currentRoom, currentPlayer, emitState });
  socket.on("lobby:shuffle", () => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    const opponent = player?.role === "host" ? room?.guest : room?.host;
    if (opponent?.socketId) io.to(opponent.socketId).emit("lobby:opponentShuffle");
  });
  socket.on("lobby:startRequest", () => {
    const room = currentRoom(socket);
    if (!room || room.host?.socketId !== socket.id) return fail(socket, "Only the host can start the match.");
    if (room.started) return;
    if (!room.guest || !room.host.deckId || !room.guest.deckId) return fail(socket, "Both players must select a deck first.");
    try { room.turnRole = startingPlayer(room.host, room.guest); }
    catch (error) { return fail(socket, error.message); }
    room.startVotes = { host: null, guest: null };
    room.turnNumber = room.turnRole ? 1 : 0;
    dealOpeningHand(room.host);
    dealOpeningHand(room.guest);
    room.started = true; room.lastActivity = Date.now(); emitState(room);
    io.to(room.code).emit("lobby:started", { hostDeckId: room.host.deckId, guestDeckId: room.guest.deckId });
  });
  socket.on("game:chooseStarter", (role) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!room?.started || !player || room.turnRole || (role !== "host" && role !== "guest")) return;
    room.startVotes[player.role] = role;
    if (room.startVotes.host && room.startVotes.host === room.startVotes.guest) {
      room.turnRole = role;
      room.turnNumber = 1;
    }
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:endTurn", () => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!room?.started || !player || room.turnRole !== player.role) return;
    room.turnRole = player.role === "host" ? "guest" : "host";
    room.turnNumber += 1;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("lobby:leave", () => {
    const room = currentRoom(socket); if (!room) return;
    if (room.host?.socketId === socket.id) {
      io.to(room.code).emit("lobby:closed", "The host ended this match.");
      for (const memberId of io.sockets.adapter.rooms.get(room.code) || []) {
        const member = io.sockets.sockets.get(memberId);
        if (member) { member.leave(room.code); delete member.data.roomCode; delete member.data.role; }
      }
      rooms.delete(room.code);
      return;
    }
    if (room.spectators.delete(socket.id)) {
      socket.leave(room.code); delete socket.data.roomCode; delete socket.data.role;
      room.lastActivity = Date.now(); emitState(room);
      return;
    }
    room.guest = null;
    room.deckRequest = null;
    room.deckRequestResult = null;
    socket.leave(room.code); delete socket.data.roomCode; delete socket.data.role; emitState(room);
  });
  socket.on("disconnect", () => {
    const room = currentRoom(socket); if (!room) return;
    if (room.spectators.delete(socket.id)) {
      room.lastActivity = Date.now(); emitState(room);
      return;
    }
    const player = currentPlayer(socket, room); if (player) player.connected = false;
    if (player) player.socketId = null;
    if (player) { room.deckRequest = null; room.deckRequestResult = null; }
    room.lastActivity = Date.now();
    emitState(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const hasConnectedPlayer = room.host?.connected || room.guest?.connected;
    if (!hasConnectedPlayer && now - room.lastActivity > ROOM_TTL_MS) rooms.delete(code);
  }
}, 60_000).unref();

server.listen(PORT, () => console.log(`Socket.IO server running on http://localhost:${PORT}`));
