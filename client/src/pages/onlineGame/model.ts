import type { DragEvent, MouseEvent } from "react";
import type { Card } from "../../types/Card";
import type { DeckRequest, GameCard, GameCounter, GameTable, GameZone, LobbyPlayerState } from "../../services/gameConnection";

export type InspectCard = (card: Card | null) => void;
export type ZoneName = "persona" | "graveyard" | "oblivion" | "hand";
export type OpenZone = { owner: "self" | "opponent"; name: ZoneName };
export type OpenSlot = { owner: "self" | "opponent"; zone: "battle" | "protagonist"; slot?: number };
export type ResolvedCard = { gameCard: GameCard; card: Card | null; canFlip: boolean };
export type CardDrag = (event: DragEvent<HTMLButtonElement>, card: GameCard) => void;
export type CardMenu = (event: MouseEvent<HTMLButtonElement>, card: GameCard, resolvedCard: Card | null, canFlip: boolean) => void;
export type CardAttachDrop = (event: DragEvent<HTMLElement>, targetUid: string) => void;
export type CombatAction = "attack" | "block";
export type CombatSelection = { uid: string; action: CombatAction };
export type SlotRailControls = {
  movable: boolean;
  attachingUid: string | null;
  combatSelection: CombatSelection | null;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachDrop: CardAttachDrop;
  onAttachTarget: (targetUid: string) => void;
};
export type CountedDeckAction = "draw" | "discard" | "look" | "oblivion";
export type CardStat = "atk" | "hp";
export type CounterChoice = Pick<GameCounter, "kind" | "label" | "emoji">;
export type CardMenuPanel = CardStat | "counters" | null;
export const COUNTER_PRESETS: CounterChoice[] = [
  { kind: "emoji", emoji: "📜", label: "Quest" },
  { kind: "emoji", emoji: "🔮", label: "Omen" },
  { kind: "emoji", emoji: "🛡️", label: "Shield" },
  { kind: "emoji", emoji: "⚙️", label: "Astralia Gear" },
  { kind: "emoji", emoji: "💥", label: "Explosion" },
  { kind: "emoji", emoji: "🏆", label: "Renown" },
  { kind: "emoji", emoji: "🌌", label: "Advent" },
];
export const STATUS_COUNTERS: Array<CounterChoice & { short: string }> = [
  { kind: "status", label: "Barrier", short: "BR" },
  { kind: "status", label: "Assault", short: "AS" },
  { kind: "status", label: "Preemptive Defense", short: "PD" },
  { kind: "status", label: "Preemptive Strike", short: "PS" },
  { kind: "status", label: "Breakthrough", short: "BT" },
  { kind: "status", label: "Rapid Recovery", short: "RR" },
  { kind: "status", label: "Guard", short: "GD" },
];
export const KEYWORD_EMOJIS = [
  { emoji: "🔥", label: "Fire" }, { emoji: "❄️", label: "Freeze" },
  { emoji: "⚡", label: "Energy" }, { emoji: "💀", label: "Death" },
  { emoji: "🩸", label: "Bleeding" }, { emoji: "❤️", label: "Heart" },
  { emoji: "⭐", label: "Star" }, { emoji: "🌙", label: "Moon" },
  { emoji: "☀️", label: "Sun" }, { emoji: "🌿", label: "Nature" },
  { emoji: "🗡️", label: "Sword" }, { emoji: "🏹", label: "Bow" },
  { emoji: "🎯", label: "Target" }, { emoji: "👁️", label: "Eye" },
  { emoji: "🕸️", label: "Web" }, { emoji: "🐉", label: "Dragon" },
  { emoji: "🪽", label: "Wing" }, { emoji: "⏳", label: "Time" },
  { emoji: "🗝️", label: "Key" }, { emoji: "💎", label: "Gem" },
  { emoji: "🧪", label: "Potion" }, { emoji: "🧲", label: "Magnet" },
  { emoji: "🪄", label: "Magic" }, { emoji: "🔒", label: "Lock" },
  { emoji: "🌀", label: "Whirlwind" }, { emoji: "💥", label: "Explosion" },
  { emoji: "⚙️", label: "Gear" }, { emoji: "🛡️", label: "Shield" },
  { emoji: "📜", label: "Scroll" }, { emoji: "🔮", label: "Omen" },
];
export function isSingleEmoji(value: string): boolean {
  return value.length > 0 && value.length <= 32
    && [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length === 1
    && /\p{Extended_Pictographic}/u.test(value);
}
export type SlottedCard = { card: GameCard; zone: "battle" | "protagonist"; slot?: number; index: number };
export type TargetLink = { sourceUid: string; targetUid: string; expiresAt: number; kind: "target" | CombatAction };
export type TargetPath = TargetLink & { path: string; startX: number; startY: number };

export const COUNTED_DECK_ACTIONS: Array<{ action: CountedDeckAction; label: string }> = [
  { action: "draw", label: "Draw X" },
  { action: "discard", label: "Discard X" },
  { action: "look", label: "Look at top X" },
  { action: "oblivion", label: "Send X to Oblivion" },
];

export function describeDeckRequest(request: DeckRequest, deckOwner: "your" | "their"): string {
  const count = request.count ?? 0;
  switch (request.action) {
    case "shuffle": return `shuffle ${deckOwner} deck`;
    case "draw": return `draw ${count} card${count === 1 ? "" : "s"}`;
    case "discard": return `discard ${count} card${count === 1 ? "" : "s"} from the top of ${deckOwner} deck`;
    case "oblivion": return `send ${count} card${count === 1 ? "" : "s"} from the top of ${deckOwner} deck to Oblivion`;
    case "look": return `look at the top ${count} card${count === 1 ? "" : "s"} of ${deckOwner} deck`;
    case "search": return `search ${deckOwner} deck`;
  }
}

export const EMPTY_TABLE: GameTable = {
  hand: [], deck: [], persona: [], graveyard: [], oblivion: [], action: [], battle: [[], [], [], [], []], protagonist: [], fragments: [],
};
export const ZONE_NAMES: Record<ZoneName, string> = {
  persona: "Persona", graveyard: "Graveyard", oblivion: "Oblivion", hand: "Hand",
};

export function playerTable(player: LobbyPlayerState | null): GameTable {
  if (!player) return EMPTY_TABLE;
  if (player.table) return { ...player.table, fragments: player.table.fragments ?? [] };

  const legacyCards = (ids: string[] | null | undefined, zone: GameZone): GameCard[] =>
    (ids || []).map((id, index) => ({ uid: `legacy:${zone}:${index}:${id}`, id, frazzle: 0 }));
  const deckIds = player.deckCards ?? player.mainDeckCards?.flatMap((entry) =>
    Array.from({ length: entry.qty }, () => entry.id));

  return {
    hand: legacyCards(player.handCards, "hand"),
    deck: legacyCards(deckIds, "deck"),
    persona: legacyCards(player.personaCards, "persona"),
    graveyard: legacyCards(player.graveyardCards, "graveyard"),
    oblivion: legacyCards(player.oblivionCards, "oblivion"),
    action: [],
    battle: [[], [], [], [], []],
    protagonist: player.protagonistId
      ? [{ uid: `legacy:protagonist:${player.protagonistId}`, id: player.protagonistId, frazzle: 0, isProtagonist: true }]
      : [],
    fragments: [],
  };
}

export function tableCards(table: GameTable): GameCard[] {
  return [
    ...table.hand,
    ...table.deck,
    ...table.persona,
    ...table.graveyard,
    ...table.oblivion,
    ...table.action,
    ...table.battle.flat(),
    ...table.protagonist,
  ];
}

export function findSlottedCard(table: GameTable, uid: string): SlottedCard | undefined {
  for (let slot = 0; slot < table.battle.length; slot += 1) {
    const index = table.battle[slot].findIndex((card) => card.uid === uid);
    if (index !== -1) return { card: table.battle[slot][index], zone: "battle", slot, index };
  }
  const index = table.protagonist.findIndex((card) => card.uid === uid);
  return index === -1 ? undefined : { card: table.protagonist[index], zone: "protagonist", index };
}
