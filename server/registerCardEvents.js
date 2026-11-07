import { setPrintedStats } from "./cardStats.js";
import { CARD_ZONES, findCard, removeFoundCard, syncCardLists } from "./gameTable.js";
import { STATUS_COUNTERS, COUNTER_EMOJIS, validCounterEmoji } from "./counterValidation.js";

export function registerCardEvents(socket, { currentRoom, currentPlayer, emitState, showTargetArrow }) {
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
    if (kind !== "emoji" && kind !== "name" && kind !== "customEmoji" && kind !== "status") return;
    const emoji = kind === "name" || kind === "status" ? undefined : payload?.emoji;
    if (kind === "emoji" && !COUNTER_EMOJIS.has(emoji)) return;
    if (kind === "customEmoji" && !validCounterEmoji(emoji)) return;
    const label = kind === "status" ? STATUS_COUNTERS.get(String(payload?.label || "").trim().toLocaleLowerCase())
      : kind === "emoji" ? COUNTER_EMOJIS.get(emoji)
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
      if (payload.delta !== 1 || (kind === "status" ? counters.length >= 15 : counters.filter((counter) => counter.kind !== "status").length >= 8)) return;
      counters.push({ kind, label, ...(emoji ? { emoji } : {}), value: 1 });
    } else {
      if (kind === "status" && payload.delta === 1) return;
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
      delete source.card.targetKind;
      delete source.card.targetExpiresAt;
    }
    else {
      const targetUid = String(payload?.targetUid || "");
      if (!targetUid) return;
      const target = [room.host, room.guest]
        .map((candidate) => candidate?.table ? findCard(candidate.table, targetUid) : null)
        .find(Boolean);
      if (!target) return;
      showTargetArrow(room, source.card, targetUid, "target");
    }
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:attack", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const opponent = player.role === "host" ? room.guest : room.host;
    if (!opponent?.table) return;
    const source = findCard(player.table, String(payload?.uid || ""));
    const target = findCard(opponent.table, String(payload?.targetUid || ""));
    if (!source?.slotted || !target?.slotted || source.card.faceDown || target.card.faceDown
      || (Number(source.card.frazzle) || 0) >= 1) return;

    const assault = source.card.counters?.some((counter) => counter.kind === "status" && counter.label === "Assault");
    const amount = assault || target.zone === "protagonist" ? 1 : 2;
    source.card.frazzle = Math.min(2, (Number(source.card.frazzle) || 0) + amount);
    showTargetArrow(room, source.card, target.card.uid, "attack");
    room.lastActivity = Date.now(); emitState(room);
  });
  socket.on("game:block", (payload) => {
    const room = currentRoom(socket); const player = currentPlayer(socket, room);
    if (!player?.table || !room.started) return;
    const opponent = player.role === "host" ? room.guest : room.host;
    if (!opponent?.table) return;
    const source = findCard(player.table, String(payload?.uid || ""));
    const target = findCard(opponent.table, String(payload?.targetUid || ""));
    if (!source?.slotted || !target?.slotted || source.card.faceDown || target.card.faceDown
      || (Number(source.card.frazzle) || 0) >= 1) return;

    const guard = source.card.counters?.some((counter) => counter.kind === "status" && counter.label === "Guard");
    if (!guard) source.card.frazzle = Math.min(2, (Number(source.card.frazzle) || 0) + 1);
    showTargetArrow(room, source.card, target.card.uid, "block");
    room.lastActivity = Date.now(); emitState(room);
  });
}
