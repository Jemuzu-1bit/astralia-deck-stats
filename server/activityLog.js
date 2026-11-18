import { findCard } from "./gameTable.js";
import { getCardName } from "./cardStats.js";

export const MAX_ACTIVITY_ENTRIES = 1000;
const zones = { hand: "hand", deck: "deck", persona: "Persona", graveyard: "Graveyard", oblivion: "Oblivion", action: "Action area", battle: "Battle", protagonist: "Protagonist" };
const events = new Set([
  "lobby:startRequest", "game:chooseStarter", "game:endTurn", "game:deckAction",
  "game:requestDeckAction", "game:respondDeckAction", "game:cancelDeckAction",
  "game:setFrazzle", "game:setStat", "game:adjustCounter", "game:updateFragments",
  "game:playAction", "game:moveCard", "game:giveCardControl", "game:swapSlotCard",
  "game:attachCard", "game:revealCard", "game:flipCard", "game:setFaceDown",
  "game:setTarget", "game:attack", "game:block",
]);

// Capture only the context needed for this command, before its cards move.
export function activityContext(room, actorId, event, payload) {
  if (!room || !events.has(event)) return null;
  const player = [room.host, room.guest].find((entry) => entry?.socketId === actorId);
  if (!player) return null;
  const locate = (uid) => {
    if (!uid) return null;
    for (const owner of [room.host, room.guest]) {
      const found = owner?.table && findCard(owner.table, uid);
      if (found) return { ...found, ownerRole: owner.role };
    }
    return null;
  };
  return structuredClone({
    role: player.role, name: player.name, started: room.started,
    turnRole: room.turnRole, turnNumber: room.turnNumber, votes: room.startVotes,
    source: locate(payload?.uid), target: locate(payload?.targetUid),
    deckCount: player.table?.deck.length, fragments: player.table?.fragments,
    request: room.deckRequest, result: room.deckRequestResult,
  });
}

function cardLabel(found) {
  if (!found) return "a card";
  if (found.card.faceDown) return "a face-down card";
  if (found.zone === "deck" || (found.zone === "hand" && !found.card.revealed)) return "a hidden card";
  return getCardName(found.card.id);
}

function location(found) {
  return found?.zone === "battle" ? `Battle slot ${found.slot + 1}` : zones[found?.zone] || "table";
}

function deckAction(action, count) {
  const cards = `${count} card${count === 1 ? "" : "s"}`;
  return {
    shuffle: "shuffle the deck", draw: `draw ${cards}`,
    discard: `discard ${cards} from the deck`, oblivion: `send ${cards} from the deck to Oblivion`,
    look: `look at the top ${cards} of the deck`, search: "search the deck",
  }[action];
}

export function appendActivity(room, before, actorId, event, payload, now) {
  if (!before || !room?.started) return;
  const after = activityContext(room, actorId, event, payload);
  if (!after) return;
  // Some handlers accept an unchanged value; these are not new actions.
  if (event !== "game:deckAction" && JSON.stringify(before) === JSON.stringify(after)) return;
  const source = cardLabel(before.source);
  const target = cardLabel(before.target);
  const visibleSource = cardLabel(after.source);
  const request = before.request;
  let text;
  switch (event) {
    case "lobby:startRequest":
      text = `started the match. Both players drew 5 cards.${room.turnRole ? ` ${room[room.turnRole].name} starts.` : " Waiting for a starting player."}`;
      break;
    case "game:chooseStarter": text = room.turnRole ? `agreed that ${room[room.turnRole].name} starts` : `chose ${room[payload].name} as the starting player`; break;
    case "game:endTurn": text = `ended their turn. ${room[room.turnRole].name}'s turn begins`; break;
    case "game:deckAction": text = `performed: ${deckAction(payload.action, payload.action === "look" ? payload.count : before.deckCount - after.deckCount)}`; break;
    case "game:requestDeckAction": text = `requested that the opponent ${deckAction(after.request.action, after.request.count)}`; break;
    case "game:respondDeckAction": text = `${payload.accepted ? "accepted" : "declined"} ${request.fromName}'s request to ${deckAction(request.action, request.count)}`; break;
    case "game:cancelDeckAction": text = `cancelled the request to ${deckAction(request.action, request.count)}`; break;
    case "game:moveCard":
      text = `moved ${before.source.zone === "hand" || before.source.zone === "deck" ? visibleSource : source} from ${location(before.source)} to ${location(after.source)}${after.source.zone === "deck" ? payload.position === "bottom" ? " (bottom)" : " (top)" : ""}`;
      break;
    case "game:playAction": text = `played ${visibleSource}`; break;
    case "game:giveCardControl": text = `gave control of ${source} to ${room[after.source.ownerRole].name}`; break;
    case "game:attachCard": text = `attached ${visibleSource} to ${target}`; break;
    case "game:swapSlotCard": text = `made ${source} the main card in ${location(before.source)}`; break;
    case "game:revealCard": text = payload.revealed ? `revealed ${visibleSource} in hand` : `hid ${source} in hand`; break;
    case "game:flipCard": text = `flipped ${source}`; break;
    case "game:setFaceDown": text = payload.faceDown ? `turned ${source} face down` : `turned ${visibleSource} face up`; break;
    case "game:setFrazzle": text = `set Frazzle on ${source} to ${after.source.card.frazzle}`; break;
    case "game:setStat": text = payload.remove ? `removed ${payload.stat.toUpperCase()} from ${source}` : before.source.card.faceDown ? `updated ${payload.stat.toUpperCase()} on ${source}` : `set ${source}'s ${payload.stat.toUpperCase()} to ${after.source.card[payload.stat]}`; break;
    case "game:adjustCounter": {
      const counters = after.source.card.counters || [];
      const counter = counters.find((entry) => entry.kind === payload.kind && (payload.kind === "emoji" ? entry.emoji === payload.emoji : entry.label.toLowerCase() === String(payload.label).trim().toLowerCase()));
      const previous = before.source.card.counters?.find((entry) => entry.kind === payload.kind && (payload.kind === "emoji" ? entry.emoji === payload.emoji : entry.label.toLowerCase() === String(payload.label).trim().toLowerCase()));
      text = counter ? `set ${counter.label} on ${source} to ${counter.value}` : `removed ${previous?.label || "a counter"} from ${source}`;
      break;
    }
    case "game:updateFragments": {
      const fragments = after.fragments;
      text = `updated Fragments: ${fragments.filter((spent) => !spent).length} ready, ${fragments.filter(Boolean).length} spent`;
      break;
    }
    case "game:setTarget": text = payload.targetUid === null ? `cleared the target of ${source}` : `targeted ${target} with ${source}`; break;
    case "game:attack": text = `attacked ${target} with ${source}`; break;
    case "game:block": text = `blocked ${target} with ${source}`; break;
    default: return;
  }
  room.activitySequence = (room.activitySequence || 0) + 1;
  room.activityLog = [...(room.activityLog || []), {
    id: room.activitySequence, timestamp: now, turn: room.turnNumber || 0,
    actorRole: before.role, actorName: before.name, text,
  }].slice(-MAX_ACTIVITY_ENTRIES);
}
