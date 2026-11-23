function publicPlayer(player, viewerId, isSpectator, showProfile) {
  const { token: _token, ...safe } = player;
  if (!showProfile) delete safe.profile;
  const handCount = player.table?.hand.length ?? player.handCards.length;
  const deckCount = player.table?.deck.length ?? player.deckCards.length;
  if (player.socketId === viewerId) return { ...safe, handCount, deckCount };
  const publicCard = (card) => card.faceDown
    ? { ...card, id: "", flipped: false, atk: undefined, hp: undefined }
    : card;
  const publicTable = player.table ? {
    ...player.table,
    hand: (isSpectator ? player.table.hand : player.table.hand.filter((card) => card.revealed)).map(publicCard),
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
export function publicState(room, viewerId) {
  const viewer = [room.host, room.guest].find((player) => player?.socketId === viewerId);
  const isSpectator = !viewer && room.spectators.has(viewerId);
  return {
    instanceId: room.instanceId,
    revision: room.revision,
    host: room.host ? publicPlayer(room.host, viewerId, isSpectator, !room.started) : null,
    guest: room.guest ? publicPlayer(room.guest, viewerId, isSpectator, !room.started) : null,
    started: room.started,
    turnRole: room.turnRole ?? null,
    turnNumber: room.turnNumber ?? 0,
    startVotes: room.started && !room.turnRole ? room.startVotes : undefined,
    code: room.code,
    visibility: room.visibility === "public" ? "public" : "private",
    roomName: room.roomName || "Private room",
    viewerRole: viewer?.role ?? (isSpectator ? "spectator" : null),
    spectatorCount: room.spectators.size,
    activityLog: room.activityLog || [],
    deckRequest: viewer ? room.deckRequest || null : null,
    deckRequestResult: room.deckRequestResult?.fromRole === viewer?.role ? room.deckRequestResult : null,
  };
}
