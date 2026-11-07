import { REQUESTABLE_DECK_ACTIONS, performDeckAction, makeId } from "./gameTable.js";

export function registerDeckEvents(socket, { currentRoom, currentPlayer, emitState }) {
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
}
