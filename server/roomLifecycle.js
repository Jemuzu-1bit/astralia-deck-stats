export const ROOM_TTL_MS = 30 * 60 * 1000;
export const PRESENCE_TTL_MS = 90 * 1000;

export function memberIds(room) {
  return [...new Set([room.host?.socketId, room.guest?.socketId, ...room.spectators].filter(Boolean))];
}

export function renewPresence(room, socketId, now) {
  if (!memberIds(room).includes(socketId)) return;
  room.presence ??= {};
  room.presence[socketId] = now + PRESENCE_TTL_MS;
}

export function roomExpiresAt(room) {
  const playerLeases = [room.host, room.guest].map((player) =>
    player?.socketId ? room.presence?.[player.socketId] || 0 : 0);
  return Math.max(room.lastActivity, ...playerLeases) + ROOM_TTL_MS;
}

// Timestamps are authoritative; timers only make cleanup visible sooner.
// A killed Function cannot leave a player or spectator permanently connected.
export function maintainRoom(room, now) {
  let changed = false;
  if (room.handoffs) {
    for (const [id, handoff] of Object.entries(room.handoffs)) {
      if (handoff.expiresAt <= now) delete room.handoffs[id];
    }
    if (!Object.keys(room.handoffs).length) delete room.handoffs;
  }
  for (const [id, expiresAt] of Object.entries(room.presence || {})) {
    if (expiresAt > now) continue;
    delete room.presence[id];
    if (room.spectators.delete(id)) changed = true;
    for (const player of [room.host, room.guest]) {
      if (player?.socketId !== id) continue;
      player.socketId = null;
      player.connected = false;
      room.deckRequest = null;
      room.deckRequestResult = null;
      changed = true;
    }
    room.lastActivity = Math.max(room.lastActivity, expiresAt);
  }
  for (const player of [room.host, room.guest]) {
    if (!player?.table) continue;
    for (const card of Object.values(player.table).flat(2)) {
      if (!card || typeof card !== "object" || !card.targetExpiresAt || card.targetExpiresAt > now) continue;
      delete card.targetUid;
      delete card.targetKind;
      delete card.targetExpiresAt;
      changed = true;
    }
  }
  return changed;
}
