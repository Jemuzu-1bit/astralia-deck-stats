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
function publicPlayer(player, viewerId) {
  const { token: _token, ...safe } = player;
  const handCount = player.table?.hand.length ?? player.handCards.length;
  const deckCount = player.table?.deck.length ?? player.deckCards.length;
  if (player.socketId === viewerId) return { ...safe, handCount, deckCount };
  return {
    ...safe,
    mainDeckCards: null,
    handCards: [],
    deckCards: [],
    table: player.table ? { ...player.table, hand: player.table.hand.filter((card) => card.revealed), deck: [] } : undefined,
    handCount,
    deckCount,
  };
}
function publicState(room, viewerId) {
  return {
    host: room.host ? publicPlayer(room.host, viewerId) : null,
    guest: room.guest ? publicPlayer(room.guest, viewerId) : null,
    started: room.started,
    code: room.code,
  };
}
function emitState(room) {
  for (const player of [room.host, room.guest]) {
    if (player?.socketId) io.to(player.socketId).emit("lobby:state", publicState(room, player.socketId));
  }
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

function shuffle(cards) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
}

const CARD_ZONES = ["hand", "deck", "persona", "graveyard", "oblivion", "battle", "protagonist"];
const LIST_ZONES = ["hand", "deck", "persona", "graveyard", "oblivion"];
const cardInstance = (id) => ({ uid: makeId(), id, frazzle: 0, revealed: false });
const protagonistInstance = (id) => ({ ...cardInstance(id), isProtagonist: true });

function syncCardLists(player) {
  const { table } = player;
  player.handCards = table.hand.map((card) => card.id);
  player.deckCards = table.deck.map((card) => card.id);
  player.personaCards = table.persona.map((card) => card.id);
  player.graveyardCards = table.graveyard.map((card) => card.id);
  player.oblivionCards = table.oblivion.map((card) => card.id);
}

function findCard(table, uid) {
  for (const zone of LIST_ZONES) {
    const index = table[zone].findIndex((card) => card.uid === uid);
    if (index !== -1) return { zone, index, card: table[zone][index], slotted: false };
  }
  for (let slot = 0; slot < table.battle.length; slot += 1) {
    const index = table.battle[slot].findIndex((card) => card.uid === uid);
    if (index !== -1) return { zone: "battle", slot, index, card: table.battle[slot][index], slotted: true };
  }
  const protagonistIndex = table.protagonist.findIndex((card) => card.uid === uid);
  if (protagonistIndex !== -1) return { zone: "protagonist", index: protagonistIndex, card: table.protagonist[protagonistIndex], slotted: true };
  return null;
}

function removeFoundCard(table, found) {
  if (found.zone === "battle") return table.battle[found.slot].splice(found.index, 1)[0];
  return table[found.zone].splice(found.index, 1)[0];
}

function dealOpeningHand(player) {
  const deck = (player.mainDeckCards || []).flatMap((entry) => {
    const id = String(entry?.id || "");
    const qty = Math.max(0, Math.min(100, Number(entry?.qty) || 0));
    return id ? Array.from({ length: qty }, () => id) : [];
  });
  shuffle(deck);
  player.table = {
    hand: deck.slice(0, 5).map(cardInstance),
    deck: deck.slice(5).map(cardInstance),
    persona: (player.personaCards || []).map(cardInstance),
    graveyard: [],
    oblivion: [],
    battle: Array.from({ length: 5 }, () => []),
    protagonist: player.protagonistId ? [protagonistInstance(player.protagonistId)] : [],
  };
  syncCardLists(player);
}

function createRoom(socket, name) {
  const code = makeCode();
  const room = { code, host: newPlayer(socket, name, "host"), guest: null, started: false, lastActivity: Date.now() };
  rooms.set(code, room);
  attachPlayer(socket, room, room.host);
  socket.emit("lobby:joined", { code, role: "host", token: room.host.token });
  emitState(room);
}
function joinRoom(socket, payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return fail(socket, "Invalid or expired join code.");
  if (room.guest) return fail(socket, "This lobby is full.");
  room.guest = newPlayer(socket, payload?.name, "guest");
  attachPlayer(socket, room, room.guest);
  socket.emit("lobby:joined", { code, role: "guest", token: room.guest.token });
  emitState(room);
}

function resumeRoom(socket, payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  const token = String(payload?.token || "");
  const room = rooms.get(code);
  if (!room) return socket.emit("lobby:resumeError", "This game session has expired.");
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
  socket.on("game:setFrazzle", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found?.slotted) return;
    const current = Number(found.card.frazzle) || 0;

    const requestedValue = Number(payload?.value);
    const delta = Number(payload?.delta);
    let next;
    if (Number.isInteger(requestedValue) && requestedValue >= 1 && requestedValue <= 2) next = requestedValue;
    else if (delta === -1 || delta === 1) next = Math.max(0, Math.min(2, current + delta));
    else return;
    found.card.frazzle = next;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:setStat", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    const stat = String(payload?.stat || "");
    if (!found?.slotted || !(stat === "atk" || stat === "hp")) return;

    const requestedValue = Number(payload?.value);
    const delta = Number(payload?.delta);
    let next;
    if (Number.isInteger(requestedValue) && requestedValue >= 0 && requestedValue <= 999) next = requestedValue;
    else if ((delta === -1 || delta === 1) && Number.isInteger(found.card[stat])) {
      next = Math.max(0, Math.min(999, found.card[stat] + delta));
    } else return;
    found.card[stat] = next;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:moveCard", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const table = player.table;
    const found = findCard(table, String(payload?.uid || ""));
    const target = String(payload?.to || "");
    if (!found || !CARD_ZONES.includes(target)) return;
    if (found.card.isProtagonist) return;
    if (target === "battle" || target === "protagonist") {
      const slot = Number(payload?.slot);
      if (target === "battle" && (!Number.isInteger(slot) || slot < 0 || slot >= table.battle.length)) return;
      if ((found.zone === "battle" && target === "battle" && found.slot === slot)
        || (found.zone === "protagonist" && target === "protagonist")) return;
      const destination = target === "battle" ? table.battle[slot] : table.protagonist;
      const card = removeFoundCard(table, found);
      card.revealed = false;
      destination.push(card);
    } else {
      const card = removeFoundCard(table, found);
      card.frazzle = 0;
      delete card.atk;
      delete card.hp;
      card.revealed = false;
      if (target === "deck" && payload?.position !== "bottom") table.deck.unshift(card);
      else table[target].push(card);
    }
    syncCardLists(player);
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:swapSlotCard", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found?.slotted || found.index < 1) return;
    const stack = found.zone === "battle" ? player.table.battle[found.slot] : player.table.protagonist;
    [stack[0], stack[found.index]] = [stack[found.index], stack[0]];
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:attachCard", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const table = player.table;
    const source = findCard(table, String(payload?.uid || ""));
    const target = findCard(table, String(payload?.targetUid || ""));
    if (!source || !target?.slotted || source.card.uid === target.card.uid) return;
    if (source.card.isProtagonist || (source.slotted && source.index > 0)) return;
    if (source.slotted && source.zone === target.zone
      && (source.zone === "protagonist" || source.slot === target.slot)) return;

    const targetStack = target.zone === "battle" ? table.battle[target.slot] : table.protagonist;
    const card = removeFoundCard(table, source);
    card.revealed = false;
    const currentTargetIndex = targetStack.findIndex((entry) => entry.uid === target.card.uid);
    targetStack.splice(currentTargetIndex + 1, 0, card);
    syncCardLists(player);
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:revealCard", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const card = player.table.hand.find((entry) => entry.uid === String(payload?.uid || ""));
    if (!card) return;
    card.revealed = payload?.revealed === true;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:deckAction", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const { deck } = player.table;
    const action = String(payload?.action || "");
    if (action === "shuffle") {
      shuffle(deck);
    } else {
      if (!(["draw", "discard", "oblivion"].includes(action))) return;
      const requested = Number(payload?.count);
      if (!Number.isInteger(requested) || requested < 1 || deck.length === 0) return;
      const cards = deck.splice(0, Math.min(requested, deck.length));
      cards.forEach((card) => { card.revealed = false; });
      const destination = action === "draw" ? player.table.hand
        : action === "discard" ? player.table.graveyard : player.table.oblivion;
      destination.push(...cards);
    }
    syncCardLists(player);
    room.lastActivity = Date.now(); emitState(room);
  });
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
    dealOpeningHand(room.host);
    dealOpeningHand(room.guest);
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
    if (player) player.socketId = null;
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
