import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import CardDisplay from "../components/CardDisplay";
import { getCardFaces } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import {
  gameConnection,
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
type ZoneName = "persona" | "graveyard" | "oblivion";
type OpenZone = { owner: "self" | "opponent"; name: ZoneName };
type ResolvedCard = { gameCard: GameCard; card: Card };
type CardDrag = (event: DragEvent<HTMLButtonElement>, card: GameCard) => void;
type CardMenu = (event: MouseEvent<HTMLButtonElement>, card: GameCard) => void;

const EMPTY_TABLE: GameTable = {
  hand: [], deck: [], persona: [], graveyard: [], oblivion: [], battle: [null, null, null, null, null],
};
const ZONE_NAMES: Record<ZoneName, string> = {
  persona: "Persona", graveyard: "Graveyard", oblivion: "Oblivion",
};

function playerTable(player: LobbyPlayerState | null): GameTable {
  if (!player) return EMPTY_TABLE;
  if (player.table) return player.table;

  const legacyCards = (ids: string[] | null | undefined, zone: GameZone): GameCard[] =>
    (ids || []).map((id, index) => ({ uid: `legacy:${zone}:${index}:${id}`, id, rotation: 0 }));
  const deckIds = player.deckCards ?? player.mainDeckCards?.flatMap((entry) =>
    Array.from({ length: entry.qty }, () => entry.id));

  return {
    hand: legacyCards(player.handCards, "hand"),
    deck: legacyCards(deckIds, "deck"),
    persona: legacyCards(player.personaCards, "persona"),
    graveyard: legacyCards(player.graveyardCards, "graveyard"),
    oblivion: legacyCards(player.oblivionCards, "oblivion"),
    battle: [null, null, null, null, null],
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

  return cards;
}

function Protagonist({ id, onInspect }: { id?: string | null; onInspect: InspectCard }) {
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    let active = true;
    setCard(null);
    if (id) getCardFaces(id).then(({ front, back }) => {
      if (active) setCard(front || back || null);
    });
    return () => { active = false; };
  }, [id]);

  return card ? <CardDisplay card={card} onInspect={onInspect} /> : <span className={styles.emptyText}>Protagonist</span>;
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
    aria-label={`Inspect ${entry.card.name}`}
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
      style={{ transform: `rotate(${entry.gameCard.rotation}deg)` }}
    />
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

function Zone({ label, children, className = "", onDragOver, onDrop }: {
  label: string;
  children?: React.ReactNode;
  className?: string;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return <div className={`${styles.zone} ${className}`} onDragOver={onDragOver} onDrop={onDrop}>
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

function PlayerTable({ player, table, opponentSide, onInspect, onOpenZone, onDragStart, onDragEnd, onMenu, onDragOver, onDrop }: {
  player: LobbyPlayerState | null;
  table: GameTable;
  opponentSide?: boolean;
  onInspect: InspectCard;
  onOpenZone: (name: ZoneName) => void;
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
        if (visualIndex === protagonistIndex) return <Zone key={visualIndex} label="Protagonist" className={styles.protagonistSlot}>
          <Protagonist id={player?.protagonistId} onInspect={onInspect} />
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
          {item && <BattleCard item={item} movable={movable} onInspect={onInspect} onDragStart={onDragStart} onDragEnd={onDragEnd} onMenu={onMenu} />}
        </Zone>;
      })}
    </div>
    <div className={styles.sideZones}>
      {opponentSide ? <>
        {sideZone("graveyard")}
        <Zone label="Main deck"><DeckStack count={table.deck.length} /></Zone>
      </> : <>
        <Zone label="Main deck" onDragOver={movable ? onDragOver : undefined} onDrop={movable ? (event) => onDrop(event, "deck") : undefined}><DeckStack count={table.deck.length} /></Zone>
        {sideZone("graveyard")}
      </>}
    </div>
    {opponentSide && <div className={styles.handLabel}>Hand · {table.hand.length}</div>}
  </section>;
}

function BattleCard({ item, movable, onInspect, onDragStart, onDragEnd, onMenu }: {
  item: GameCard;
  movable: boolean;
  onInspect: InspectCard;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
}) {
  const items = useMemo(() => [item], [item]);
  const cards = useResolvedCards(items);
  return cards[0] && <CardThumb
    entry={cards[0]}
    onInspect={onInspect}
    onDragStart={movable ? onDragStart : undefined}
    onDragEnd={movable ? onDragEnd : undefined}
    onMenu={movable ? onMenu : undefined}
    className={styles.battleCard}
  />;
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

function ContextMenu({ x, y, onRotate, onMove, onClose }: {
  x: number;
  y: number;
  onRotate: (degrees: 90 | 180) => void;
  onMove: (zone: GameZone, position?: "top" | "bottom") => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div className={styles.contextMenu} role="menu" style={{ left: Math.max(8, Math.min(x, window.innerWidth - 215)), top: Math.max(8, Math.min(y, window.innerHeight - 340)) }} onPointerDown={(event) => event.stopPropagation()}>
    <button type="button" role="menuitem" onClick={() => onRotate(90)}>Rotate 90°</button>
    <button type="button" role="menuitem" onClick={() => onRotate(180)}>Rotate 180°</button>
    <hr />
    <button type="button" role="menuitem" onClick={() => onMove("deck", "top")}>Top of deck</button>
    <button type="button" role="menuitem" onClick={() => onMove("deck", "bottom")}>Bottom of deck</button>
    <button type="button" role="menuitem" onClick={() => onMove("oblivion")}>Oblivion</button>
    <button type="button" role="menuitem" onClick={() => onMove("persona")}>Persona</button>
    <button type="button" role="menuitem" onClick={() => onMove("hand")}>Hand</button>
    <button type="button" role="menuitem" onClick={() => onMove("graveyard")}>Graveyard</button>
  </div>;
}

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  const [openZone, setOpenZone] = useState<OpenZone | null>(null);
  const [menu, setMenu] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggedUid = useRef<string | null>(null);

  useEffect(() => gameConnection.onState(setState), []);

  const myId = gameConnection.getSocketId();
  const me = state.host?.socketId === myId ? state.host : state.guest?.socketId === myId ? state.guest : null;
  const opponent = me?.role === "host" ? state.guest : state.host;
  const myTable = useMemo(() => playerTable(me), [me]);
  const opponentTable = useMemo(() => playerTable(opponent), [opponent]);
  const openCards = openZone ? (openZone.owner === "self" ? myTable : opponentTable)[openZone.name] : EMPTY_TABLE.hand;
  const railCards = openZone ? openCards : myTable.hand;
  const railMovable = Boolean(me?.table) && (!openZone || openZone.owner === "self");

  const closeZone = () => { setOpenZone(null); setInspectedCard(null); };
  useEffect(() => {
    if (!openZone) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpenZone(null); setInspectedCard(null); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openZone]);
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
        onOpenZone={(name) => { setInspectedCard(null); setOpenZone({ owner: "opponent", name }); }}
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
        onOpenZone={(name) => { setInspectedCard(null); setOpenZone({ owner: "self", name }); }}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onMenu={showMenu}
        onDragOver={dragOver}
        onDrop={drop}
      />
      <section className={styles.handDock} aria-label={openZone ? `${ZONE_NAMES[openZone.name]} cards` : "Your hand"} onDragOver={dragOver} onDrop={(event) => drop(event, "hand")}>
        {openZone && <button className={styles.handDockBack} type="button" onClick={closeZone}>← Hand · {myTable.hand.length}</button>}
        <div className={styles.handDockLabel}>
          {openZone ? `${openZone.owner === "self" ? "Your" : "Opponent"} ${ZONE_NAMES[openZone.name]} · ${openCards.length}` : `Hand · ${myTable.hand.length}`}
        </div>
        <CardRail
          items={railCards}
          label={openZone ? `${ZONE_NAMES[openZone.name]} cards` : "Your cards"}
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
      onRotate={(degrees) => { gameConnection.rotateCard(menu.uid, degrees); setMenu(null); }}
      onMove={(zone, position) => { gameConnection.moveCard(menu.uid, zone, { position }); setMenu(null); setInspectedCard(null); }}
      onClose={() => setMenu(null)}
    />}
  </div>;
}
