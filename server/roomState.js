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
export function publicState(room, viewerId) {
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
