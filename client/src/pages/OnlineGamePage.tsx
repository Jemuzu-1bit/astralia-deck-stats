import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CardDisplay from "../components/CardDisplay";
import { getCardFaces } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import {
  gameConnection,
  type DeckAction,
  type GameCard,
  type GameTable,
  type GameZone,
  type LobbyPlayerState,
  type LobbyState,
} from "../services/gameConnection";
import type { Card } from "../types/Card";
import normalCardBack from "../assets/N_Back.png";
import styles from "./OnlineGamePage.module.scss";

type InspectCard = (card: Card | null) => void;
type ZoneName = "persona" | "graveyard" | "oblivion" | "hand";
type OpenZone = { owner: "self" | "opponent"; name: ZoneName };
type ResolvedCard = { gameCard: GameCard; card: Card };
type CardDrag = (event: DragEvent<HTMLButtonElement>, card: GameCard) => void;
type CardMenu = (event: MouseEvent<HTMLButtonElement>, card: GameCard) => void;
type CountedDeckAction = "draw" | "discard" | "look" | "oblivion";

const COUNTED_DECK_ACTIONS: Array<{ action: CountedDeckAction; label: string }> = [
  { action: "draw", label: "Draw X" },
  { action: "discard", label: "Discard X" },
  { action: "look", label: "Look at top X" },
  { action: "oblivion", label: "Send X to Oblivion" },
];

const EMPTY_TABLE: GameTable = {
  hand: [], deck: [], persona: [], graveyard: [], oblivion: [], battle: [null, null, null, null, null, null], protagonistFrazzle: 0,
};
const ZONE_NAMES: Record<ZoneName, string> = {
  persona: "Persona", graveyard: "Graveyard", oblivion: "Oblivion", hand: "Hand",
};

function playerTable(player: LobbyPlayerState | null): GameTable {
  if (!player) return EMPTY_TABLE;
  if (player.table) return player.table;

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
    battle: [null, null, null, null, null, null],
    protagonistFrazzle: 0,
  };
}

function useResolvedCards(items: GameCard[]): ResolvedCard[] {
  const [cards, setCards] = useState<ResolvedCard[]>([]);

  useEffect(() => {
    let active = true;
    setCards([]);
    Promise.all(items.map(async (gameCard) => {
      const { front, back } = await getCardFaces(gameCard.id);
      const card = front || back;
      return card ? { gameCard, card } : null;
    })).then((loaded) => {
      if (active) setCards(loaded.filter((entry): entry is ResolvedCard => entry !== null));
    });
    return () => { active = false; };
  }, [items]);

  const currentItems = new Map(items.map((item) => [item.uid, item]));
  return cards.flatMap(({ gameCard, card }) => {
    const current = currentItems.get(gameCard.uid);
    return current ? [{ gameCard: current, card }] : [];
  });
}

function FrazzleCounter({ value, editable, onAdjust }: {
  value: number;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  if (value < 1) return null;
  const adjust = (delta: -1 | 1) => {
    if (editable) onAdjust(delta);
  };
  return <span
    className={`${styles.frazzleCounter} ${editable ? styles.editableFrazzleCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? `Frazzle ${value}. Left click increases it, right click decreases it.` : `Frazzle ${value}`}
    title={editable ? "Left click: +1 Frazzle · Right click: -1 Frazzle" : `Frazzle ${value}`}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      if (event.key === "ArrowUp" || event.key === "+") { event.preventDefault(); adjust(1); }
      if (event.key === "ArrowDown" || event.key === "-") { event.preventDefault(); adjust(-1); }
    } : undefined}
  >{value}</span>;
}

function Protagonist({ id, frazzle, covered, movable, onInspect, onFrazzleAdjust }: {
  id?: string | null;
  frazzle: number;
  covered: boolean;
  movable: boolean;
  onInspect: InspectCard;
  onFrazzleAdjust: (delta: -1 | 1) => void;
}) {
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    let active = true;
    setCard(null);
    if (id) getCardFaces(id).then(({ front, back }) => {
      if (active) setCard(front || back || null);
    });
    return () => { active = false; };
  }, [id]);

  return card ? <div
    className={`${styles.protagonistBase} ${covered ? styles.protagonistUnderlay : ""}`}
  >
    <CardDisplay card={card} onInspect={onInspect} />
    <FrazzleCounter value={frazzle} editable={movable} onAdjust={onFrazzleAdjust} />
  </div> : <span className={styles.emptyText}>Protagonist</span>;
}

function CardThumb({ entry, onInspect, onDragStart, onDragEnd, onMenu, className = "", style }: {
  entry: ResolvedCard;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
  className?: string;
  style?: CSSProperties;
}) {
  return <button
    className={className}
    style={style}
    type="button"
    aria-label={`Inspect ${entry.card.name}${entry.gameCard.revealed ? ", revealed" : ""}`}
    draggable={Boolean(onDragStart)}
    onDragStart={(event) => onDragStart?.(event, entry.gameCard)}
    onDragEnd={onDragEnd}
    onContextMenu={(event) => onMenu?.(event, entry.gameCard)}
    onMouseEnter={() => onInspect(entry.card)}
    onMouseLeave={() => onInspect(null)}
    onFocus={() => onInspect(entry.card)}
    onBlur={() => onInspect(null)}
    onClick={() => onInspect(entry.card)}
  >
    <img
      src={getCardImagePath(entry.card, "thumb")}
      alt=""
      draggable={false}
    />
    {entry.gameCard.revealed && <span className={styles.revealedBadge}>Shown</span>}
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

function DeckZone({ count, local, onDraw, onMenu, onDragOver, onDrop }: {
  count: number;
  local: boolean;
  onDraw: () => void;
  onMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return <div
    className={`${styles.zone} ${local ? styles.deckZone : ""}`}
    role={local ? "button" : undefined}
    tabIndex={local ? 0 : undefined}
    aria-label={local ? `Main deck, ${count} cards. Click to draw one card.` : `Main deck, ${count} cards`}
    onClick={local && count > 0 ? onDraw : undefined}
    onKeyDown={local && count > 0 ? (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onDraw(); }
    } : undefined}
    onContextMenu={local ? onMenu : undefined}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <span className={styles.zoneLabel}>Main deck</span>
    <div className={styles.zoneContent}><DeckStack count={count} /></div>
  </div>;
}

function CardStack({ items, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
}) {
  const cards = useResolvedCards(items);
  if (items.length === 0) return <span className={styles.emptyText}>Empty</span>;
  return <div className={styles.publicStack}>
    {cards.map((entry, index) => <CardThumb
      key={entry.gameCard.uid}
      entry={entry}
      onInspect={onInspect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMenu={onMenu}
      className={styles.stackCard}
      style={{ left: `${Math.min(index, 6) * 7}px`, zIndex: index + 1 }}
    />)}
    <b>{items.length}</b>
  </div>;
}

function CardRail({ items, label, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  label: string;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
}) {
  const cards = useResolvedCards(items);
  return <div className={styles.hand} aria-label={label}>
    {cards.map((entry) => <CardThumb
      key={entry.gameCard.uid}
      entry={entry}
      onInspect={onInspect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMenu={onMenu}
    />)}
    {items.length === 0 && <span className={styles.emptyText}>Empty</span>}
  </div>;
}

function Zone({ label, children, className = "", onDragOver, onDrop, onContextMenu }: {
  label: string;
  children?: React.ReactNode;
  className?: string;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  return <div className={`${styles.zone} ${className}`} onDragOver={onDragOver} onDrop={onDrop} onContextMenu={onContextMenu}>
    <span className={styles.zoneLabel}>{label}</span>
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
        onInspect={onInspect}
        onDragStart={movable ? onDragStart : undefined}
        onDragEnd={movable ? onDragEnd : undefined}
        onMenu={movable ? onMenu : undefined}
      />
    </div>
  </div>;
}

function PlayerTable({ player, table, opponentSide, onInspect, onOpenZone, onDrawDeck, onDeckMenu, onProtagonistMenu, onProtagonistFrazzleAdjust, onCardFrazzleAdjust, onDragStart, onDragEnd, onMenu, onDragOver, onDrop }: {
  player: LobbyPlayerState | null;
  table: GameTable;
  opponentSide?: boolean;
  onInspect: InspectCard;
  onOpenZone: (name: ZoneName) => void;
  onDrawDeck: () => void;
  onDeckMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onProtagonistMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onProtagonistFrazzleAdjust: (delta: -1 | 1) => void;
  onCardFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, zone: GameZone, slot?: number) => void;
}) {
  const movable = !opponentSide && Boolean(player?.table);
  const protagonistIndex = opponentSide ? 1 : 4;
  const battleSlots = opponentSide ? [0, 2, 3, 4, 5] : [0, 1, 2, 3, 5];
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
    <div className={styles.sideZones}>
      {opponentSide ? <>{sideZone("persona")}{sideZone("oblivion")}</> : <>{sideZone("oblivion")}{sideZone("persona")}</>}
    </div>
    <div className={styles.battleGrid}>
      {Array.from({ length: 6 }).map((_, visualIndex) => {
        if (visualIndex === protagonistIndex) return <Zone
          key={visualIndex}
          label="Protagonist"
          className={styles.protagonistSlot}
          onDragOver={movable ? onDragOver : undefined}
          onDrop={movable ? (event) => onDrop(event, "battle", 5) : undefined}
          onContextMenu={movable ? onProtagonistMenu : undefined}
        >
          <Protagonist
            id={player?.protagonistId}
            frazzle={table.protagonistFrazzle || 0}
            covered={Boolean(table.battle[5])}
            movable={movable}
            onInspect={onInspect}
            onFrazzleAdjust={onProtagonistFrazzleAdjust}
          />
          {table.battle[5] && <BattleCard item={table.battle[5]} movable={movable} onInspect={onInspect} onDragStart={onDragStart} onDragEnd={onDragEnd} onMenu={onMenu} onFrazzleAdjust={onCardFrazzleAdjust} className={styles.protagonistOverlayCard} />}
        </Zone>;
        const slot = battleSlots.indexOf(visualIndex);
        const item = table.battle[slot];
        return <Zone
          key={visualIndex}
          label="Battle"
          className={styles.battleSlot}
          onDragOver={movable ? onDragOver : undefined}
          onDrop={movable ? (event) => onDrop(event, "battle", slot) : undefined}
        >
          {item && <BattleCard item={item} movable={movable} onInspect={onInspect} onDragStart={onDragStart} onDragEnd={onDragEnd} onMenu={onMenu} onFrazzleAdjust={onCardFrazzleAdjust} />}
        </Zone>;
      })}
    </div>
    <div className={styles.sideZones}>
      {opponentSide ? <>
        {sideZone("graveyard")}
        <DeckZone count={player?.deckCount ?? table.deck.length} local={false} onDraw={onDrawDeck} onMenu={onDeckMenu} />
      </> : <>
        <DeckZone
          count={player?.deckCount ?? table.deck.length}
          local={movable}
          onDraw={onDrawDeck}
          onMenu={onDeckMenu}
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
  </section>;
}

function BattleCard({ item, movable, onInspect, onDragStart, onDragEnd, onMenu, onFrazzleAdjust, className = "" }: {
  item: GameCard;
  movable: boolean;
  onInspect: InspectCard;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  className?: string;
}) {
  const items = useMemo(() => [item], [item]);
  const cards = useResolvedCards(items);
  return cards[0] && <div className={`${styles.battleCardWrap} ${className}`}>
    <CardThumb
      entry={cards[0]}
      onInspect={onInspect}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={movable ? onDragEnd : undefined}
      onMenu={movable ? onMenu : undefined}
      className={styles.battleCard}
    />
    <FrazzleCounter
      value={item.frazzle || 0}
      editable={movable}
      onAdjust={(delta) => onFrazzleAdjust(item.uid, delta)}
    />
  </div>;
}

function Inspector({ card }: { card: Card | null }) {
  return <aside className={styles.inspector} aria-label="Card inspection">
    <h2>Card inspection</h2>
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

function ContextMenu({ x, y, revealState, onSetFrazzle, onMove, onToggleReveal, onClose }: {
  x: number;
  y: number;
  revealState?: boolean;
  onSetFrazzle?: (value: 1 | 2) => void;
  onMove?: (zone: GameZone, position?: "top" | "bottom") => void;
  onToggleReveal?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div className={styles.contextMenu} role="menu" style={{ left: Math.max(8, Math.min(x, window.innerWidth - 215)), top: Math.max(8, Math.min(y, window.innerHeight - (onMove ? 340 : 110))) }} onPointerDown={(event) => event.stopPropagation()}>
    {onSetFrazzle && <>
      <button type="button" role="menuitem" onClick={() => onSetFrazzle(1)}>Add Frazzle 1</button>
      <button type="button" role="menuitem" onClick={() => onSetFrazzle(2)}>Add Frazzle 2</button>
    </>}
    {revealState !== undefined && <button type="button" role="menuitem" onClick={onToggleReveal}>{revealState ? "Hide card" : "Reveal card"}</button>}
    {onMove && <>
      <hr />
      <button type="button" role="menuitem" onClick={() => onMove("deck", "top")}>Top of deck</button>
      <button type="button" role="menuitem" onClick={() => onMove("deck", "bottom")}>Bottom of deck</button>
      <button type="button" role="menuitem" onClick={() => onMove("oblivion")}>Oblivion</button>
      <button type="button" role="menuitem" onClick={() => onMove("persona")}>Persona</button>
      <button type="button" role="menuitem" onClick={() => onMove("hand")}>Hand</button>
      <button type="button" role="menuitem" onClick={() => onMove("graveyard")}>Graveyard</button>
    </>}
  </div>;
}

function DeckContextMenu({ x, y, deckCount, onAction, onLook, onClose }: {
  x: number;
  y: number;
  deckCount: number;
  onAction: (action: DeckAction, count?: number) => void;
  onLook: (count: number) => void;
  onClose: () => void;
}) {
  const [selectedAction, setSelectedAction] = useState<CountedDeckAction | null>(null);
  const [amount, setAmount] = useState("1");
  const count = Number(amount);
  const validCount = Number.isInteger(count) && count >= 1 && count <= deckCount;
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
    style={{ left: Math.max(8, Math.min(x, window.innerWidth - 235)), top: Math.max(8, Math.min(y, window.innerHeight - (selectedAction ? 175 : 285))) }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {selectedAction ? <form onSubmit={(event) => { event.preventDefault(); submitSelected(); }}>
      <button type="button" onClick={() => setSelectedAction(null)}>← Actions</button>
      <label htmlFor="deck-action-count">{COUNTED_DECK_ACTIONS.find(({ action }) => action === selectedAction)?.label}</label>
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
      <button type="button" role="menuitem" onClick={() => onAction("shuffle")} disabled={deckCount === 0}>Shuffle</button>
      <button type="button" role="menuitem" onClick={() => onAction("draw", 1)} disabled={deckCount === 0}>Draw one card</button>
      <hr />
      {COUNTED_DECK_ACTIONS.map(({ action, label }) => <button
        key={action}
        type="button"
        role="menuitem"
        disabled={deckCount === 0}
        onClick={() => setSelectedAction(action)}
      >{label}</button>)}
    </>}
  </div>;
}

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  const [openZone, setOpenZone] = useState<OpenZone | null>(null);
  const [peekedUids, setPeekedUids] = useState<string[] | null>(null);
  const [menu, setMenu] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [deckMenu, setDeckMenu] = useState<{ x: number; y: number } | null>(null);
  const [protagonistMenu, setProtagonistMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggedUid = useRef<string | null>(null);

  useEffect(() => {
    const offState = gameConnection.onState(setState);
    if (routeCode) gameConnection.resume(routeCode);
    else gameConnection.connect();
    return offState;
  }, [routeCode]);
  useEffect(() => {
    if (state.code && routeCode !== state.code) navigate(`/game/${state.code}`, { replace: true });
  }, [state.code, routeCode, navigate]);

  const myId = gameConnection.getSocketId();
  const me = state.host?.socketId === myId ? state.host : state.guest?.socketId === myId ? state.guest : null;
  const opponent = me?.role === "host" ? state.guest : state.host;
  const myTable = useMemo(() => playerTable(me), [me]);
  const opponentTable = useMemo(() => playerTable(opponent), [opponent]);
  const openCards = openZone ? (openZone.owner === "self" ? myTable : opponentTable)[openZone.name] : EMPTY_TABLE.hand;
  const peekCards = useMemo(() => peekedUids === null ? EMPTY_TABLE.hand : myTable.deck.filter((card) => peekedUids.includes(card.uid)), [myTable.deck, peekedUids]);
  const railCards = peekedUids !== null ? peekCards : openZone ? openCards : myTable.hand;
  const railMovable = Boolean(me?.table) && (!openZone || openZone.owner === "self");
  const menuHandCard = menu ? myTable.hand.find((card) => card.uid === menu.uid) : undefined;
  const menuBattleCard = menu ? myTable.battle.find((card) => card?.uid === menu.uid) : undefined;
  const railTitle = peekedUids !== null ? `Top of deck · ${peekCards.length}`
    : openZone?.owner === "opponent" && openZone.name === "hand"
      ? `Opponent hand · ${openCards.length} revealed / ${opponent?.handCount ?? 0}`
      : openZone ? `${openZone.owner === "self" ? "Your" : "Opponent"} ${ZONE_NAMES[openZone.name]} · ${openCards.length}`
        : `Hand · ${myTable.hand.length}`;

  const showHand = () => { setOpenZone(null); setPeekedUids(null); setInspectedCard(null); };
  useEffect(() => {
    if (openZone?.owner === "opponent" && openZone.name === "hand" && inspectedCard
      && !openCards.some((card) => card.id === inspectedCard.id)) setInspectedCard(null);
  }, [openZone, openCards, inspectedCard]);
  useEffect(() => {
    if (!openZone && peekedUids === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpenZone(null); setPeekedUids(null); setInspectedCard(null); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openZone, peekedUids]);
  const startDrag: CardDrag = (event, card) => {
    draggedUid.current = card.uid;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.uid);
    setDragging(true);
    setMenu(null);
  };
  const endDrag = () => { draggedUid.current = null; setDragging(false); };
  const dragOver = (event: DragEvent<HTMLElement>) => {
    if (draggedUid.current) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }
  };
  const drop = (event: DragEvent<HTMLElement>, zone: GameZone, slot?: number) => {
    if (!draggedUid.current) return;
    event.preventDefault(); event.stopPropagation();
    gameConnection.moveCard(draggedUid.current, zone, { slot });
    endDrag(); setInspectedCard(null);
  };
  const showMenu: CardMenu = (event, card) => {
    event.preventDefault(); event.stopPropagation();
    setMenu({ uid: card.uid, x: event.clientX, y: event.clientY });
    setDeckMenu(null);
    setProtagonistMenu(null);
  };
  const showDeckMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    setDeckMenu({ x: event.clientX, y: event.clientY });
    setMenu(null);
    setProtagonistMenu(null);
  };
  const showProtagonistMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    setProtagonistMenu({ x: event.clientX, y: event.clientY });
    setMenu(null); setDeckMenu(null);
  };
  const deckAction = (action: DeckAction, count?: number) => {
    gameConnection.deckAction(action, count);
    setDeckMenu(null); showHand();
  };
  const drawOne = () => { if (myTable.deck.length > 0) deckAction("draw", 1); };
  const lookAtTop = (count: number) => {
    setPeekedUids(myTable.deck.slice(0, count).map((card) => card.uid));
    setOpenZone(null); setInspectedCard(null); setDeckMenu(null);
  };

  return <div className={`${styles.root} ${dragging ? styles.dragging : ""}`}>
    <header className={styles.toolbar}>
      <div><strong>Match {state.code || "—"}</strong><span>Manual table</span></div>
      <button onClick={() => { gameConnection.leave(); navigate("/"); }}>Leave match</button>
    </header>
    <main className={styles.playmat}>
      <PlayerTable
        player={opponent}
        table={opponentTable}
        opponentSide
        onInspect={setInspectedCard}
        onOpenZone={(name) => { setInspectedCard(null); setPeekedUids(null); setOpenZone({ owner: "opponent", name }); }}
        onDrawDeck={drawOne}
        onDeckMenu={showDeckMenu}
        onProtagonistMenu={showProtagonistMenu}
        onProtagonistFrazzleAdjust={(delta) => gameConnection.adjustProtagonistFrazzle(delta)}
        onCardFrazzleAdjust={(uid, delta) => gameConnection.adjustCardFrazzle(uid, delta)}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onMenu={showMenu}
        onDragOver={dragOver}
        onDrop={drop}
      />
      <div className={styles.divider}><span>VS</span></div>
      <PlayerTable
        player={me}
        table={myTable}
        onInspect={setInspectedCard}
        onOpenZone={(name) => { setInspectedCard(null); setPeekedUids(null); setOpenZone({ owner: "self", name }); }}
        onDrawDeck={drawOne}
        onDeckMenu={showDeckMenu}
        onProtagonistMenu={showProtagonistMenu}
        onProtagonistFrazzleAdjust={(delta) => gameConnection.adjustProtagonistFrazzle(delta)}
        onCardFrazzleAdjust={(uid, delta) => gameConnection.adjustCardFrazzle(uid, delta)}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onMenu={showMenu}
        onDragOver={dragOver}
        onDrop={drop}
      />
      <section className={styles.handDock} aria-label={peekedUids !== null ? "Top cards of your deck" : openZone ? `${ZONE_NAMES[openZone.name]} cards` : "Your hand"} onDragOver={dragOver} onDrop={(event) => drop(event, "hand")}>
        {(openZone || peekedUids !== null) && <button className={styles.handDockBack} type="button" onClick={showHand}>← Hand · {myTable.hand.length}</button>}
        <div className={styles.handDockLabel}>{railTitle}</div>
        <CardRail
          items={railCards}
          label={peekedUids !== null ? "Top cards of your deck" : openZone ? `${ZONE_NAMES[openZone.name]} cards` : "Your cards"}
          onInspect={setInspectedCard}
          onDragStart={railMovable ? startDrag : undefined}
          onDragEnd={railMovable ? endDrag : undefined}
          onMenu={railMovable ? showMenu : undefined}
        />
      </section>
    </main>
    <Inspector card={inspectedCard} />
    {menu && <ContextMenu
      x={menu.x}
      y={menu.y}
      revealState={menuHandCard ? Boolean(menuHandCard.revealed) : undefined}
      onSetFrazzle={menuBattleCard ? (value) => { gameConnection.setCardFrazzle(menu.uid, value); setMenu(null); } : undefined}
      onMove={(zone, position) => { gameConnection.moveCard(menu.uid, zone, { position }); setMenu(null); setInspectedCard(null); }}
      onToggleReveal={() => {
        if (menuHandCard) gameConnection.setCardRevealed(menu.uid, !menuHandCard.revealed);
        setMenu(null); setInspectedCard(null);
      }}
      onClose={() => setMenu(null)}
    />}
    {deckMenu && <DeckContextMenu
      x={deckMenu.x}
      y={deckMenu.y}
      deckCount={myTable.deck.length}
      onAction={deckAction}
      onLook={lookAtTop}
      onClose={() => setDeckMenu(null)}
    />}
    {protagonistMenu && <ContextMenu
      x={protagonistMenu.x}
      y={protagonistMenu.y}
      onSetFrazzle={(value) => { gameConnection.setProtagonistFrazzle(value); setProtagonistMenu(null); }}
      onClose={() => setProtagonistMenu(null)}
    />}
  </div>;
}
