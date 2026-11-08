import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { gameConnection, type DeckAction, type GameZone, type LobbyState, type RequestedDeckAction } from "../services/gameConnection";
import type { Card } from "../types/Card";
import ShortcutSettings from "../components/ShortcutSettings";
import FeedbackLink from "../components/FeedbackLink";
import SettingsMenu from "../components/SettingsMenu";
import { INTERFACE_SIZE_CHANGE_EVENT, savedInterfaceSize } from "../services/gameInterfaceSize";
import { useGameShortcuts } from "./gameShortcuts";
import { useGameKeyboardShortcuts } from "./onlineGame/useGameKeyboardShortcuts";
import { EMPTY_TABLE, ZONE_NAMES, describeDeckRequest, findSlottedCard, playerTable, tableCards, type CardAttachDrop, type CardDrag, type CardMenu, type CardMenuPanel, type CombatSelection, type CountedDeckAction, type OpenSlot, type OpenZone } from "./onlineGame/model";
import { TargetArrows } from "./onlineGame/TargetArrows";
import { ActionStage } from "./onlineGame/CardElements";
import { CardRail } from "./onlineGame/CardRail";
import { FragmentDock } from "./onlineGame/CardIndicators";
import { PlayerTable } from "./onlineGame/PlayerTable";
import { ContextMenu, DeckContextMenu, Inspector } from "./onlineGame/GameMenus";
import styles from "./OnlineGamePage.module.scss";

const TURN_COLORS: Record<string, string> = {
  red: "#e64a4a", blue: "#3a8ee6", green: "#34c47a", purple: "#7b72f1", pink: "#e676ad",
};

export default function OnlineGamePage() {
  const rootRef = useRef<HTMLDivElement>(null);
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
  const [interfaceSize, setInterfaceSize] = useState(savedInterfaceSize);
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
  const [combatSelection, setCombatSelection] = useState<CombatSelection | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggedUid = useRef<string | null>(null);
  const draggedElement = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const previousFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = `${interfaceSize}%`;
    return () => { document.documentElement.style.fontSize = previousFontSize; };
  }, [interfaceSize]);

  useEffect(() => {
    const onInterfaceSizeChange = (event: Event) => setInterfaceSize((event as CustomEvent<number>).detail);
    window.addEventListener(INTERFACE_SIZE_CHANGE_EVENT, onInterfaceSizeChange);
    return () => window.removeEventListener(INTERFACE_SIZE_CHANGE_EVENT, onInterfaceSizeChange);
  }, []);

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
  const activePlayer = state.turnRole === "host" ? state.host : state.turnRole === "guest" ? state.guest : null;
  const activeOnTop = Boolean(activePlayer && activePlayer.role === opponent?.role);
  const turnColor = TURN_COLORS[activePlayer?.faction?.toLowerCase() ?? ""] ?? "#d4af37";
  const myVote = !isSpectator && me ? state.startVotes?.[me.role] : null;
  const opponentVote = !isSpectator && opponent ? state.startVotes?.[opponent.role] : null;
  const myTable = useMemo(() => playerTable(me), [me]);
  const opponentTable = useMemo(() => playerTable(opponent), [opponent]);
  const targetLinks = useMemo(() => [...tableCards(myTable), ...tableCards(opponentTable)].flatMap((card) =>
    card.targetUid && card.targetExpiresAt
      ? [{ sourceUid: card.uid, targetUid: card.targetUid, expiresAt: card.targetExpiresAt, kind: card.targetKind ?? "target" }]
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
  useGameKeyboardShortcuts({ rootRef, pointerPosition, isSpectator, state, me, opponent, myTable, menu, deckMenu, CARD_KEYS, DECK_KEYS, FRAGMENT_KEYS, COUNTER_KEYS, shortcutSettingsOpen, gameMenuOpen, setMenu, setDeckMenu, setOpenZone, setOpenSlot, setPeekedUids, setDeckSearchQuery, setInspectedCard, setAttachingUid, setTargetingUid, setCombatSelection });
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
  useEffect(() => {
    if (!combatSelection) return;
    const cancelCombat = (event: KeyboardEvent) => { if (event.key === "Escape") setCombatSelection(null); };
    window.addEventListener("keydown", cancelCombat);
    return () => window.removeEventListener("keydown", cancelCombat);
  }, [combatSelection]);
  useEffect(() => {
    if (!combatSelection) return;
    const source = findSlottedCard(myTable, combatSelection.uid);
    if (!source || source.card.faceDown || (source.card.frazzle || 0) >= 1) setCombatSelection(null);
  }, [combatSelection, myTable]);
  const startDrag: CardDrag = (event, card) => {
    draggedUid.current = card.uid;
    draggedElement.current = event.currentTarget;
    event.currentTarget.classList.add(styles.draggedCard);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.uid);
    setDragging(true);
    setAttachingUid(null);
    setTargetingUid(null);
    setCombatSelection(null);
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
    setCombatSelection(null);
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
    style={{ "--ui-scale": interfaceSize / 100 } as CSSProperties}
    onPointerMove={(event) => { pointerPosition.current = { x: event.clientX, y: event.clientY }; }}
    className={`${styles.root} ${dragging ? styles.dragging : ""} ${targetingUid || combatSelection ? styles.targeting : ""}`}
    onClickCapture={(event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-card-uid]");
      if (!target?.dataset.cardUid) {
        if (combatSelection) setCombatSelection(null);
        return;
      }
      if (targetingUid) {
        event.preventDefault(); event.stopPropagation();
        selectCardTarget(target.dataset.cardUid);
        return;
      }
      if (isSpectator || attachingUid || dragging || (event.target as HTMLElement).closest("[data-game-counter]")) return;
      const uid = target.dataset.cardUid;
      if (combatSelection && target.closest(`.${styles.opponentHalf}`) && findSlottedCard(opponentTable, uid)) {
        event.preventDefault(); event.stopPropagation();
        if (combatSelection.action === "attack") gameConnection.attackCard(combatSelection.uid, uid);
        else gameConnection.blockCard(combatSelection.uid, uid);
        setCombatSelection(null);
        setInspectedCard(null);
        return;
      }
      const source = findSlottedCard(myTable, uid);
      if (!source || source.card.faceDown || !target.closest(`.${styles.playerHalf}`)) return;
      if (event.detail === 0) return;
      const rect = target.getBoundingClientRect();
      const position = (event.clientY - rect.top) / rect.height;
      const action = position < .25 ? "attack" : position >= .75 ? "block" : null;
      if (!action || (source.card.frazzle || 0) >= 1) return;
      event.preventDefault(); event.stopPropagation();
      setCombatSelection(combatSelection?.uid === uid && combatSelection.action === action ? null : { uid, action });
      setTargetingUid(null);
      setMenu(null);
    }}
  >
    <header className={styles.toolbar}>
      <div><strong>Match {state.code || "—"}</strong><span>{isSpectator ? "Spectating · public cards only" : "Manual table"} · Spectators: {state.spectatorCount ?? 0}</span></div>
      <nav aria-label="Match navigation">
        <button type="button" onClick={() => setGameMenuOpen(true)}>Settings</button>
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
        combatSelection={null}
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
      <div className={`${styles.divider} ${activePlayer ? activeOnTop ? styles.turnTop : styles.turnBottom : ""}`} style={{ "--turn-color": turnColor } as CSSProperties}>
        <div className={styles.actionStageSlot}><ActionStage
          items={opponentTable.action}
          local={false}
          onInspect={setInspectedCard}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          onMenu={showMenu}
        /></div>
        <div className={`${styles.turnControl} ${activePlayer ? styles.turnActive : ""}`}>
          {activePlayer ? <>
            <span className={styles.turnStatus}>Turn {state.turnNumber ?? 1} · {activePlayer.name}</span>
            <button type="button" className={styles.turnButton} aria-label={`Turn ${state.turnNumber ?? 1}: ${activePlayer.name}. ${isSpectator ? "Spectating" : me?.role === state.turnRole ? "End turn" : "Opponent's turn"}`} disabled={isSpectator || me?.role !== state.turnRole} onClick={() => gameConnection.endTurn()}>
              <span className={styles.turnButtonFull}>{isSpectator ? "Current turn" : me?.role === state.turnRole ? "End turn" : "Opponent's turn"}</span>
              <span className={styles.turnButtonCompact}>{isSpectator ? "Watching" : me?.role === state.turnRole ? "End" : "Their turn"}</span>
            </button>
          </> : state.started ? <>
            <span className={styles.turnStatus}>Choose who starts</span>
            {!isSpectator && me && opponent ? <div className={styles.starterChoices}>
              <button type="button" aria-pressed={myVote === me.role} onClick={() => gameConnection.chooseStarter(me.role)}>Me</button>
              <button type="button" aria-label={`Choose ${opponent.name} to start`} aria-pressed={myVote === opponent.role} onClick={() => gameConnection.chooseStarter(opponent.role)}><span className={styles.starterNameFull}>{opponent.name}</span><span className={styles.starterNameCompact}>Them</span></button>
            </div> : null}
            <span className={`${styles.voteStatus} ${myVote && opponentVote && myVote !== opponentVote ? styles.voteMismatch : ""}`}>{isSpectator ? "Waiting for the players" : myVote && opponentVote && myVote !== opponentVote ? "Different choices · choose again" : myVote ? "Waiting for the other player" : "Both players must agree"}</span>
          </> : <span className={styles.turnStatus}>Waiting for match</span>}
        </div>
        <div className={styles.actionStageSlot}><ActionStage
          items={myTable.action}
          local={!isSpectator && Boolean(me?.table)}
          onInspect={setInspectedCard}
          onDragStart={startDrag}
          onDragEnd={endDrag}
          onMenu={showMenu}
        /></div>
      </div>
      <PlayerTable
        player={me}
        table={myTable}
        readOnly={isSpectator}
        attachingUid={attachingUid}
        combatSelection={combatSelection}
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
            combatSelection,
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
    {combatSelection && <div className={styles.attachHint} role="status">
      {combatSelection.action === "attack" ? "Choose an opponent's card to attack" : "Choose an opponent's card to block"} · Click the same section or outside a card to cancel
      <button type="button" onClick={() => setCombatSelection(null)}>Cancel</button>
    </div>}
    <TargetArrows links={targetLinks} containerRef={rootRef} />
    <Inspector card={inspectedCard} onClose={() => setInspectedCard(null)} />
    {gameMenuOpen && <SettingsMenu onClose={() => setGameMenuOpen(false)} onShortcuts={() => { setGameMenuOpen(false); setShortcutSettingsOpen(true); }}>
        <FeedbackLink onOpen={() => setGameMenuOpen(false)} />
    </SettingsMenu>}
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
        ? () => { setAttachingUid(menu.uid); setTargetingUid(null); setCombatSelection(null); setMenu(null); }
        : undefined}
      onChooseTarget={() => { setTargetingUid(menu.uid); setAttachingUid(null); setCombatSelection(null); setMenu(null); }}
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
        ? () => { gameConnection.giveCardControl(menu.uid); setMenu(null); setInspectedCard(null); setAttachingUid(null); setTargetingUid(null); setCombatSelection(null); }
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
