import { publicState } from "./roomState.js";
import { cardInstance, dealOpeningHand, makeId } from "./gameTable.js";
import { registerCardEvents } from "./registerCardEvents.js";
import { registerDeckEvents } from "./registerDeckEvents.js";
import { startingPlayer } from "./turnOrder.js";
import { maintainRoom, renewPresence, memberIds } from "./roomLifecycle.js";
import { activityContext, appendActivity } from "./activityLog.js";

const MAX_SPECTATORS = 20;
const TARGET_DURATION_MS = 5 * 1000;

// Run existing game rules on an isolated snapshot. Effects are delivered only
// by the store's successful atomic commit; failed CAS attempts have no effects.
export function runRoomCommand(initialRoom, actor, event, payload, roomCode, now = Date.now()) {
  let current = initialRoom;
  let changed = current ? maintainRoom(current, now) : false;
  const effects = [];
  const handlers = new Map();
  const socket = {
    id: actor.id, data: { ...actor.data },
    on: (name, handler) => handlers.set(name, handler),
    emit: (name, data) => effects.push({ type: "emit", ids: [actor.id], event: name, payload: data }),
    join() {}, leave() {},
  };
  const rooms = {
    get: (code) => current?.code === code ? current : undefined,
    set: (_code, room) => { current = room; },
    delete: () => { current = null; },
  };
  const io = { to: (target) => ({ emit: (name, data) => effects.push({
    type: "emit", ids: target === current?.code ? memberIds(current) : [target], event: name, payload: data,
  }) }) };

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
  let commandChanged = false;
  function emitState() { changed = true; commandChanged = true; }
  function showTargetArrow(room, card, targetUid, kind) {
    card.targetUid = targetUid;
    card.targetKind = kind;
    card.targetExpiresAt = now + TARGET_DURATION_MS;
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
      delete room.presence?.[previousSocketId];
      effects.push({ type: "detach", ids: [previousSocketId], code: room.code });
      io.to(previousSocketId).emit("lobby:error", "This game session was opened in another tab.");
      io.to(previousSocketId).emit("lobby:replaced");
    }
    player.socketId = socket.id;
    player.connected = true;
    room.lastActivity = now;
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = player.role;
    socket.data.sessionToken = player.token;
  }

  function createRoom(socket, options) {
    if (socket.data.roomCode) return fail(socket, "Leave the current room first.");
    const code = roomCode;
    if (current) throw new Error("Room code collision");
    // Older clients send only a player name: their rooms remain private.
    const name = typeof options === "string" ? options : options?.name;
    const visibility = options?.visibility === "public" ? "public" : "private";
    const roomName = String(typeof options === "object" ? options?.roomName || "" : "").trim().replace(/\s+/g, " ").slice(0, 60) || `${playerName(name, "Host")}'s room`;
    const room = { code, instanceId: makeId(), visibility, roomName, createdAt: now, host: newPlayer(socket, name, "host"), guest: null, spectators: new Set(), started: false, lastActivity: now };
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
    room.lastActivity = now;
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

  socket.on("lobby:host", (name) => createRoom(socket, name));
  socket.on("lobby:join", (payload) => joinRoom(socket, payload));
  socket.on("lobby:watch", (payload) => watchRoom(socket, payload));
  socket.on("lobby:resume", (payload) => resumeRoom(socket, payload));
  socket.on("lobby:setName", (name) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || room.started) return;
    player.name = playerName(name, player.role === "host" ? "Host" : "Guest"); room.lastActivity = now; emitState(room);
  });
  socket.on("lobby:setFaction", (faction) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || room.started) return;
    player.faction = faction || null; player.deckId = null; player.deckName = null; room.lastActivity = now; emitState(room);
  });
  socket.on("lobby:setDeck", (data) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player || room.started) return;
    Object.assign(player, deckData(typeof data === "string" ? { deckId: data } : data)); room.lastActivity = now; emitState(room);
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
    if (!room.host.connected || !room.guest?.connected) return fail(socket, "Both players must be connected to start.");
    if (!room.guest || !room.host.deckId || !room.guest.deckId) return fail(socket, "Both players must select a deck first.");
    try { room.turnRole = startingPlayer(room.host, room.guest); }
    catch (error) { return fail(socket, error.message); }
    room.startVotes = { host: null, guest: null };
    room.startingRole = room.turnRole;
    room.turnNumber = room.turnRole ? 1 : 0;
    dealOpeningHand(room.host);
    dealOpeningHand(room.guest);
    room.started = true; room.lastActivity = now; emitState(room);
    io.to(room.code).emit("lobby:started", { hostDeckId: room.host.deckId, guestDeckId: room.guest.deckId });
  });
  socket.on("game:chooseStarter", (role) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!room?.started || !player || room.turnRole || (role !== "host" && role !== "guest")) return;
    room.startVotes[player.role] = role;
    if (room.startVotes.host && room.startVotes.host === room.startVotes.guest) {
      room.turnRole = role;
      room.startingRole = role;
      room.turnNumber = 1;
    }
    room.lastActivity = now; emitState(room);
  });
  socket.on("game:endTurn", () => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!room?.started || !player || room.turnRole !== player.role) return;
    room.startingRole ??= room.turnRole;
    room.turnRole = player.role === "host" ? "guest" : "host";
    if (room.turnRole === room.startingRole) room.turnNumber += 1;
    for (const participant of [room.host, room.guest]) {
      if (!participant?.table) continue;
      const fragments = participant.table.fragments;
      if (fragments.length < 10) fragments.push(false);
      fragments.fill(false);
    }
    room.lastActivity = now; emitState(room);
  });
  socket.on("lobby:leave", () => {
    const room = currentRoom(socket); if (!room) return;
    if (room.host?.socketId === socket.id) {
      io.to(room.code).emit("lobby:closed", "The host ended this match.");
      effects.push({ type: "detach", ids: memberIds(room), code: room.code });
      delete socket.data.roomCode; delete socket.data.role;
      rooms.delete(room.code);
      return;
    }
    if (room.spectators.delete(socket.id)) {
      socket.leave(room.code); delete socket.data.roomCode; delete socket.data.role;
      room.lastActivity = now; emitState(room);
      return;
    }
    if (room.guest?.socketId !== socket.id) return;
    room.guest = null;
    room.deckRequest = null;
    room.deckRequestResult = null;
    socket.leave(room.code); delete socket.data.roomCode; delete socket.data.role; emitState(room);
  });
  socket.on("disconnect", () => {
    const room = currentRoom(socket); if (!room) return;
    if (room.spectators.delete(socket.id)) {
      room.lastActivity = now; emitState(room);
      return;
    }
    const player = currentPlayer(socket, room); if (player) player.connected = false;
    if (player) player.socketId = null;
    if (player) { room.deckRequest = null; room.deckRequestResult = null; }
    room.lastActivity = now;
    emitState(room);
  });

  // Presence can expire during a store outage even while the WebSocket stays
  // open. A still-authenticated socket may reclaim its vacant seat, but never
  // replace a seat now occupied by another tab.
  if (current && actor.data.sessionToken
    && !["disconnect", "maintenance", "lobby:leave", "lobby:host", "lobby:join", "lobby:watch", "lobby:resume"].includes(event)) {
    const player = [current.host, current.guest].find((entry) => entry?.token === actor.data.sessionToken);
    if (player && !player.socketId) {
      attachPlayer(socket, current, player);
      emitState();
    }
  }
  if (event !== "maintenance" && event !== "heartbeat") {
    const before = activityContext(current, socket.id, event, payload);
    commandChanged = false;
    handlers.get(event)?.(payload);
    if (commandChanged) appendActivity(current, before, socket.id, event, payload, now);
  }
  if (current) {
    if (event !== "disconnect" && event !== "maintenance") renewPresence(current, socket.id, now);
    if (event === "disconnect" || event === "lobby:leave") delete current.presence?.[socket.id];
  }
  if (socket.data.roomCode === roomCode && (!current || !memberIds(current).includes(socket.id))) {
    delete socket.data.roomCode;
    delete socket.data.role;
    delete socket.data.sessionToken;
  }
  return {
    room: current, data: socket.data,
    effects,
    stateChanged: changed,
  };
}

export function stateEffects(room) {
  return memberIds(room).map((id) => ({
    type: "emit", ids: [id], event: "lobby:state", payload: publicState(room, id),
  }));
}
