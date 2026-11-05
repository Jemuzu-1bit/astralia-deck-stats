import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { setPrintedStats } from "./cardStats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 2;
const MAX_SPECTATORS = 20;
const ROOM_TTL_MS = 30 * 60 * 1000;
const TARGET_DURATION_MS = 5 * 1000;
const COUNTER_EMOJIS = new Map([
  ["📜", "Quest"], ["🔮", "Omen"], ["🛡️", "Shield"],
  ["⚙️", "Astralia Gear"], ["💥", "Explosion"],
  ["🏆", "Renown"], ["🌌", "Advent"],
]);
const EMOJI_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const validCounterEmoji = (emoji) => typeof emoji === "string" && emoji.length <= 32
  && [...EMOJI_SEGMENTER.segment(emoji)].length === 1
  && /\p{Extended_Pictographic}/u.test(emoji);

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
  const publicCard = (card) => card.faceDown
    ? { ...card, id: "", flipped: false, atk: undefined, hp: undefined }
    : card;
  const publicTable = player.table ? {
    ...player.table,
    hand: player.table.hand.filter((card) => card.revealed).map(publicCard),
    deck: [],
    persona: player.table.persona.map(publicCard),
    graveyard: player.table.graveyard.map(publicCard),
    oblivion: player.table.oblivion.map(publicCard),
    action: player.table.action.map(publicCard),
    battle: player.table.battle.map((stack) => stack.map(publicCard)),
    protagonist: player.table.protagonist.map(publicCard),
  } : undefined;
  return {
    ...safe,
    mainDeckCards: null,
    handCards: [],
    deckCards: [],
    personaCards: null,
    graveyardCards: [],
    oblivionCards: [],
    protagonistId: player.table?.protagonist[0]?.faceDown ? null : player.protagonistId,
    table: publicTable,
    handCount,
    deckCount,
  };
}
function publicState(room, viewerId) {
  const viewer = [room.host, room.guest].find((player) => player?.socketId === viewerId);
  return {
    host: room.host ? publicPlayer(room.host, viewerId) : null,
    guest: room.guest ? publicPlayer(room.guest, viewerId) : null,
    started: room.started,
    code: room.code,
    viewerRole: viewer?.role ?? (room.spectators.has(viewerId) ? "spectator" : null),
    spectatorCount: room.spectators.size,
    deckRequest: viewer ? room.deckRequest || null : null,
    deckRequestResult: room.deckRequestResult?.fromRole === viewer?.role ? room.deckRequestResult : null,
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

function shuffle(cards) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
}

const REQUESTABLE_DECK_ACTIONS = ["shuffle", "draw", "discard", "oblivion", "look", "search"];
function performDeckAction(player, action, count) {
  const { deck } = player.table;
  if (action === "shuffle") {
    shuffle(deck);
  } else {
    if (!["draw", "discard", "oblivion"].includes(action)) return false;
    if (!Number.isInteger(count) || count < 1 || deck.length === 0) return false;
    const cards = deck.splice(0, Math.min(count, deck.length));
    cards.forEach((card) => { card.revealed = false; });
    const destination = action === "draw" ? player.table.hand
      : action === "discard" ? player.table.graveyard : player.table.oblivion;
    destination.push(...cards);
  }
  syncCardLists(player);
  return true;
}

const CARD_ZONES = ["hand", "deck", "persona", "graveyard", "oblivion", "action", "battle", "protagonist"];
const LIST_ZONES = ["hand", "deck", "persona", "graveyard", "oblivion", "action"];
const cardInstance = (id) => ({ uid: makeId(), id, frazzle: 0, flipped: false, revealed: false });
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
    action: [],
    battle: Array.from({ length: 5 }, () => []),
    protagonist: player.protagonistId ? [protagonistInstance(player.protagonistId)] : [],
    fragments: [],
  };
  player.table.protagonist.forEach(setPrintedStats);
  syncCardLists(player);
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

    if (payload?.remove === true) {
      if (found.card[stat] === undefined) return;
      delete found.card[stat];
      room.lastActivity = Date.now(); emitState(room);
      return;
    }

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
  socket.on("game:adjustCounter", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found?.slotted || (payload?.remove !== true && payload?.delta !== 1 && payload?.delta !== -1)) return;
    const kind = payload?.kind;
    if (kind !== "emoji" && kind !== "name" && kind !== "customEmoji") return;
    const emoji = kind === "name" ? undefined : payload?.emoji;
    if (kind === "emoji" && !COUNTER_EMOJIS.has(emoji)) return;
    if (kind === "customEmoji" && !validCounterEmoji(emoji)) return;
    const label = kind === "emoji" ? COUNTER_EMOJIS.get(emoji)
      : String(payload?.label || "").trim().replace(/\s+/g, " ");
    if (!label || label.length > 24 || /[\x00-\x1f\x7f]/.test(label)) return;

    const counters = found.card.counters || [];
    const index = counters.findIndex((counter) => kind === "emoji"
      ? counter.kind === "emoji" && counter.emoji === emoji
      : counter.kind === kind && counter.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (payload?.remove === true) {
      if (index === -1) return;
      counters.splice(index, 1);
    } else if (index === -1) {
      if (payload.delta !== 1 || counters.length >= 8) return;
      counters.push({ kind, label, ...(emoji ? { emoji } : {}), value: 1 });
    } else {
      const next = counters[index].value + payload.delta;
      if (next < 0 || next > 99) return;
      if (next === 0) counters.splice(index, 1);
      else counters[index].value = next;
    }
    if (counters.length) found.card.counters = counters;
    else delete found.card.counters;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:updateFragments", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const fragments = Array.isArray(player.table.fragments) ? player.table.fragments : [];
    player.table.fragments = fragments;
    const action = String(payload?.action || "");
    const index = Number(payload?.index);

    if (action === "add") {
      if (fragments.length >= 10) return;
      fragments.push(false);
    } else if (action === "remove") {
      if (fragments.length === 0) return;
      fragments.pop();
    } else if (action === "spend") {
      const availableIndex = fragments.indexOf(false);
      if (availableIndex === -1) return;
      fragments[availableIndex] = true;
    } else if (action === "recover") {
      const spentIndex = fragments.lastIndexOf(true);
      if (spentIndex === -1) return;
      fragments[spentIndex] = false;
    } else if (action === "spendAll") {
      if (!fragments.includes(false)) return;
      fragments.fill(true);
    } else if (action === "recoverAll") {
      if (!fragments.includes(true)) return;
      fragments.fill(false);
    } else if (action === "set") {
      if (!Number.isInteger(index) || index < 0 || index >= fragments.length || typeof payload?.spent !== "boolean") return;
      if (fragments[index] === payload.spent) return;
      fragments[index] = payload.spent;
    } else return;

    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:playAction", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found || found.zone !== "hand") return;
    const card = removeFoundCard(player.table, found);
    card.revealed = false;
    player.table.action.push(card);
    syncCardLists(player);
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:moveCard", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const table = player.table;
    const found = findCard(table, String(payload?.uid || ""));
    const target = String(payload?.to || "");
    if (!found || !CARD_ZONES.includes(target)) return;
    if (target === "battle" || target === "protagonist") {
      const slot = Number(payload?.slot);
      if (target === "battle" && (!Number.isInteger(slot) || slot < 0 || slot >= table.battle.length)) return;
      if ((found.zone === "battle" && target === "battle" && found.slot === slot)
        || (found.zone === "protagonist" && target === "protagonist")) return;
      const destination = target === "battle" ? table.battle[slot] : table.protagonist;
      const card = removeFoundCard(table, found);
      card.revealed = false;
      if (!found.slotted) setPrintedStats(card);
      if (target === "protagonist" && card.isProtagonist) destination.unshift(card);
      else destination.push(card);
    } else {
      const owner = found.card.ownerRole && found.card.ownerRole !== player.role
        ? room[found.card.ownerRole] : player;
      if (!owner?.table) return;
      const card = removeFoundCard(table, found);
      card.frazzle = 0;
      delete card.atk;
      delete card.hp;
      delete card.counters;
      card.revealed = false;
      if (target === "hand" || target === "deck") card.faceDown = false;
      delete card.ownerRole;
      if (target === "deck" && payload?.position !== "bottom") owner.table.deck.unshift(card);
      else owner.table[target].push(card);
      if (owner !== player) syncCardLists(owner);
    }
    syncCardLists(player);
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:giveCardControl", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    const opponent = player?.role === "host" ? room?.guest : room?.host;
    if (!room?.started || !player?.table || !opponent?.table) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found?.slotted || found.card.isProtagonist) return;
    const originalOwnerRole = found.card.ownerRole || player.role;
    let destination;
    if (found.zone === "battle") {
      const openSlot = opponent.table.battle[found.slot].length === 0
        ? found.slot : opponent.table.battle.findIndex((stack) => stack.length === 0);
      destination = opponent.table.battle[openSlot === -1 ? found.slot : openSlot];
    } else destination = opponent.table.protagonist;
    const card = removeFoundCard(player.table, found);
    if (originalOwnerRole === opponent.role) delete card.ownerRole;
    else card.ownerRole = originalOwnerRole;
    card.revealed = false;
    destination.push(card);
    syncCardLists(player); syncCardLists(opponent);
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
    if (!source.slotted) setPrintedStats(card);
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
  socket.on("game:flipCard", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found) return;
    found.card.flipped = !found.card.flipped;
    if (found.slotted) setPrintedStats(found.card);
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:setFaceDown", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const found = findCard(player.table, String(payload?.uid || ""));
    if (!found || found.zone === "hand" || found.zone === "deck" || typeof payload?.faceDown !== "boolean") return;
    found.card.faceDown = payload.faceDown;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:setTarget", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const source = findCard(player.table, String(payload?.uid || ""));
    if (!source) return;

    if (payload?.targetUid === null) {
      delete source.card.targetUid;
      delete source.card.targetExpiresAt;
    }
    else {
      const targetUid = String(payload?.targetUid || "");
      if (!targetUid) return;
      const target = [room.host, room.guest]
        .map((candidate) => candidate?.table ? findCard(candidate.table, targetUid) : null)
        .find(Boolean);
      if (!target) return;
      source.card.targetUid = targetUid;
      source.card.targetExpiresAt = Date.now() + TARGET_DURATION_MS;
      const expiresAt = source.card.targetExpiresAt;
      setTimeout(() => {
        if (source.card.targetUid !== targetUid || source.card.targetExpiresAt !== expiresAt) return;
        delete source.card.targetUid;
        delete source.card.targetExpiresAt;
        emitState(room);
      }, TARGET_DURATION_MS);
    }
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:deckAction", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const action = String(payload?.action || "");
    if (!performDeckAction(player, action, Number(payload?.count))) return;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:requestDeckAction", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    const opponent = player?.role === "host" ? room?.guest : room?.host;
    if (!room?.started || !player?.table || !opponent?.table || !opponent.connected || room.deckRequest) return;
    const action = String(payload?.action || "");
    if (!REQUESTABLE_DECK_ACTIONS.includes(action) || opponent.table.deck.length === 0) return;
    const count = Number(payload?.count);
    if (!["shuffle", "search"].includes(action)
      && (!Number.isInteger(count) || count < 1 || count > opponent.table.deck.length)) return;
    room.deckRequest = {
      id: makeId(), fromRole: player.role, fromName: player.name, action,
      count: ["shuffle", "search"].includes(action) ? null : count,
    };
    room.deckRequestResult = null;
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:respondDeckAction", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    const request = room?.deckRequest;
    if (!room?.started || !player?.table || !request || player.role === request.fromRole
      || request.id !== String(payload?.id || "") || typeof payload?.accepted !== "boolean") return;
    if (payload.accepted && (player.table.deck.length === 0
      || (request.count !== null && request.count > player.table.deck.length))) return;
    room.deckRequest = null;
    room.deckRequestResult = { ...request, accepted: payload.accepted };
    if (payload.accepted && !["look", "search"].includes(request.action)) {
      performDeckAction(player, request.action, request.count);
    }
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:cancelDeckAction", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || !room?.deckRequest || room.deckRequest.fromRole !== player.role
      || room.deckRequest.id !== String(payload?.id || "")) return;
    room.deckRequest = null;
    room.deckRequestResult = null;
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
