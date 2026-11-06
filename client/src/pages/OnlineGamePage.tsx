import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type RefObject } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getCardFaces } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import {
  gameConnection,
  type DeckAction,
  type DeckRequest,
  type GameCard,
  type GameCounter,
  type GameTable,
  type GameZone,
  type LobbyPlayerState,
  type LobbyState,
  type RequestedDeckAction,
} from "../services/gameConnection";
import type { Card } from "../types/Card";
import normalCardBack from "../assets/N_Back.png";
import fragmentCard from "../assets/fragment.png";
import ShortcutSettings from "../components/ShortcutSettings";
import { normalizeShortcut, useGameShortcuts } from "./gameShortcuts";
import styles from "./OnlineGamePage.module.scss";

type InspectCard = (card: Card | null) => void;
type ZoneName = "persona" | "graveyard" | "oblivion" | "hand";
type OpenZone = { owner: "self" | "opponent"; name: ZoneName };
type OpenSlot = { owner: "self" | "opponent"; zone: "battle" | "protagonist"; slot?: number };
type ResolvedCard = { gameCard: GameCard; card: Card | null; canFlip: boolean };
type CardDrag = (event: DragEvent<HTMLButtonElement>, card: GameCard) => void;
type CardMenu = (event: MouseEvent<HTMLButtonElement>, card: GameCard, resolvedCard: Card | null, canFlip: boolean) => void;
type CardAttachDrop = (event: DragEvent<HTMLElement>, targetUid: string) => void;
type SlotRailControls = {
  movable: boolean;
  attachingUid: string | null;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachDrop: CardAttachDrop;
  onAttachTarget: (targetUid: string) => void;
};
type CountedDeckAction = "draw" | "discard" | "look" | "oblivion";
type CardStat = "atk" | "hp";
type CounterChoice = Pick<GameCounter, "kind" | "label" | "emoji">;
type CardMenuPanel = CardStat | "counters" | null;
const COUNTER_PRESETS: CounterChoice[] = [
  { kind: "emoji", emoji: "📜", label: "Quest" },
  { kind: "emoji", emoji: "🔮", label: "Omen" },
  { kind: "emoji", emoji: "🛡️", label: "Shield" },
  { kind: "emoji", emoji: "⚙️", label: "Astralia Gear" },
  { kind: "emoji", emoji: "💥", label: "Explosion" },
  { kind: "emoji", emoji: "🏆", label: "Renown" },
  { kind: "emoji", emoji: "🌌", label: "Advent" },
];
const KEYWORD_EMOJIS = [
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
function isSingleEmoji(value: string): boolean {
  return value.length > 0 && value.length <= 32
    && [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length === 1
    && /\p{Extended_Pictographic}/u.test(value);
}
type SlottedCard = { card: GameCard; zone: "battle" | "protagonist"; slot?: number; index: number };
type TargetLink = { sourceUid: string; targetUid: string; expiresAt: number };
type TargetPath = TargetLink & { path: string; startX: number; startY: number };

const COUNTED_DECK_ACTIONS: Array<{ action: CountedDeckAction; label: string }> = [
  { action: "draw", label: "Draw X" },
  { action: "discard", label: "Discard X" },
  { action: "look", label: "Look at top X" },
  { action: "oblivion", label: "Send X to Oblivion" },
];

function describeDeckRequest(request: DeckRequest, deckOwner: "your" | "their"): string {
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

const EMPTY_TABLE: GameTable = {
  hand: [], deck: [], persona: [], graveyard: [], oblivion: [], action: [], battle: [[], [], [], [], []], protagonist: [], fragments: [],
};
const ZONE_NAMES: Record<ZoneName, string> = {
  persona: "Persona", graveyard: "Graveyard", oblivion: "Oblivion", hand: "Hand",
};

function playerTable(player: LobbyPlayerState | null): GameTable {
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

function tableCards(table: GameTable): GameCard[] {
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

function TargetArrows({ links, containerRef }: { links: TargetLink[]; containerRef: RefObject<HTMLDivElement | null> }) {
  const [paths, setPaths] = useState<TargetPath[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    let retry = 0;
    let retryTimer: number | undefined;
    let expiryTimer: number | undefined;

    const update = () => {
      const now = Date.now();
      const activeLinks = links.filter((link) => link.expiresAt > now);
      const bounds = container.getBoundingClientRect();
      const elements = new Map<string, HTMLElement>();
      container.querySelectorAll<HTMLElement>("[data-card-uid]").forEach((element) => {
        const uid = element.dataset.cardUid;
        if (uid && !elements.has(uid)) elements.set(uid, element);
      });

      const nextPaths = activeLinks.flatMap((link) => {
        const source = elements.get(link.sourceUid)?.getBoundingClientRect();
        const target = elements.get(link.targetUid)?.getBoundingClientRect();
        if (!source || !target) return [];

        const sourceX = source.left - bounds.left + source.width / 2;
        const sourceY = source.top - bounds.top + source.height / 2;
        const targetX = target.left - bounds.left + target.width / 2;
        const targetY = target.top - bounds.top + target.height / 2;
        if (link.sourceUid === link.targetUid) {
          const direction = sourceX < bounds.width * .68 ? 1 : -1;
          const edgeX = sourceX + direction * (source.width / 2 + 5);
          const startY = sourceY + source.height * .23;
          const endY = sourceY - source.height * .23;
          const controlX = edgeX + direction * Math.max(58, source.width * .72);
          return [{
            ...link,
            startX: edgeX,
            startY,
            path: `M ${edgeX} ${startY} C ${controlX} ${sourceY + source.height * .52}, ${controlX} ${sourceY - source.height * .52}, ${edgeX} ${endY}`,
          }];
        }
        const deltaX = targetX - sourceX;
        const deltaY = targetY - sourceY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < 1) return [];

        const unitX = deltaX / distance;
        const unitY = deltaY / distance;
        const sourceEdge = Math.min(
          Math.abs(unitX) < .001 ? Infinity : source.width / 2 / Math.abs(unitX),
          Math.abs(unitY) < .001 ? Infinity : source.height / 2 / Math.abs(unitY),
        );
        const targetEdge = Math.min(
          Math.abs(unitX) < .001 ? Infinity : target.width / 2 / Math.abs(unitX),
          Math.abs(unitY) < .001 ? Infinity : target.height / 2 / Math.abs(unitY),
        );
        if (distance < sourceEdge + targetEdge + 28) {
          if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            const direction = Math.sign(deltaX) || 1;
            const startX = sourceX + direction * Math.min(12, source.width * .16);
            const startY = source.top - bounds.top - 5;
            const endX = targetX - direction * Math.min(12, target.width * .16);
            const endY = target.top - bounds.top - 10;
            const controlX = (startX + endX) / 2;
            const controlY = Math.min(startY, endY) - Math.min(62, Math.max(34, distance * .55));
            return [{
              ...link,
              startX,
              startY,
              path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
            }];
          }

          const direction = sourceX < bounds.width * .68 ? 1 : -1;
          const startX = sourceX + direction * (source.width / 2 + 5);
          const startY = sourceY + Math.sign(deltaY) * Math.min(12, source.height * .12);
          const endX = targetX + direction * (target.width / 2 + 10);
          const endY = targetY - Math.sign(deltaY) * Math.min(12, target.height * .12);
          const controlX = Math.max(startX * direction, endX * direction) * direction + direction * 45;
          const controlY = (startY + endY) / 2;
          return [{
            ...link,
            startX,
            startY,
            path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
          }];
        }
        const startX = sourceX + unitX * (sourceEdge + 5);
        const startY = sourceY + unitY * (sourceEdge + 5);
        const endX = targetX - unitX * (targetEdge + 11);
        const endY = targetY - unitY * (targetEdge + 11);
        const bend = Math.min(92, Math.max(28, distance * .16));
        const curveDirection = link.sourceUid < link.targetUid ? 1 : -1;
        const normalX = -unitY * bend * curveDirection;
        const normalY = unitX * bend * curveDirection;
        const controlX = (startX + endX) / 2 + normalX;
        const controlY = (startY + endY) / 2 + normalY;

        return [{
          ...link,
          startX,
          startY,
          path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
        }];
      });

      setSize({ width: container.scrollWidth, height: container.scrollHeight });
      setPaths(nextPaths);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      const nextExpiry = activeLinks.reduce((earliest, link) => Math.min(earliest, link.expiresAt), Infinity);
      if (Number.isFinite(nextExpiry)) expiryTimer = window.setTimeout(scheduleUpdate, Math.max(0, nextExpiry - now + 20));
      if (nextPaths.length < activeLinks.length && retry < 20) {
        retry += 1;
        retryTimer = window.setTimeout(scheduleUpdate, 150);
      }
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    scheduleUpdate();
    return () => {
      window.cancelAnimationFrame(frame);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [containerRef, links]);

  if (paths.length === 0) return null;
  return <svg className={styles.targetArrows} width={size.width} height={size.height} aria-hidden="true">
    <defs>
      <marker id="target-arrow-head" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    {paths.map(({ sourceUid, targetUid, path, startX, startY }) => <g key={`${sourceUid}:${targetUid}`}>
      <path className={styles.targetArrowGlow} d={path} />
      <path className={styles.targetArrow} d={path} markerEnd="url(#target-arrow-head)" />
      <path className={styles.targetArrowFlow} d={path} />
      <circle className={styles.targetArrowOrigin} cx={startX} cy={startY} r="4" />
    </g>)}
  </svg>;
}

function FragmentDock({ fragments, readOnly = false }: { fragments: boolean[]; readOnly?: boolean }) {
  const FRAGMENT_KEYS = useGameShortcuts().fragment;
  const available = fragments.filter((spent) => !spent).length;
  const spent = fragments.length - available;

  return <section className={styles.fragmentDock} data-fragment-dock aria-label={`Fragments, ${available} available and ${spent} spent`}>
    <div className={styles.fragmentHeader}>
      <div>
        <strong>Fragment</strong>
        <span>{available} ready · {spent} spent</span>
      </div>
      {!readOnly && <div className={styles.fragmentControls}>
        <button type="button" onClick={() => gameConnection.updateFragments("remove")} disabled={fragments.length === 0} aria-label="Remove a fragment" title={`Remove a fragment · ${FRAGMENT_KEYS.remove}`}>−</button>
        <button type="button" onClick={() => gameConnection.updateFragments("add")} disabled={fragments.length >= 10} aria-label="Add a fragment" title={`Add a fragment · ${FRAGMENT_KEYS.add}`}>+</button>
        <button type="button" onClick={() => gameConnection.updateFragments("spend")} disabled={available === 0} title={`Spend · ${FRAGMENT_KEYS.spend}`}>Spend</button>
        <button type="button" onClick={() => gameConnection.updateFragments("recover")} disabled={spent === 0} title={`Recover · ${FRAGMENT_KEYS.recover}`}>Recover</button>
        <button type="button" onClick={() => gameConnection.updateFragments("spendAll")} disabled={available === 0} title={`Spend all · ${FRAGMENT_KEYS.spendAll}`}>Spend all</button>
        <button type="button" onClick={() => gameConnection.updateFragments("recoverAll")} disabled={spent === 0} title={`Recover all · ${FRAGMENT_KEYS.recoverAll}`}>Recover all</button>
      </div>}
    </div>
    <div className={styles.fragmentRail}>
      {fragments.map((isSpent, index) => <button
        key={index}
        type="button"
        disabled={readOnly}
        className={isSpent ? styles.spentFragment : ""}
        onClick={() => gameConnection.setFragmentSpent(index, !isSpent)}
        aria-label={`Fragment ${index + 1}, ${isSpent ? "spent" : "available"}${readOnly ? "" : isSpent ? ". Recover it" : ". Spend it"}`}
        title={isSpent ? readOnly ? "Spent" : `Spent · ${FRAGMENT_KEYS[`toggle${index + 1}` as keyof typeof FRAGMENT_KEYS]} to recover` : readOnly ? "Available" : `Available · ${FRAGMENT_KEYS[`toggle${index + 1}` as keyof typeof FRAGMENT_KEYS]} to spend`}
      >
        <img src={fragmentCard} alt="" draggable={false} />
      </button>)}
      {fragments.length === 0 && <span className={styles.fragmentEmpty}>Add a Fragment</span>}
    </div>
  </section>;
}

function findSlottedCard(table: GameTable, uid: string): SlottedCard | undefined {
  for (let slot = 0; slot < table.battle.length; slot += 1) {
    const index = table.battle[slot].findIndex((card) => card.uid === uid);
    if (index !== -1) return { card: table.battle[slot][index], zone: "battle", slot, index };
  }
  const index = table.protagonist.findIndex((card) => card.uid === uid);
  return index === -1 ? undefined : { card: table.protagonist[index], zone: "protagonist", index };
}

function useResolvedCards(items: GameCard[]): ResolvedCard[] {
  const [cards, setCards] = useState<ResolvedCard[]>([]);

  useEffect(() => {
    let active = true;
    setCards([]);
    Promise.all(items.map(async (gameCard) => {
      if (!gameCard.id) return { gameCard, card: null, canFlip: false };
      const { front, back } = await getCardFaces(gameCard.id);
      const card = gameCard.flipped ? back || front : front || back;
      return card ? { gameCard, card, canFlip: Boolean(front && back) } : null;
    })).then((loaded) => {
      if (active) setCards(loaded.filter((entry): entry is ResolvedCard => entry !== null));
    });
    return () => { active = false; };
  }, [items]);

  const currentItems = new Map(items.map((item) => [item.uid, item]));
  return cards.flatMap(({ gameCard, card, canFlip }) => {
    const current = currentItems.get(gameCard.uid);
    return current ? [{ gameCard: current, card, canFlip }] : [];
  });
}

function FrazzleCounter({ uid, value, editable, onAdjust }: {
  uid: string;
  value: number;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  const COUNTER_KEYS = useGameShortcuts().counter;
  if (value < 1) return null;
  const adjust = (delta: -1 | 1) => {
    if (editable) onAdjust(delta);
  };
  return <span
    data-game-counter="frazzle"
    data-counter-uid={uid}
    className={`${styles.frazzleCounter} ${editable ? styles.editableFrazzleCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? `Frazzle ${value}. Left click increases it, right click decreases it.` : `Frazzle ${value}`}
    title={editable ? `Left click or ${COUNTER_KEYS.increase}: +1 Frazzle · Right click or ${COUNTER_KEYS.decrease}: -1 Frazzle` : `Frazzle ${value}`}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      const key = normalizeShortcut(event.nativeEvent);
      if (key === COUNTER_KEYS.increase) { event.preventDefault(); adjust(1); }
      if (key === COUNTER_KEYS.decrease) { event.preventDefault(); adjust(-1); }
    } : undefined}
  >{value}</span>;
}

function StatCounter({ uid, stat, value, editable, onAdjust }: {
  uid: string;
  stat: CardStat;
  value: number;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  const COUNTER_KEYS = useGameShortcuts().counter;
  const label = stat.toUpperCase();
  const adjust = (delta: -1 | 1) => {
    if (editable) onAdjust(delta);
  };
  return <span
    data-game-counter={stat}
    data-counter-uid={uid}
    className={`${styles.statCounter} ${styles[`${stat}Counter`]} ${editable ? styles.editableStatCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? `${label} ${value}. Left click increases it, right click decreases it.` : `${label} ${value}`}
    title={editable ? `Left click or ${COUNTER_KEYS.increase}: +1 ${label} · Right click or ${COUNTER_KEYS.decrease}: -1 ${label}` : `${label} ${value}`}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      const key = normalizeShortcut(event.nativeEvent);
      if (key === COUNTER_KEYS.increase) { event.preventDefault(); adjust(1); }
      if (key === COUNTER_KEYS.decrease) { event.preventDefault(); adjust(-1); }
    } : undefined}
  ><small>{label}</small>{value}</span>;
}

function CustomCounter({ uid, counter, editable, onAdjust }: {
  uid: string;
  counter: GameCounter;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  const COUNTER_KEYS = useGameShortcuts().counter;
  const description = `${counter.label} counter: ${counter.value}`;
  return <span
    data-game-counter="custom"
    data-counter-uid={uid}
    data-counter-kind={counter.kind}
    data-counter-label={counter.label}
    data-counter-emoji={counter.emoji}
    className={`${styles.customCounter} ${editable ? styles.editableCustomCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? `${description}. Left click adds one, right click removes one.` : description}
    title={editable ? `${description} · Left click or ${COUNTER_KEYS.increase} to add · Right click or ${COUNTER_KEYS.decrease} to remove` : description}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); onAdjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); onAdjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      const key = normalizeShortcut(event.nativeEvent);
      if (key === COUNTER_KEYS.increase) { event.preventDefault(); onAdjust(1); }
      if (key === COUNTER_KEYS.decrease) { event.preventDefault(); onAdjust(-1); }
    } : undefined}
  ><span>{counter.emoji || counter.label.slice(0, 3)}</span><b>{counter.value}</b></span>;
}

function CardThumb({ entry, hidden = false, onInspect, onDragStart, onDragEnd, onMenu, onActivate, className = "", style }: {
  entry: ResolvedCard;
  hidden?: boolean;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
  onActivate?: (card: GameCard) => void;
  className?: string;
  style?: CSSProperties;
}) {
  return <button
    className={className}
    style={style}
    type="button"
    data-card-uid={entry.gameCard.uid}
    data-can-flip={entry.canFlip ? "true" : undefined}
    data-is-action={entry.card?.type.toLowerCase() === "action" ? "true" : undefined}
    aria-label={`${hidden || entry.gameCard.faceDown ? "Face-down card" : `Inspect ${entry.card?.name ?? "card"}${entry.gameCard.revealed ? ", revealed" : ""}`}${entry.gameCard.ownerRole ? ", controlled by another player" : ""}`}
    draggable={Boolean(onDragStart)}
    onDragStart={(event) => onDragStart?.(event, entry.gameCard)}
    onDragEnd={onDragEnd}
    onContextMenu={(event) => onMenu?.(event, entry.gameCard, entry.card, entry.canFlip)}
    onMouseEnter={() => onInspect(hidden || entry.gameCard.faceDown ? null : entry.card)}
    onMouseLeave={() => onInspect(null)}
    onFocus={() => onInspect(hidden || entry.gameCard.faceDown ? null : entry.card)}
    onBlur={() => onInspect(null)}
    onClick={() => { if (onActivate) onActivate(entry.gameCard); else onInspect(hidden || entry.gameCard.faceDown ? null : entry.card); }}
  >
    <img
      src={hidden || entry.gameCard.faceDown || !entry.card ? normalCardBack : getCardImagePath(entry.card, "thumb")}
      alt=""
      draggable={false}
    />
    {entry.gameCard.revealed && <span className={styles.revealedBadge}>Shown</span>}
    {entry.gameCard.ownerRole && <span className={styles.controlledBadge}>Controlled</span>}
  </button>;
}

function DeckStack({ count }: { count: number }) {
  if (count === 0) return <span className={styles.emptyText}>Empty</span>;
  return <div className={styles.deckStack} aria-label={`${count} cards`}>
    {[2, 1, 0].map((offset) => <img
      key={offset}
      src={normalCardBack}
      alt="Card back"
      style={{ transform: `translate(${offset * 3}px, ${offset * -3}px)` }}
    />)}
    <b>{count}</b>
  </div>;
}

function DeckZone({ count, local, owner, onDraw, onMenu, onDragOver, onDrop }: {
  count: number;
  local: boolean;
  owner: "self" | "opponent";
  onDraw: () => void;
  onMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return <div
    className={`${styles.zone} ${local ? styles.deckZone : ""}`}
    data-deck-owner={owner}
    role={local ? "button" : undefined}
    tabIndex={local ? 0 : undefined}
    aria-label={local ? `Main deck, ${count} cards. Click to draw one card.` : `Main deck, ${count} cards`}
    onClick={local && count > 0 ? onDraw : undefined}
    onKeyDown={local && count > 0 ? (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onDraw(); }
    } : undefined}
    onContextMenu={onMenu}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <span className={styles.zoneLabel}>Main deck</span>
    <div className={styles.zoneContent}><DeckStack count={count} /></div>
  </div>;
}

function CardStack({ items, spread = false, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  spread?: boolean;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
}) {
  const cards = useResolvedCards(items);
  if (items.length === 0) return <span className={styles.emptyText}>Empty</span>;
  return <div className={styles.publicStack}>
    {cards.map((entry, index) => {
      const progress = cards.length === 1 ? .5 : index / (cards.length - 1);
      return <CardThumb
        key={entry.gameCard.uid}
        entry={entry}
        onInspect={onInspect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMenu={onMenu}
        className={styles.stackCard}
        style={spread
          ? { left: `${progress * 100}%`, transform: `translateX(-${progress * 100}%)`, zIndex: index + 1 }
          : { left: `${Math.min(index, 6) * 7}px`, zIndex: index + 1 }}
      />;
    })}
    <b>{items.length}</b>
  </div>;
}

function CardRail({ items, label, searchQuery, sortByName = false, faceUpUids, slotControls, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  label: string;
  searchQuery?: string;
  sortByName?: boolean;
  faceUpUids?: ReadonlySet<string>;
  slotControls?: SlotRailControls;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
}) {
  const cards = useResolvedCards(items);
  const railRef = useRef<HTMLDivElement>(null);
  const visibleCards = useMemo(() => {
    const query = searchQuery?.trim().toLocaleLowerCase();
    const filtered = query
      ? cards.filter(({ card }) => card && [
        card.name, card.setId, card.type, card.subtype, card.keywords, card.description,
      ].some((value) => value?.toLocaleLowerCase().includes(query)))
      : cards;
    if (!sortByName) return filtered;
    return [...filtered].sort((a, b) =>
      (a.card?.name ?? "").localeCompare(b.card?.name ?? "", undefined, { sensitivity: "base" })
      || (a.card?.setId ?? "").localeCompare(b.card?.setId ?? "", undefined, { sensitivity: "base" }));
  }, [cards, searchQuery, sortByName]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const scrollHorizontally = (event: WheelEvent) => {
      if (rail.scrollWidth <= rail.clientWidth) return;

      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;

      event.preventDefault();
      rail.scrollLeft += delta;
    };

    rail.addEventListener("wheel", scrollHorizontally, { passive: false });
    return () => rail.removeEventListener("wheel", scrollHorizontally);
  }, []);

  return <div ref={railRef} className={`${styles.hand} ${slotControls ? styles.handSlotCards : ""}`} aria-label={label}>
    {faceUpUids && items.length > 0 && <span className={styles.deckEdgeLabel}>Top</span>}
    {visibleCards.map((entry) => slotControls ? <BattleCard
      key={entry.gameCard.uid}
      item={entry.gameCard}
      movable={slotControls.movable}
      menuEnabled={slotControls.movable}
      frazzleEditable={slotControls.movable}
      attachTargetEnabled={slotControls.movable && slotControls.attachingUid !== null && slotControls.attachingUid !== entry.gameCard.uid}
      onInspect={onInspect}
      onDragStart={(event, card) => onDragStart?.(event, card)}
      onDragEnd={() => onDragEnd?.()}
      onMenu={(event, card, resolved, canFlip) => onMenu?.(event, card, resolved, canFlip)}
      onFrazzleAdjust={slotControls.onFrazzleAdjust}
      onStatAdjust={slotControls.onStatAdjust}
      onAttachDrop={slotControls.onAttachDrop}
      onAttachTarget={slotControls.onAttachTarget}
    /> : <CardThumb
      key={entry.gameCard.uid}
      entry={entry}
      hidden={faceUpUids !== undefined && !faceUpUids.has(entry.gameCard.uid)}
      onInspect={onInspect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMenu={onMenu}
    />)}
    {faceUpUids && items.length > 0 && <span className={styles.deckEdgeLabel}>Bottom</span>}
    {items.length === 0 && <span className={styles.emptyText}>Empty</span>}
    {items.length > 0 && cards.length > 0 && visibleCards.length === 0 && <span className={styles.emptyText}>No matches</span>}
  </div>;
}

function ActionStage({ items, local, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  local: boolean;
  onInspect: InspectCard;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
}) {
  const cards = useResolvedCards(items);
  if (items.length === 0) return null;

  return <div className={styles.actionStage} aria-label={`Played actions, ${items.length}`}>
    {cards.map((entry) => <CardThumb
      key={entry.gameCard.uid}
      entry={entry}
      onInspect={onInspect}
      onDragStart={local ? onDragStart : undefined}
      onDragEnd={local ? onDragEnd : undefined}
      onMenu={local ? onMenu : undefined}
      className={styles.actionCard}
    />)}
  </div>;
}

function Zone({ ariaLabel, children, className = "", onDragOver, onDrop, onContextMenu }: {
  ariaLabel: string;
  children?: React.ReactNode;
  className?: string;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  return <div className={`${styles.zone} ${className}`} aria-label={ariaLabel} onDragOver={onDragOver} onDrop={onDrop} onContextMenu={onContextMenu}>
    <div className={styles.zoneContent}>{children}</div>
  </div>;
}

function CardZone({ name, items, movable, onInspect, onOpen, onDragStart, onDragEnd, onMenu, onDragOver, onDrop }: {
  name: ZoneName;
  items: GameCard[];
  movable: boolean;
  onInspect: InspectCard;
  onOpen: () => void;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return <div
    className={`${styles.zone} ${styles.expandableZone}`}
    role="button"
    tabIndex={0}
    aria-label={`Show ${ZONE_NAMES[name]}, ${items.length} cards`}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault(); onOpen();
      }
    }}
    onMouseLeave={() => onInspect(null)}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <span className={styles.zoneLabel}>{ZONE_NAMES[name]}</span>
    <div className={styles.zoneContent}>
      <CardStack
        items={items}
        spread={name === "persona"}
        onInspect={onInspect}
        onDragStart={movable ? onDragStart : undefined}
        onDragEnd={movable ? onDragEnd : undefined}
        onMenu={movable ? onMenu : undefined}
      />
    </div>
  </div>;
}

function PlayerTable({ player, table, opponentSide, readOnly, attachingUid, onInspect, onOpenZone, onOpenSlot, onDrawDeck, onDeckMenu, onCardFrazzleAdjust, onCardStatAdjust, onAttachDrop, onAttachTarget, onDragStart, onDragEnd, onMenu, onDragOver, onDrop }: {
  player: LobbyPlayerState | null;
  table: GameTable;
  opponentSide?: boolean;
  readOnly?: boolean;
  attachingUid: string | null;
  onInspect: InspectCard;
  onOpenZone: (name: ZoneName) => void;
  onOpenSlot: (zone: "battle" | "protagonist", slot?: number) => void;
  onDrawDeck: () => void;
  onDeckMenu: (event: MouseEvent<HTMLDivElement>, owner: "self" | "opponent") => void;
  onCardFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onCardStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachDrop: CardAttachDrop;
  onAttachTarget: (targetUid: string) => void;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, zone: GameZone, slot?: number) => void;
}) {
  const movable = !readOnly && !opponentSide && Boolean(player?.table);
  const readyFragments = table.fragments.filter((spent) => !spent).length;
  const spentFragments = table.fragments.length - readyFragments;
  const protagonistIndex = opponentSide ? 1 : 4;
  // Each battle slot is stored from its owner's point of view. The opponent's
  // grid is rotated by 180 degrees, so logical slots must be rendered in the
  // reverse visual order (slot 0 at the opposite corner, and so on).
  const battleSlots = opponentSide ? [5, 4, 3, 2, 0] : [0, 1, 2, 3, 5];
  const sideZone = (name: ZoneName) => <CardZone
    name={name}
    items={table[name]}
    movable={movable}
    onInspect={onInspect}
    onOpen={() => onOpenZone(name)}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onMenu={onMenu}
    onDragOver={movable ? onDragOver : undefined}
    onDrop={movable ? (event) => onDrop(event, name) : undefined}
  />;

  return <section className={`${styles.tableHalf} ${opponentSide ? styles.opponentHalf : styles.playerHalf}`}>
    <div className={styles.playerBadge}>
      <strong>{player?.name || "Waiting…"}</strong>
      <span>{player?.deckName || "No deck"}</span>
    </div>
    <div className={`${styles.sideZones} ${styles.leftZones}`}>
      {opponentSide ? <>{sideZone("persona")}{sideZone("oblivion")}</> : <>{sideZone("oblivion")}{sideZone("persona")}</>}
    </div>
    <div className={styles.battleGrid}>
      {Array.from({ length: 6 }).map((_, visualIndex) => {
        if (visualIndex === protagonistIndex) return <Zone
          key={visualIndex}
          ariaLabel="Protagonist"
          className={styles.protagonistSlot}
          onDragOver={movable ? onDragOver : undefined}
          onDrop={movable ? (event) => onDrop(event, "protagonist") : undefined}
        >
          <SlotStack
            items={table.protagonist}
            protagonist
            onOpen={() => onOpenSlot("protagonist")}
            movable={movable}
            attachingUid={attachingUid}
            onInspect={onInspect}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMenu={onMenu}
            onFrazzleAdjust={onCardFrazzleAdjust}
            onStatAdjust={onCardStatAdjust}
            onAttachDrop={onAttachDrop}
            onAttachTarget={onAttachTarget}
          />
        </Zone>;
        const slot = battleSlots.indexOf(visualIndex);
        const items = table.battle[slot] ?? [];
        return <Zone
          key={visualIndex}
          ariaLabel="Battle"
          className={styles.battleSlot}
          onDragOver={movable ? onDragOver : undefined}
          onDrop={movable ? (event) => onDrop(event, "battle", slot) : undefined}
        >
          <SlotStack
            items={items}
            onOpen={() => onOpenSlot("battle", slot)}
            movable={movable}
            attachingUid={attachingUid}
            onInspect={onInspect}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMenu={onMenu}
            onFrazzleAdjust={onCardFrazzleAdjust}
            onStatAdjust={onCardStatAdjust}
            onAttachDrop={onAttachDrop}
            onAttachTarget={onAttachTarget}
          />
        </Zone>;
      })}
    </div>
    <div className={`${styles.sideZones} ${styles.rightZones}`}>
      {opponentSide ? <>
        {sideZone("graveyard")}
        <DeckZone count={player?.deckCount ?? table.deck.length} local={false} owner="opponent" onDraw={onDrawDeck} onMenu={(event) => onDeckMenu(event, "opponent")} />
      </> : <>
        <DeckZone
          count={player?.deckCount ?? table.deck.length}
          local={movable}
          owner="self"
          onDraw={onDrawDeck}
          onMenu={(event) => onDeckMenu(event, "self")}
          onDragOver={movable ? onDragOver : undefined}
          onDrop={movable ? (event) => onDrop(event, "deck") : undefined}
        />
        {sideZone("graveyard")}
      </>}
    </div>
    {opponentSide && <button
      type="button"
      className={styles.handLabel}
      aria-label={`Show revealed cards in opponent hand, ${player?.handCount ?? table.hand.length} cards total`}
      onClick={() => onOpenZone("hand")}
    >Hand · {player?.handCount ?? table.hand.length}</button>}
    {opponentSide && <div className={styles.opponentFragmentStatus} aria-label={`Opponent fragments: ${readyFragments} ready and ${spentFragments} spent`}>
      <strong>Fragment</strong><span>{readyFragments} ready · {spentFragments} spent</span>
    </div>}
  </section>;
}

function SlotStack({ items, protagonist = false, movable, attachingUid, onOpen, onInspect, onDragStart, onDragEnd, onMenu, onFrazzleAdjust, onStatAdjust, onAttachDrop, onAttachTarget }: {
  items: GameCard[];
  protagonist?: boolean;
  movable: boolean;
  attachingUid: string | null;
  onOpen: () => void;
  onInspect: InspectCard;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachDrop: CardAttachDrop;
  onAttachTarget: (targetUid: string) => void;
}) {
  if (items.length === 0) return <span className={styles.emptyText}>Empty</span>;

  return <div className={`${styles.slotStack} ${protagonist ? styles.protagonistStack : ""}`}>
    {items.length > 1 && <button
      type="button"
      className={styles.slotViewButton}
      onClick={onOpen}
      aria-label={`Show all ${items.length} cards in this ${protagonist ? "Protagonist" : "Battle"} slot`}
    >Cards · {items.length}</button>}
    <div className={styles.attachedStack} aria-label={`${items.length} cards in stack`}>
      {items.map((item, index) => {
        const subslotCount = items.length - 1;
        const progress = subslotCount <= 1 ? 0 : (index - 1) / (subslotCount - 1);
        const position = index === 0
          ? items.length === 1
            ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: items.length + 1 }
            : { left: "5px", top: "50%", transform: "translateY(-50%)", zIndex: 1 }
          : { left: `calc(${62 + progress * 38}% - ${progress * (protagonist ? 34 : 26)}px)`, top: "50%", transform: "translate(-50%, -50%)", zIndex: index + 1 };
        return <BattleCard
          key={item.uid}
          item={item}
          movable={movable}
          menuEnabled={movable}
          frazzleEditable={movable}
          dropTargetEnabled={movable}
          attachTargetEnabled={movable && attachingUid !== null && attachingUid !== item.uid}
          onInspect={onInspect}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onMenu={onMenu}
          onFrazzleAdjust={onFrazzleAdjust}
          onStatAdjust={onStatAdjust}
          onAttachDrop={onAttachDrop}
          onAttachTarget={onAttachTarget}
          className={index === 0 ? styles.slotMain : styles.attachedCard}
          style={position}
        />;
      })}
    </div>
  </div>;
}

function BattleCard({ item, movable, menuEnabled = movable, frazzleEditable = movable, dropTargetEnabled = false, attachTargetEnabled = false, onInspect, onDragStart, onDragEnd, onMenu, onFrazzleAdjust, onStatAdjust, onAttachDrop, onAttachTarget, className = "", style }: {
  item: GameCard;
  movable: boolean;
  menuEnabled?: boolean;
  frazzleEditable?: boolean;
  dropTargetEnabled?: boolean;
  attachTargetEnabled?: boolean;
  onInspect: InspectCard;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachDrop: CardAttachDrop;
  onAttachTarget: (targetUid: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const items = useMemo(() => [item], [item]);
  const cards = useResolvedCards(items);
  return cards[0] && <div
    className={`${styles.battleCardWrap} ${attachTargetEnabled ? styles.attachTarget : ""} ${className}`}
    style={style}
    onDragOver={dropTargetEnabled ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined}
    onDrop={dropTargetEnabled ? (event) => onAttachDrop(event, item.uid) : undefined}
  >
    <CardThumb
      entry={cards[0]}
      onInspect={onInspect}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={movable ? onDragEnd : undefined}
      onMenu={menuEnabled ? onMenu : undefined}
      onActivate={attachTargetEnabled ? () => onAttachTarget(item.uid) : undefined}
      className={styles.battleCard}
    />
    <FrazzleCounter
      uid={item.uid}
      value={item.frazzle || 0}
      editable={frazzleEditable}
      onAdjust={(delta) => onFrazzleAdjust(item.uid, delta)}
    />
    {!item.faceDown && item.atk !== undefined && <StatCounter
      uid={item.uid}
      stat="atk"
      value={item.atk}
      editable={frazzleEditable}
      onAdjust={(delta) => onStatAdjust(item.uid, "atk", delta)}
    />}
    {!item.faceDown && item.hp !== undefined && <StatCounter
      uid={item.uid}
      stat="hp"
      value={item.hp}
      editable={frazzleEditable}
      onAdjust={(delta) => onStatAdjust(item.uid, "hp", delta)}
    />}
    {Boolean(item.counters?.length) && <div className={`${styles.customCounterList} ${item.revealed ? styles.countersBelowRevealed : ""}`} aria-label="Custom counters">
      {item.counters?.map((counter) => <CustomCounter
        uid={item.uid}
        key={`${counter.kind}:${counter.label.toLocaleLowerCase()}:${counter.emoji || ""}`}
        counter={counter}
        editable={frazzleEditable}
        onAdjust={(delta) => gameConnection.adjustCardCounter(item.uid, counter, delta)}
      />)}
    </div>}
  </div>;
}

function Inspector({ card, onClose }: { card: Card | null; onClose: () => void }) {
  return <aside className={`${styles.inspector} ${card ? styles.inspectorOpen : ""}`} aria-label="Card inspection">
    <div className={styles.inspectorHeader}>
      <h2>Card inspection</h2>
      <button type="button" onClick={onClose} aria-label="Close card inspection">Close</button>
    </div>
    {card ? <div className={styles.inspectorContent}>
      <img src={getCardImagePath(card, "full")} alt={card.name} />
      <h3>{card.name}</h3>
      <p>{[card.type, card.subtype].filter(Boolean).join(" · ")}</p>
      <p>{[
        card.cost && `Cost ${card.cost}`,
        card.atk && `ATK ${card.atk}`,
        card.hp && `HP ${card.hp}`,
      ].filter(Boolean).join(" · ")}</p>
      {card.description && <div className={styles.inspectorDescription}>{card.description}</div>}
      {card.keywords && <p className={styles.inspectorKeywords}>{card.keywords}</p>}
    </div> : <p className={styles.inspectorHint}>Hover over a visible card to inspect it here.</p>}
  </aside>;
}

function ContextMenu({ x, y, initialPanel, revealState, faceDown, statValues, counters, controlLabel, onPlayAction, onAdjustFrazzle, onSetStat, onRemoveStat, onCounterAdjust, onCounterRemove, onSwapWithMain, onStartAttach, onChooseTarget, onClearTarget, onFlip, onToggleFaceDown, onGiveControl, onMove, onToggleReveal, onClose }: {
  x: number;
  y: number;
  initialPanel?: CardMenuPanel;
  revealState?: boolean;
  faceDown?: boolean;
  statValues?: Partial<Record<CardStat, number>>;
  counters?: GameCounter[];
  controlLabel?: string;
  onPlayAction?: () => void;
  onAdjustFrazzle?: (delta: -1 | 1) => void;
  onSetStat?: (stat: CardStat, value: number) => void;
  onRemoveStat?: (stat: CardStat) => void;
  onCounterAdjust?: (counter: CounterChoice, delta: -1 | 1) => void;
  onCounterRemove?: (counter: CounterChoice) => void;
  onSwapWithMain?: () => void;
  onStartAttach?: () => void;
  onChooseTarget?: () => void;
  onClearTarget?: () => void;
  onFlip?: () => void;
  onToggleFaceDown?: () => void;
  onGiveControl?: () => void;
  onMove?: (zone: GameZone, position?: "top" | "bottom") => void;
  onToggleReveal?: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { card: CARD_KEYS, counter: COUNTER_KEYS } = useGameShortcuts();
  const [selectedStat, setSelectedStat] = useState<CardStat | null>(initialPanel === "atk" || initialPanel === "hp" ? initialPanel : null);
  const [showCounters, setShowCounters] = useState(initialPanel === "counters");
  const [counterName, setCounterName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [amount, setAmount] = useState(String(initialPanel === "atk" || initialPanel === "hp" ? statValues?.[initialPanel] ?? 0 : 0));
  const statValue = Number(amount);
  const validStatValue = Number.isInteger(statValue) && statValue >= 0 && statValue <= 999;
  const normalizedCounterName = counterName.trim().replace(/\s+/g, " ");
  const emojiValue = selectedEmoji.trim();
  const validKeywordCounter = normalizedCounterName.length > 0 && normalizedCounterName.length <= 24
    && (!emojiValue || isSingleEmoji(emojiValue));
  const selectStat = (stat: CardStat) => {
    setSelectedStat(stat);
    setAmount(String(statValues?.[stat] ?? 0));
  };
  useEffect(() => { if (showCounters) menuRef.current?.focus(); }, [showCounters]);
  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div ref={menuRef} tabIndex={showCounters ? -1 : undefined} className={`${styles.contextMenu} ${selectedStat || showCounters ? styles.deckMenu : ""}`} role="menu" style={{ left: Math.max(8, Math.min(x, window.innerWidth - 235)), top: Math.max(8, Math.min(y, window.innerHeight - (selectedStat ? 175 : showCounters ? 340 : onMove ? 410 : 150))) }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
    if (!showCounters || event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
    const key = normalizeShortcut(event.nativeEvent);
    const index = Array.from({ length: 7 }, (_, i) => COUNTER_KEYS[`preset${i + 1}` as keyof typeof COUNTER_KEYS]).indexOf(key || "");
    if (index < 0) return;
    event.preventDefault();
    onCounterAdjust?.(COUNTER_PRESETS[index], 1);
  }}>
    {selectedStat ? <form onSubmit={(event) => { event.preventDefault(); if (validStatValue) onSetStat?.(selectedStat, statValue); }}>
      <button type="button" onClick={() => setSelectedStat(null)}>← Actions</button>
      <label htmlFor="card-stat-value">Set {selectedStat.toUpperCase()}</label>
      <input
        id="card-stat-value"
        type="number"
        min={0}
        max={999}
        step={1}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        autoFocus
      />
      <button type="submit" disabled={!validStatValue}>Confirm</button>
    </form> : showCounters ? <div className={styles.counterMenu}>
      <button type="button" onClick={() => setShowCounters(false)}>← Actions</button>
      <small>Premi il tasto mostrato per aggiungere un counter. Su un counter esistente: {COUNTER_KEYS.increase} / {COUNTER_KEYS.decrease} / {COUNTER_KEYS.remove}.</small>
      {Boolean(counters?.length) && <div className={styles.counterMenuCurrent}>
        <strong>On this card</strong>
        {counters?.map((counter) => <div key={`${counter.kind}:${counter.label.toLocaleLowerCase()}:${counter.emoji || ""}`} tabIndex={0} role="group" aria-label={`${counter.label}: ${COUNTER_KEYS.increase} adds one, ${COUNTER_KEYS.decrease} removes one, ${COUNTER_KEYS.remove} removes all`} title={`Focus this counter, then use ${COUNTER_KEYS.increase}, ${COUNTER_KEYS.decrease} or ${COUNTER_KEYS.remove}`} onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const key = normalizeShortcut(event.nativeEvent);
          if (key === COUNTER_KEYS.increase || key === COUNTER_KEYS.decrease) { event.preventDefault(); event.stopPropagation(); onCounterAdjust?.(counter, key === COUNTER_KEYS.increase ? 1 : -1); }
          if (key === COUNTER_KEYS.remove) { event.preventDefault(); event.stopPropagation(); onCounterRemove?.(counter); }
        }}>
          <span title={`${counter.label} counter`}>{counter.emoji || counter.label} · {counter.value}</span>
          <button type="button" aria-label={`Remove one ${counter.label} counter`} onClick={() => onCounterAdjust?.(counter, -1)}>−</button>
          <button type="button" aria-label={`Add one ${counter.label} counter`} onClick={() => onCounterAdjust?.(counter, 1)}>+</button>
          <button type="button" aria-label={`Remove all ${counter.label} counters`} onClick={() => onCounterRemove?.(counter)}>Remove</button>
        </div>)}
      </div>}
      <strong>Game counters</strong>
      <div className={styles.counterChoices}>
        {COUNTER_PRESETS.map((counter, index) => <button
          key={counter.emoji}
          type="button"
          title={`${counter.label} counter`}
          onClick={() => onCounterAdjust?.(counter, 1)}
        >{counter.emoji} {counter.label} <kbd>{COUNTER_KEYS[`preset${index + 1}` as keyof typeof COUNTER_KEYS]}</kbd></button>)}
      </div>
      <strong>Custom keyword counter</strong>
      <div className={styles.keywordEmojiPicker} role="group" aria-label="Choose an emoji for the keyword counter">
        {KEYWORD_EMOJIS.map(({ emoji, label }) => <button
          key={emoji}
          type="button"
          title={`${label} emoji`}
          aria-label={`Choose ${label} emoji`}
          aria-pressed={emojiValue === emoji}
          onClick={() => setSelectedEmoji(emoji)}
        >{emoji}</button>)}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (validKeywordCounter) onCounterAdjust?.({
          kind: emojiValue ? "customEmoji" : "name",
          label: normalizedCounterName,
          ...(emojiValue ? { emoji: emojiValue } : {}),
        }, 1);
      }}>
        <label htmlFor="custom-counter-name">Keyword or counter name</label>
        <input id="custom-counter-name" type="text" maxLength={24} value={counterName} onChange={(event) => setCounterName(event.target.value)} placeholder="e.g. Flying" />
        <label htmlFor="custom-counter-emoji">Emoji (optional)</label>
        <input id="custom-counter-emoji" type="text" maxLength={32} value={selectedEmoji} onChange={(event) => setSelectedEmoji(event.target.value)} placeholder="Select above or enter one emoji" />
        {emojiValue && !isSingleEmoji(emojiValue) && <small role="alert">Enter one emoji only.</small>}
        <button type="submit" disabled={!validKeywordCounter}>Add counter</button>
      </form>
    </div> : <>
    {onAdjustFrazzle && <>
      <button type="button" role="menuitem" onClick={() => onAdjustFrazzle(1)}>Add Frazzle <kbd>{CARD_KEYS.frazzleAdd}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onAdjustFrazzle(-1)}>Remove Frazzle <kbd>{CARD_KEYS.frazzleRemove}</kbd></button>
    </>}
    {onSetStat && <>
      <button type="button" role="menuitem" onClick={() => statValues?.atk !== undefined ? onRemoveStat?.("atk") : selectStat("atk")}>{statValues?.atk !== undefined ? "Remove ATK" : "Set ATK"} <kbd>{CARD_KEYS.atk}</kbd></button>
      <button type="button" role="menuitem" onClick={() => statValues?.hp !== undefined ? onRemoveStat?.("hp") : selectStat("hp")}>{statValues?.hp !== undefined ? "Remove HP" : "Set HP"} <kbd>{CARD_KEYS.hp}</kbd></button>
    </>}
    {onCounterAdjust && <button type="button" role="menuitem" onClick={() => setShowCounters(true)}>Custom counters{counters?.length ? ` · ${counters.length}` : ""}… <kbd>{CARD_KEYS.counters}</kbd></button>}
    {onPlayAction && <button type="button" role="menuitem" onClick={onPlayAction}>Play action <kbd>{CARD_KEYS.play}</kbd></button>}
    {onSwapWithMain && <button type="button" role="menuitem" onClick={onSwapWithMain}>Swap with main card <kbd>{CARD_KEYS.swap}</kbd></button>}
    {onStartAttach && <button type="button" role="menuitem" onClick={onStartAttach}>Attach to... <kbd>{CARD_KEYS.attach}</kbd></button>}
    {onChooseTarget && <button type="button" role="menuitem" onClick={onChooseTarget}>Choose target... <kbd>{CARD_KEYS.target}</kbd></button>}
    {onClearTarget && <button type="button" role="menuitem" onClick={onClearTarget}>Clear target <kbd>{CARD_KEYS.clearTarget}</kbd></button>}
    {onFlip && <button type="button" role="menuitem" onClick={onFlip}>Flip card <kbd>{CARD_KEYS.flip}</kbd></button>}
    {onToggleFaceDown && <button type="button" role="menuitem" onClick={onToggleFaceDown}>{faceDown ? "Turn face up" : "Turn face down"} <kbd>{CARD_KEYS.faceDown}</kbd></button>}
    {onGiveControl && <button type="button" role="menuitem" onClick={onGiveControl}>{controlLabel} <kbd>{CARD_KEYS.control}</kbd></button>}
    {revealState !== undefined && <button type="button" role="menuitem" onClick={onToggleReveal}>{revealState ? "Hide card" : "Reveal card"} <kbd>{CARD_KEYS.reveal}</kbd></button>}
    {onMove && <>
      <hr />
      <button type="button" role="menuitem" onClick={() => onMove("deck", "top")}>Top of deck <kbd>{CARD_KEYS.deckTop}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("deck", "bottom")}>Bottom of deck <kbd>{CARD_KEYS.deckBottom}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("oblivion")}>Oblivion <kbd>{CARD_KEYS.oblivion}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("persona")}>Persona <kbd>{CARD_KEYS.persona}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("hand")}>Hand <kbd>{CARD_KEYS.hand}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("graveyard")}>Graveyard <kbd>{CARD_KEYS.graveyard}</kbd></button>
    </>}
    </>}
  </div>;
}

function DeckContextMenu({ x, y, initialAction, deckCount, requestMode, requestPending, onAction, onLook, onSearch, onClose }: {
  x: number;
  y: number;
  initialAction?: CountedDeckAction | null;
  deckCount: number;
  requestMode: boolean;
  requestPending: boolean;
  onAction: (action: DeckAction, count?: number) => void;
  onLook: (count: number) => void;
  onSearch: () => void;
  onClose: () => void;
}) {
  const [selectedAction, setSelectedAction] = useState<CountedDeckAction | null>(initialAction ?? null);
  const DECK_KEYS = useGameShortcuts().deck;
  const [amount, setAmount] = useState("1");
  const count = Number(amount);
  const validCount = !requestPending && Number.isInteger(count) && count >= 1 && count <= deckCount;
  const submitSelected = () => {
    if (!selectedAction || !validCount) return;
    if (selectedAction === "look") onLook(count);
    else onAction(selectedAction, count);
  };

  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div
    className={`${styles.contextMenu} ${styles.deckMenu}`}
    role="menu"
    style={{ left: Math.max(8, Math.min(x, window.innerWidth - 235)), top: Math.max(8, Math.min(y, window.innerHeight - (selectedAction ? 175 : 325))) }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {selectedAction ? <form onSubmit={(event) => { event.preventDefault(); submitSelected(); }}>
      <button type="button" onClick={() => setSelectedAction(null)}>← Actions</button>
      <label htmlFor="deck-action-count">{requestMode ? "Ask opponent to " : ""}{COUNTED_DECK_ACTIONS.find(({ action }) => action === selectedAction)?.label.toLowerCase()}</label>
      <input
        id="deck-action-count"
        type="number"
        min={1}
        max={deckCount}
        step={1}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        autoFocus
      />
      <button type="submit" disabled={!validCount}>Confirm</button>
    </form> : <>
      <button type="button" role="menuitem" onClick={() => onAction("shuffle")} disabled={deckCount === 0 || requestPending}>{requestMode ? "Ask opponent to shuffle" : "Shuffle"} <kbd>{DECK_KEYS.shuffle}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onAction("draw", 1)} disabled={deckCount === 0 || requestPending}>{requestMode ? "Ask opponent to draw one" : "Draw one card"} <kbd>{DECK_KEYS.drawOne}</kbd></button>
      <hr />
      {COUNTED_DECK_ACTIONS.map(({ action, label }) => <button
        key={action}
        type="button"
        role="menuitem"
        disabled={deckCount === 0 || requestPending}
        onClick={() => setSelectedAction(action)}
      >{requestMode ? `Ask opponent to ${label.toLowerCase()}` : label} <kbd>{DECK_KEYS[action]}</kbd></button>)}
      <hr />
      <button type="button" role="menuitem" disabled={deckCount === 0 || requestPending} onClick={onSearch}>{requestMode ? "Ask opponent to search deck" : "Search deck"} <kbd>{DECK_KEYS.search}</kbd></button>
    </>}
  </div>;
}

export default function OnlineGamePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gameMenuRef = useRef<HTMLDivElement>(null);
  const { card: CARD_KEYS, deck: DECK_KEYS, fragment: FRAGMENT_KEYS, counter: COUNTER_KEYS } = useGameShortcuts();
  const pointerPosition = useRef<{ x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const [searchParams] = useSearchParams();
  const isSpectator = searchParams.get("watch") === "1";
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  const [error, setError] = useState<string | null>(null);
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  const [openZone, setOpenZone] = useState<OpenZone | null>(null);
  const [openSlot, setOpenSlot] = useState<OpenSlot | null>(null);
  const [peekedUids, setPeekedUids] = useState<string[] | null>(null);
  const [deckSearchQuery, setDeckSearchQuery] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ uid: string; x: number; y: number; isAction: boolean; canFlip: boolean; panel?: CardMenuPanel } | null>(null);
  const [deckMenu, setDeckMenu] = useState<{ x: number; y: number; owner: "self" | "opponent"; action?: CountedDeckAction | null } | null>(null);
  const [dismissedDeckResultId, setDismissedDeckResultId] = useState<string | null>(null);
  const [attachingUid, setAttachingUid] = useState<string | null>(null);
  const [targetingUid, setTargetingUid] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggedUid = useRef<string | null>(null);
  const draggedElement = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!gameMenuOpen) return;
    gameMenuRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); setGameMenuOpen(false); }
      if (event.key === "Tab") {
        const controls = [...(gameMenuRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [])];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === gameMenuRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [gameMenuOpen]);

  useEffect(() => {
    const offState = gameConnection.onState(setState);
    const offError = gameConnection.onError(setError);
    if (routeCode) {
      if (isSpectator) gameConnection.watch(routeCode);
      else gameConnection.resume(routeCode);
    }
    else gameConnection.connect();
    return () => { offState(); offError(); };
  }, [routeCode, isSpectator]);
  useEffect(() => {
    if (state.code && routeCode !== state.code) navigate(`/game/${state.code}${isSpectator ? "?watch=1" : ""}`, { replace: true });
  }, [state.code, routeCode, isSpectator, navigate]);

  const myId = gameConnection.getSocketId();
  const me = isSpectator ? state.host : myId ? state.host?.socketId === myId ? state.host : state.guest?.socketId === myId ? state.guest : null : null;
  const opponent = isSpectator ? state.guest : me?.role === "host" ? state.guest : state.host;
  const myTable = useMemo(() => playerTable(me), [me]);
  const opponentTable = useMemo(() => playerTable(opponent), [opponent]);
  const targetLinks = useMemo(() => [...tableCards(myTable), ...tableCards(opponentTable)].flatMap((card) =>
    card.targetUid && card.targetExpiresAt
      ? [{ sourceUid: card.uid, targetUid: card.targetUid, expiresAt: card.targetExpiresAt }]
      : []), [myTable, opponentTable]);
  const openCards = openZone ? (openZone.owner === "self" ? myTable : opponentTable)[openZone.name] : EMPTY_TABLE.hand;
  const slotCards = openSlot
    ? openSlot.zone === "protagonist"
      ? (openSlot.owner === "self" ? myTable : opponentTable).protagonist
      : (openSlot.owner === "self" ? myTable : opponentTable).battle[openSlot.slot ?? 0] ?? []
    : EMPTY_TABLE.hand;
  const ownerLabel = (owner: "self" | "opponent") => isSpectator ? (owner === "self" ? me?.name || "Host" : opponent?.name || "Guest") : owner === "self" ? "Your" : "Opponent";
  const slotLabel = openSlot ? `${ownerLabel(openSlot.owner)} ${openSlot.zone === "protagonist" ? "Protagonist" : `Battle slot ${(openSlot.slot ?? 0) + 1}`}` : "";
  const peekedUidSet = useMemo(() => peekedUids === null ? undefined : new Set(peekedUids), [peekedUids]);
  const railCards = peekedUids !== null || deckSearchQuery !== null ? myTable.deck : openSlot ? slotCards : openZone ? openCards : myTable.hand;
  const railMovable = !isSpectator && Boolean(me?.table) && (!openZone || openZone.owner === "self") && (!openSlot || openSlot.owner === "self");
  useEffect(() => {
    if (isSpectator || !state.started || !me?.table || shortcutSettingsOpen || gameMenuOpen) return;
    const onGameKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"))) return;
      const shortcut = normalizeShortcut(event);
      if (!shortcut) return;
      const pointer = pointerPosition.current;
      const hovered = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
      const counterElement = !menu && !deckMenu && hovered instanceof Element
        ? hovered.closest<HTMLElement>("[data-game-counter]") : null;
      if (counterElement && rootRef.current?.contains(counterElement)) {
        const delta = shortcut === COUNTER_KEYS.increase ? 1
          : shortcut === COUNTER_KEYS.decrease ? -1 : null;
        if (delta !== null) {
          const counterCard = tableCards(myTable).find((item) => item.uid === counterElement.dataset.counterUid);
          if (!counterCard || !findSlottedCard(myTable, counterCard.uid)) return;
          if (counterElement.dataset.gameCounter === "frazzle") gameConnection.adjustCardFrazzle(counterCard.uid, delta);
          else if (counterElement.dataset.gameCounter === "atk" || counterElement.dataset.gameCounter === "hp") {
            gameConnection.adjustCardStat(counterCard.uid, counterElement.dataset.gameCounter, delta);
          } else {
            const current = counterCard.counters?.find((item) => item.kind === counterElement.dataset.counterKind
              && item.label === counterElement.dataset.counterLabel && (item.emoji ?? "") === (counterElement.dataset.counterEmoji ?? ""));
            if (!current) return;
            gameConnection.adjustCardCounter(counterCard.uid, current, delta);
          }
          event.preventDefault();
          return;
        }
        if (shortcut === COUNTER_KEYS.remove && counterElement.dataset.gameCounter === "custom") {
          const counterCard = tableCards(myTable).find((item) => item.uid === counterElement.dataset.counterUid);
          const current = counterCard?.counters?.find((item) => item.kind === counterElement.dataset.counterKind
            && item.label === counterElement.dataset.counterLabel && (item.emoji ?? "") === (counterElement.dataset.counterEmoji ?? ""));
          if (counterCard && current && findSlottedCard(myTable, counterCard.uid)) {
            gameConnection.removeCardCounter(counterCard.uid, current);
            event.preventDefault();
            return;
          }
        }
      }
      const hoveredCard = hovered instanceof Element ? hovered.closest<HTMLElement>("[data-card-uid]")
        ?? (counterElement && rootRef.current
          ? [...rootRef.current.querySelectorAll<HTMLElement>("[data-card-uid]")].find((item) => item.dataset.cardUid === counterElement.dataset.counterUid) ?? null
          : null) : null;
      const focused = document.activeElement;
      const focusedCard = focused instanceof HTMLElement && focused.matches("[data-card-uid]:focus-visible") ? focused : null;
      const menuCardElement = menu && rootRef.current
        ? [...rootRef.current.querySelectorAll<HTMLElement>("[data-card-uid]")].find((item) => item.dataset.cardUid === menu.uid)
        : null;
      const element = menuCardElement ?? (deckMenu ? null : hoveredCard ?? focusedCard);
      const deckElement = deckMenu && rootRef.current
        ? rootRef.current.querySelector<HTMLElement>(`[data-deck-owner="${deckMenu.owner}"]`)
        : hovered instanceof Element ? hovered.closest<HTMLElement>("[data-deck-owner]") : null;
      const fragmentElement = !menu && !deckMenu
        ? hovered instanceof Element ? hovered.closest<HTMLElement>("[data-fragment-dock]")
          : focused instanceof HTMLElement && focused.matches(":focus-visible") ? focused.closest<HTMLElement>("[data-fragment-dock]") : null
        : null;
      if (fragmentElement && rootRef.current?.contains(fragmentElement)) {
        const fragments = myTable.fragments;
        const available = fragments.filter((spent) => !spent).length;
        const spent = fragments.length - available;
        const index = Array.from({ length: 10 }, (_, i) => FRAGMENT_KEYS[`toggle${i + 1}` as keyof typeof FRAGMENT_KEYS]).indexOf(shortcut);
        if (index >= 0 && index < fragments.length) {
          gameConnection.setFragmentSpent(index, !fragments[index]);
        } else if (shortcut === FRAGMENT_KEYS.add && fragments.length < 10) gameConnection.updateFragments("add");
        else if (shortcut === FRAGMENT_KEYS.remove && fragments.length > 0) gameConnection.updateFragments("remove");
        else if (shortcut === FRAGMENT_KEYS.spend && available > 0) gameConnection.updateFragments("spend");
        else if (shortcut === FRAGMENT_KEYS.recover && spent > 0) gameConnection.updateFragments("recover");
        else if (shortcut === FRAGMENT_KEYS.spendAll && available > 0) gameConnection.updateFragments("spendAll");
        else if (shortcut === FRAGMENT_KEYS.recoverAll && spent > 0) gameConnection.updateFragments("recoverAll");
        else return;
        event.preventDefault();
        return;
      }
      if (deckElement && (deckMenu || (!menuCardElement && !hoveredCard)) && rootRef.current?.contains(deckElement)) {
        const owner = deckElement.dataset.deckOwner === "opponent" ? "opponent" : "self";
        const deckCount = owner === "self" ? myTable.deck.length : opponent?.deckCount ?? 0;
        const pending = owner === "opponent" && (Boolean(state.deckRequest) || !opponent?.connected);
        if (deckCount === 0 || pending) return;
        let handled = true;
        let counted: CountedDeckAction | null = null;
        switch (shortcut) {
          case DECK_KEYS.shuffle:
            if (owner === "self") gameConnection.deckAction("shuffle");
            else gameConnection.requestDeckAction("shuffle");
            break;
          case DECK_KEYS.drawOne:
            if (owner === "self") gameConnection.deckAction("draw", 1);
            else gameConnection.requestDeckAction("draw", 1);
            break;
          case DECK_KEYS.draw: counted = "draw"; break;
          case DECK_KEYS.discard: counted = "discard"; break;
          case DECK_KEYS.look: counted = "look"; break;
          case DECK_KEYS.oblivion: counted = "oblivion"; break;
          case DECK_KEYS.search:
            if (owner === "self") {
              setDeckSearchQuery(""); setPeekedUids(null); setOpenZone(null); setOpenSlot(null);
            } else gameConnection.requestDeckAction("search");
            break;
          default: handled = false;
        }
        if (!handled) return;
        event.preventDefault();
        if (counted) {
          const rect = deckElement.getBoundingClientRect();
          setDeckMenu({ owner, x: deckMenu?.x ?? rect.right, y: deckMenu?.y ?? rect.top, action: counted });
        } else {
          setDeckMenu(null);
          if (owner === "self" && shortcut !== DECK_KEYS.search) {
            setOpenZone(null); setOpenSlot(null); setPeekedUids(null); setDeckSearchQuery(null);
          }
        }
        setInspectedCard(null);
        return;
      }
      if (!element || !rootRef.current?.contains(element)) return;
      const uid = element.dataset.cardUid;
      const card = tableCards(myTable).find((item) => item.uid === uid);
      if (!card) return;
      const slotted = findSlottedCard(myTable, card.uid);
      const inHand = myTable.hand.some((item) => item.uid === card.uid);
      const inDeck = myTable.deck.some((item) => item.uid === card.uid);
      const inAction = myTable.action.some((item) => item.uid === card.uid);
      const openPanel = (panel: CardMenuPanel) => {
        const rect = element.getBoundingClientRect();
        setMenu({ uid: card.uid, x: menu?.x ?? rect.right, y: menu?.y ?? rect.top,
          isAction: element.dataset.isAction === "true", canFlip: element.dataset.canFlip === "true", panel });
      };
      let handled = true;
      let keepMenu = false;
      switch (shortcut) {
        case CARD_KEYS.graveyard: gameConnection.moveCard(card.uid, "graveyard"); break;
        case CARD_KEYS.oblivion: gameConnection.moveCard(card.uid, "oblivion"); break;
        case CARD_KEYS.hand: gameConnection.moveCard(card.uid, "hand"); break;
        case CARD_KEYS.persona: gameConnection.moveCard(card.uid, "persona"); break;
        case CARD_KEYS.deckTop: gameConnection.moveCard(card.uid, "deck", { position: "top" }); break;
        case CARD_KEYS.deckBottom: gameConnection.moveCard(card.uid, "deck", { position: "bottom" }); break;
        case CARD_KEYS.frazzleAdd:
        case CARD_KEYS.frazzleRemove:
          if (slotted) gameConnection.adjustCardFrazzle(card.uid, shortcut === CARD_KEYS.frazzleAdd ? 1 : -1);
          else handled = false;
          break;
        case CARD_KEYS.atk:
        case CARD_KEYS.hp: {
          if (!slotted) { handled = false; break; }
          const stat = shortcut === CARD_KEYS.atk ? "atk" : "hp";
          if (slotted.card[stat] !== undefined) gameConnection.removeCardStat(card.uid, stat);
          else { openPanel(stat); keepMenu = true; }
          break;
        }
        case CARD_KEYS.counters:
          if (slotted) { openPanel("counters"); keepMenu = true; }
          else handled = false;
          break;
        case CARD_KEYS.attach:
          if (!inAction && (!slotted || (slotted.index === 0 && !slotted.card.isProtagonist))) {
            setAttachingUid(card.uid); setTargetingUid(null);
          } else handled = false;
          break;
        case CARD_KEYS.control:
          if (slotted && !slotted.card.isProtagonist && opponent?.table) {
            gameConnection.giveCardControl(card.uid); setAttachingUid(null); setTargetingUid(null);
          } else handled = false;
          break;
        case CARD_KEYS.flip:
          if (element.dataset.canFlip === "true") gameConnection.flipCard(card.uid);
          else handled = false;
          break;
        case CARD_KEYS.faceDown:
          if (inHand && shortcut === CARD_KEYS.reveal) gameConnection.setCardRevealed(card.uid, !card.revealed);
          else if (!inHand && !inDeck) gameConnection.setCardFaceDown(card.uid, !card.faceDown);
          else handled = false;
          break;
        case CARD_KEYS.reveal:
          if (inHand) gameConnection.setCardRevealed(card.uid, !card.revealed);
          else handled = false;
          break;
        case CARD_KEYS.target:
          setTargetingUid((current) => current === card.uid ? null : card.uid);
          setAttachingUid(null);
          break;
        case CARD_KEYS.clearTarget:
          if (card.targetUid && (card.targetExpiresAt ?? 0) > Date.now()) gameConnection.setCardTarget(card.uid, null);
          else handled = false;
          break;
        case CARD_KEYS.play:
          if (inHand && element.dataset.isAction === "true") gameConnection.playAction(card.uid);
          else if (shortcut === CARD_KEYS.swap && slotted && slotted.index > 0) gameConnection.swapSlotCard(card.uid);
          else handled = false;
          break;
        case CARD_KEYS.swap:
          if (slotted && slotted.index > 0) gameConnection.swapSlotCard(card.uid);
          else handled = false;
          break;
        default: handled = false;
      }
      if (handled) {
        event.preventDefault();
        if (!keepMenu) setMenu(null);
        setDeckMenu(null);
        setInspectedCard(null);
      }
    };
    window.addEventListener("keydown", onGameKeyDown);
    return () => window.removeEventListener("keydown", onGameKeyDown);
  }, [isSpectator, state.started, me?.table, myTable, opponent, state.deckRequest, menu, deckMenu, CARD_KEYS, DECK_KEYS, FRAGMENT_KEYS, COUNTER_KEYS, shortcutSettingsOpen, gameMenuOpen]);
  const menuCard = menu ? tableCards(myTable).find((card) => card.uid === menu.uid) : undefined;
  const menuHandCard = menu ? myTable.hand.find((card) => card.uid === menu.uid) : undefined;
  const menuDeckCard = menu ? myTable.deck.find((card) => card.uid === menu.uid) : undefined;
  const menuActionCard = menu ? myTable.action.find((card) => card.uid === menu.uid) : undefined;
  const menuSlottedCard = menu ? findSlottedCard(myTable, menu.uid) : undefined;
  const menuCardCanMove = Boolean(menuCard);
  const menuCardCanAttach = !menuActionCard
    && (!menuSlottedCard || (menuSlottedCard.index === 0 && !menuSlottedCard.card.isProtagonist));
  const railTitle = peekedUids !== null ? `Deck · ${myTable.deck.length} cards · ${myTable.deck.filter((card) => peekedUidSet?.has(card.uid)).length} viewed`
    : deckSearchQuery !== null ? `Deck search · ${myTable.deck.length} cards`
      : openSlot ? `${slotLabel} · ${slotCards.length}`
      : openZone?.owner === "opponent" && openZone.name === "hand"
      ? `${ownerLabel("opponent")} hand · ${openCards.length} revealed / ${opponent?.handCount ?? 0}`
      : openZone ? `${ownerLabel(openZone.owner)} ${ZONE_NAMES[openZone.name]} · ${openCards.length}`
        : isSpectator ? `${me?.name || "Host"} hand · ${myTable.hand.length} revealed / ${me?.handCount ?? 0}` : `Hand · ${myTable.hand.length}`;

  const showHand = () => { setOpenZone(null); setOpenSlot(null); setPeekedUids(null); setDeckSearchQuery(null); setInspectedCard(null); };
  const showSlot = (owner: OpenSlot["owner"], zone: OpenSlot["zone"], slot?: number) => {
    setOpenSlot({ owner, zone, slot }); setOpenZone(null); setPeekedUids(null); setDeckSearchQuery(null); setInspectedCard(null);
  };
  useEffect(() => {
    if (openZone?.owner === "opponent" && openZone.name === "hand" && inspectedCard
      && !openCards.some((card) => card.id === inspectedCard.id)) setInspectedCard(null);
  }, [openZone, openCards, inspectedCard]);
  useEffect(() => {
    if (!openZone && !openSlot && peekedUids === null && deckSearchQuery === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpenZone(null); setOpenSlot(null); setPeekedUids(null); setDeckSearchQuery(null); setInspectedCard(null); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openZone, openSlot, peekedUids, deckSearchQuery]);
  useEffect(() => {
    if (!attachingUid) return;
    const cancelAttach = (event: KeyboardEvent) => { if (event.key === "Escape") setAttachingUid(null); };
    window.addEventListener("keydown", cancelAttach);
    return () => window.removeEventListener("keydown", cancelAttach);
  }, [attachingUid]);
  useEffect(() => {
    if (!targetingUid) return;
    const cancelTarget = (event: KeyboardEvent) => { if (event.key === "Escape") setTargetingUid(null); };
    window.addEventListener("keydown", cancelTarget);
    return () => window.removeEventListener("keydown", cancelTarget);
  }, [targetingUid]);
  const startDrag: CardDrag = (event, card) => {
    draggedUid.current = card.uid;
    draggedElement.current = event.currentTarget;
    event.currentTarget.classList.add(styles.draggedCard);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.uid);
    setDragging(true);
    setAttachingUid(null);
    setTargetingUid(null);
    setMenu(null);
  };
  const endDrag = () => {
    draggedElement.current?.classList.remove(styles.draggedCard);
    draggedElement.current = null;
    draggedUid.current = null;
    setDragging(false);
  };
  const dragOver = (event: DragEvent<HTMLElement>) => {
    if (draggedUid.current) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }
  };
  const drop = (event: DragEvent<HTMLElement>, zone: GameZone, slot?: number, position?: "top" | "bottom") => {
    if (isSpectator || !draggedUid.current) return;
    event.preventDefault(); event.stopPropagation();
    gameConnection.moveCard(draggedUid.current, zone, { slot, position });
    endDrag(); setInspectedCard(null);
  };
  const attachCard = (sourceUid: string, targetUid: string) => {
    if (sourceUid === targetUid) return;
    gameConnection.attachCard(sourceUid, targetUid);
    setAttachingUid(null);
    setInspectedCard(null);
  };
  const dropOnCard: CardAttachDrop = (event, targetUid) => {
    const sourceUid = draggedUid.current;
    if (!sourceUid || sourceUid === targetUid) return;
    event.preventDefault(); event.stopPropagation();
    attachCard(sourceUid, targetUid);
    endDrag();
  };
  const selectAttachTarget = (targetUid: string) => {
    if (attachingUid) attachCard(attachingUid, targetUid);
  };
  const selectCardTarget = (targetUid: string) => {
    if (!targetingUid) return;
    gameConnection.setCardTarget(targetingUid, targetUid);
    setTargetingUid(null);
    setInspectedCard(null);
  };
  const showMenu: CardMenu = (event, card, resolvedCard, canFlip) => {
    if (isSpectator) return;
    event.preventDefault(); event.stopPropagation();
    setMenu({ uid: card.uid, x: event.clientX, y: event.clientY, isAction: resolvedCard?.type.toLowerCase() === "action", canFlip });
    setDeckMenu(null);
  };
  const showDeckMenu = (event: MouseEvent<HTMLDivElement>, owner: "self" | "opponent") => {
    event.preventDefault(); event.stopPropagation();
    if (isSpectator) return;
    setDeckMenu({ x: event.clientX, y: event.clientY, owner });
    setMenu(null);
  };
  const deckAction = (action: DeckAction, count?: number) => {
    gameConnection.deckAction(action, count);
    setDeckMenu(null); showHand();
  };
  const requestDeckAction = (action: RequestedDeckAction, count?: number) => {
    gameConnection.requestDeckAction(action, count);
    setDeckMenu(null);
  };
  const drawOne = () => { if (!isSpectator && myTable.deck.length > 0) deckAction("draw", 1); };
  const lookAtTop = (count: number) => {
    setPeekedUids(myTable.deck.slice(0, count).map((card) => card.uid));
    setOpenZone(null); setOpenSlot(null); setDeckSearchQuery(null); setInspectedCard(null); setDeckMenu(null);
  };
  const searchDeck = () => {
    setDeckSearchQuery("");
    setPeekedUids(null); setOpenZone(null); setOpenSlot(null); setInspectedCard(null); setDeckMenu(null);
  };
  const deckRequest = state.deckRequest;
  const incomingDeckRequest = !isSpectator && deckRequest && me && deckRequest.fromRole !== me.role ? deckRequest : null;
  const outgoingDeckRequest = !isSpectator && deckRequest && me && deckRequest.fromRole === me.role ? deckRequest : null;
  const deckRequestResult = !isSpectator && state.deckRequestResult?.id !== dismissedDeckResultId ? state.deckRequestResult : null;
  const canAcceptDeckRequest = Boolean(incomingDeckRequest && myTable.deck.length > 0
    && (incomingDeckRequest.count === null || incomingDeckRequest.count <= myTable.deck.length));
  const respondToDeckRequest = (accepted: boolean) => {
    if (!incomingDeckRequest) return;
    if (accepted && incomingDeckRequest.action === "look") lookAtTop(incomingDeckRequest.count ?? 0);
    if (accepted && incomingDeckRequest.action === "search") searchDeck();
    if (accepted && !["look", "search"].includes(incomingDeckRequest.action)) showHand();
    gameConnection.respondDeckAction(incomingDeckRequest.id, accepted);
  };

  return <div
    ref={rootRef}
    onPointerMove={(event) => { pointerPosition.current = { x: event.clientX, y: event.clientY }; }}
    className={`${styles.root} ${dragging ? styles.dragging : ""} ${targetingUid ? styles.targeting : ""}`}
    onClickCapture={targetingUid ? (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-card-uid]");
      if (!target?.dataset.cardUid) return;
      event.preventDefault();
      event.stopPropagation();
      selectCardTarget(target.dataset.cardUid);
    } : undefined}
  >
    <header className={styles.toolbar}>
      <div><strong>Match {state.code || "—"}</strong><span>{isSpectator ? "Spectating · public cards only" : "Manual table"} · Spectators: {state.spectatorCount ?? 0}</span></div>
      <nav aria-label="Match navigation">
        <button type="button" onClick={() => setGameMenuOpen(true)}>Menu</button>
        <button onClick={() => { gameConnection.leave(); navigate("/"); }}>Leave match</button>
      </nav>
    </header>
    {error && <div className={styles.deckRequestNotice} role="alert">{error}</div>}
    {incomingDeckRequest && <div className={styles.deckRequestNotice} role="dialog" aria-label="Opponent deck request">
      <span><strong>{incomingDeckRequest.fromName}</strong> asks you to {describeDeckRequest(incomingDeckRequest, "your")}.</span>
      <button type="button" onClick={() => respondToDeckRequest(true)} disabled={!canAcceptDeckRequest}>Accept</button>
      <button type="button" onClick={() => respondToDeckRequest(false)}>Decline</button>
    </div>}
    {outgoingDeckRequest && <div className={styles.deckRequestNotice} role="status">
      <span>Waiting for opponent to {describeDeckRequest(outgoingDeckRequest, "their")}.</span>
      <button type="button" onClick={() => gameConnection.cancelDeckAction(outgoingDeckRequest.id)}>Cancel</button>
    </div>}
    {deckRequestResult && <div className={styles.deckRequestNotice} role="status">
      <span>Your request to {describeDeckRequest(deckRequestResult, "their")} was {deckRequestResult.accepted ? "accepted" : "declined"}.</span>
      <button type="button" onClick={() => setDismissedDeckResultId(deckRequestResult.id)}>Dismiss</button>
    </div>}
    <main className={styles.playmat}>
      <PlayerTable
        player={opponent}
        table={opponentTable}
        opponentSide
        attachingUid={null}
        onInspect={setInspectedCard}
        onOpenZone={(name) => { setInspectedCard(null); setPeekedUids(null); setDeckSearchQuery(null); setOpenSlot(null); setOpenZone({ owner: "opponent", name }); }}
        onOpenSlot={(zone, slot) => showSlot("opponent", zone, slot)}
        onDrawDeck={drawOne}
        onDeckMenu={showDeckMenu}
        onCardFrazzleAdjust={(uid, delta) => gameConnection.adjustCardFrazzle(uid, delta)}
        onCardStatAdjust={(uid, stat, delta) => gameConnection.adjustCardStat(uid, stat, delta)}
        onAttachDrop={dropOnCard}
        onAttachTarget={selectAttachTarget}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onMenu={showMenu}
        onDragOver={dragOver}
        onDrop={drop}
      />
      <div className={styles.divider}>
        <span>VS</span>
        <div className={styles.centerActionArea}>
          <ActionStage
            items={opponentTable.action}
            local={false}
            onInspect={setInspectedCard}
            onDragStart={startDrag}
            onDragEnd={endDrag}
            onMenu={showMenu}
          />
          <ActionStage
            items={myTable.action}
            local={!isSpectator && Boolean(me?.table)}
            onInspect={setInspectedCard}
            onDragStart={startDrag}
            onDragEnd={endDrag}
            onMenu={showMenu}
          />
        </div>
      </div>
      <PlayerTable
        player={me}
        table={myTable}
        readOnly={isSpectator}
        attachingUid={attachingUid}
        onInspect={setInspectedCard}
        onOpenZone={(name) => { setInspectedCard(null); setPeekedUids(null); setDeckSearchQuery(null); setOpenSlot(null); setOpenZone({ owner: "self", name }); }}
        onOpenSlot={(zone, slot) => showSlot("self", zone, slot)}
        onDrawDeck={drawOne}
        onDeckMenu={showDeckMenu}
        onCardFrazzleAdjust={(uid, delta) => gameConnection.adjustCardFrazzle(uid, delta)}
        onCardStatAdjust={(uid, stat, delta) => gameConnection.adjustCardStat(uid, stat, delta)}
        onAttachDrop={dropOnCard}
        onAttachTarget={selectAttachTarget}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onMenu={showMenu}
        onDragOver={dragOver}
        onDrop={drop}
      />
      <section className={styles.handDock} aria-label={peekedUids !== null ? "Your deck, viewed cards face up" : deckSearchQuery !== null ? "Cards in your deck" : openSlot ? `${slotLabel} cards` : openZone ? `${ZONE_NAMES[openZone.name]} cards` : isSpectator ? `${me?.name || "Host"} revealed hand` : "Your hand"} onDragOver={isSpectator || openSlot?.owner === "opponent" || openZone?.owner === "opponent" ? undefined : dragOver} onDrop={isSpectator || openSlot?.owner === "opponent" || openZone?.owner === "opponent" ? undefined : (event) => drop(event, peekedUids !== null || deckSearchQuery !== null ? "deck" : openSlot?.zone ?? openZone?.name ?? "hand", openSlot?.slot)}>
        {(openZone || openSlot || peekedUids !== null || deckSearchQuery !== null) && <button className={styles.handDockBack} type="button" onClick={showHand}>← {isSpectator ? "Visible hand" : "Hand"} · {myTable.hand.length}</button>}
        {deckSearchQuery === null && <div className={styles.handDockLabel}>{railTitle}</div>}
        {peekedUids !== null && <div className={styles.deckDropTargets} aria-label="Deck order controls">
          <div onDragOver={dragOver} onDrop={(event) => drop(event, "deck", undefined, "top")}>Drop on top</div>
          <div onDragOver={dragOver} onDrop={(event) => drop(event, "deck", undefined, "bottom")}>Drop on bottom</div>
        </div>}
        {deckSearchQuery !== null && <label className={styles.deckSearchControl}>
          <span>Search Card</span>
          <input
            className={styles.deckSearchInput}
            type="search"
            value={deckSearchQuery}
            onChange={(event) => setDeckSearchQuery(event.target.value)}
            placeholder="Name or card text…"
            autoFocus
          />
        </label>}
        <CardRail
          items={railCards}
          label={peekedUids !== null ? "Your deck from top to bottom, viewed cards face up" : deckSearchQuery !== null ? "Cards in your deck, sorted by name" : openSlot ? `${slotLabel} cards` : openZone ? `${ZONE_NAMES[openZone.name]} cards` : "Your cards"}
          searchQuery={deckSearchQuery ?? undefined}
          sortByName={deckSearchQuery !== null}
          faceUpUids={peekedUidSet}
          slotControls={openSlot ? {
            movable: railMovable,
            attachingUid,
            onFrazzleAdjust: (uid, delta) => gameConnection.adjustCardFrazzle(uid, delta),
            onStatAdjust: (uid, stat, delta) => gameConnection.adjustCardStat(uid, stat, delta),
            onAttachDrop: dropOnCard,
            onAttachTarget: selectAttachTarget,
          } : undefined}
          onInspect={setInspectedCard}
          onDragStart={railMovable ? startDrag : undefined}
          onDragEnd={railMovable ? endDrag : undefined}
          onMenu={railMovable ? showMenu : undefined}
        />
        {peekedUids === null && deckSearchQuery === null && <FragmentDock fragments={myTable.fragments} readOnly={isSpectator} />}
      </section>
    </main>
    {attachingUid && <div className={styles.attachHint} role="status">
      Select a card on your table to attach to
      <button type="button" onClick={() => setAttachingUid(null)}>Cancel</button>
    </div>}
    {targetingUid && <div className={styles.attachHint} role="status">
      Select a card as target
      <button type="button" onClick={() => setTargetingUid(null)}>Cancel</button>
    </div>}
    <TargetArrows links={targetLinks} containerRef={rootRef} />
    <Inspector card={inspectedCard} onClose={() => setInspectedCard(null)} />
    {gameMenuOpen && <div className={styles.gameMenuOverlay} onPointerDown={(event) => { if (event.target === event.currentTarget) setGameMenuOpen(false); }}>
      <div ref={gameMenuRef} className={styles.gameMenuDialog} role="dialog" aria-modal="true" aria-labelledby="game-menu-title" tabIndex={-1}>
        <div className={styles.gameMenuHeader}><h2 id="game-menu-title">Menu</h2><button type="button" onClick={() => setGameMenuOpen(false)} aria-label="Chiudi menu">×</button></div>
        <button type="button" onClick={() => { setGameMenuOpen(false); setShortcutSettingsOpen(true); }}>Comandi da tastiera</button>
        <Link to="/help" target="_blank" rel="noopener noreferrer" onClick={() => setGameMenuOpen(false)}>Guida</Link>
      </div>
    </div>}
    {shortcutSettingsOpen && <ShortcutSettings onClose={() => setShortcutSettingsOpen(false)} />}
    {menu && <ContextMenu
      key={`${menu.uid}:${menu.x}:${menu.y}:${menu.panel ?? "actions"}`}
      x={menu.x}
      y={menu.y}
      initialPanel={menu.panel}
      revealState={menuHandCard ? Boolean(menuHandCard.revealed) : undefined}
      faceDown={Boolean(menuCard?.faceDown)}
      statValues={menuSlottedCard ? { atk: menuSlottedCard.card.atk, hp: menuSlottedCard.card.hp } : undefined}
      counters={menuSlottedCard?.card.counters}
      controlLabel={menuSlottedCard?.card.ownerRole ? "Return control to owner" : "Give control to opponent"}
      onPlayAction={menuHandCard && menu.isAction
        ? () => { gameConnection.playAction(menu.uid); setMenu(null); setInspectedCard(null); }
        : undefined}
      onAdjustFrazzle={menuSlottedCard ? (delta) => { gameConnection.adjustCardFrazzle(menu.uid, delta); setMenu(null); } : undefined}
      onSetStat={menuSlottedCard ? (stat, value) => { gameConnection.setCardStat(menu.uid, stat, value); setMenu(null); } : undefined}
      onRemoveStat={menuSlottedCard ? (stat) => { gameConnection.removeCardStat(menu.uid, stat); setMenu(null); } : undefined}
      onCounterAdjust={menuSlottedCard ? (counter, delta) => { gameConnection.adjustCardCounter(menu.uid, counter, delta); setMenu(null); } : undefined}
      onCounterRemove={menuSlottedCard ? (counter) => { gameConnection.removeCardCounter(menu.uid, counter); setMenu(null); } : undefined}
      onSwapWithMain={menuSlottedCard && menuSlottedCard.index > 0
        ? () => { gameConnection.swapSlotCard(menu.uid); setMenu(null); }
        : undefined}
      onStartAttach={menuCardCanAttach
        ? () => { setAttachingUid(menu.uid); setTargetingUid(null); setMenu(null); }
        : undefined}
      onChooseTarget={() => { setTargetingUid(menu.uid); setAttachingUid(null); setMenu(null); }}
      onClearTarget={menuCard?.targetUid && (menuCard.targetExpiresAt ?? 0) > Date.now()
        ? () => { gameConnection.setCardTarget(menu.uid, null); setMenu(null); }
        : undefined}
      onFlip={menu.canFlip
        ? () => { gameConnection.flipCard(menu.uid); setMenu(null); setInspectedCard(null); }
        : undefined}
      onToggleFaceDown={menuCard && !menuHandCard && !menuDeckCard
        ? () => { gameConnection.setCardFaceDown(menu.uid, !menuCard.faceDown); setMenu(null); setInspectedCard(null); }
        : undefined}
      onGiveControl={menuSlottedCard && !menuSlottedCard.card.isProtagonist && opponent?.table
        ? () => { gameConnection.giveCardControl(menu.uid); setMenu(null); setInspectedCard(null); setAttachingUid(null); setTargetingUid(null); }
        : undefined}
      onMove={menuCardCanMove
        ? (zone, position) => { gameConnection.moveCard(menu.uid, zone, { position }); setMenu(null); setInspectedCard(null); }
        : undefined}
      onToggleReveal={() => {
        if (menuHandCard) gameConnection.setCardRevealed(menu.uid, !menuHandCard.revealed);
        setMenu(null); setInspectedCard(null);
      }}
      onClose={() => setMenu(null)}
    />}
    {deckMenu && <DeckContextMenu
      key={`${deckMenu.owner}:${deckMenu.x}:${deckMenu.y}:${deckMenu.action ?? "actions"}`}
      x={deckMenu.x}
      y={deckMenu.y}
      initialAction={deckMenu.action}
      deckCount={deckMenu.owner === "self" ? myTable.deck.length : opponent?.deckCount ?? 0}
      requestMode={deckMenu.owner === "opponent"}
      requestPending={deckMenu.owner === "opponent" && (Boolean(deckRequest) || !opponent?.connected)}
      onAction={deckMenu.owner === "self" ? deckAction : requestDeckAction}
      onLook={deckMenu.owner === "self" ? lookAtTop : (count) => requestDeckAction("look", count)}
      onSearch={deckMenu.owner === "self" ? searchDeck : () => requestDeckAction("search")}
      onClose={() => setDeckMenu(null)}
    />}
  </div>;
}
