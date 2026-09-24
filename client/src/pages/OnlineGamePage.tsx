import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import CardDisplay from "../components/CardDisplay";
import CardDetailsModal from "../components/CardDetailsModal";
import { getCardFaces } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import {
  gameConnection,
  type LobbyPlayerState,
  type LobbyState,
} from "../services/gameConnection";
import type { Card } from "../types/Card";
import normalCardBack from "../assets/N_Back.png";
import styles from "./OnlineGamePage.module.scss";

function Protagonist({ id }: { id?: string | null }) {
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setCard(null);
      return () => { active = false; };
    }
    getCardFaces(id).then(({ front, back }) => {
      if (active) setCard(front || back || null);
    });
    return () => { active = false; };
  }, [id]);

  return card ? <CardDisplay card={card} /> : <span className={styles.emptyText}>Protagonist</span>;
}

function DeckStack({ count }: { count: number }) {
  if (count <= 0) return <span className={styles.emptyText}>Empty</span>;
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

function PublicCardStack({ ids }: { ids: string[] }) {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all(ids.map((id) => getCardFaces(id).then(({ front, back }) => front || back || null)))
      .then((loaded) => {
        if (active) setCards(loaded.filter((card): card is Card => Boolean(card)));
      });
    return () => { active = false; };
  }, [ids]);

  if (cards.length === 0) return <span className={styles.emptyText}>Empty</span>;
  return <div className={styles.publicStack} aria-label={`${cards.length} public cards`}>
    {cards.map((card, index) => <img
      key={`${card.id}-${index}`}
      src={getCardImagePath(card, "thumb")}
      alt={card.name}
      title={card.name}
      style={{ left: `${Math.min(index, 6) * 12}px`, zIndex: index + 1 }}
    />)}
    <b>{cards.length}</b>
  </div>;
}

function Hand({ ids }: { ids: string[] }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all(ids.map((id) => getCardFaces(id).then(({ front, back }) => front || back || null)))
      .then((loaded) => {
        if (active) setCards(loaded.filter((card): card is Card => Boolean(card)));
      });
    return () => { active = false; };
  }, [ids]);

  return <>
    <div className={styles.hand} aria-label="Your cards">
      {cards.map((card, index) => <button
        key={`${card.id}-${index}`}
        type="button"
        aria-label={`View ${card.name}`}
        title={card.name}
        onClick={() => setSelectedCard(card)}
      >
        <img src={getCardImagePath(card, "thumb")} alt="" />
      </button>)}
    </div>
    {selectedCard && <CardDetailsModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
  </>;
}

function Zone({ label, children, className = "" }: { label: string; children?: ReactNode; className?: string }) {
  return <div className={`${styles.zone} ${className}`}>
    <span className={styles.zoneLabel}>{label}</span>
    <div className={styles.zoneContent}>{children}</div>
  </div>;
}

function PlayerTable({ player, opponentSide }: { player: LobbyPlayerState | null; opponentSide?: boolean }) {
  const deckCount = useMemo(
    () => player?.mainDeckCards?.reduce((total, entry) => total + entry.qty, 0) || 0,
    [player?.mainDeckCards]
  );
  const personaCards = useMemo(() => player?.personaCards || [], [player?.personaCards]);
  const protagonistIndex = opponentSide ? 1 : 4;

  return <section className={`${styles.tableHalf} ${opponentSide ? styles.opponentHalf : styles.playerHalf}`}>
    <div className={styles.playerBadge}>
      <strong>{player?.name || "Waiting…"}</strong>
      <span>{player?.deckName || "No deck"}</span>
    </div>

    <div className={styles.sideZones}>
      {opponentSide ? <>
        <Zone label="Persona · public"><PublicCardStack ids={personaCards} /></Zone>
        <Zone label="Oblivion · public" />
      </> : <>
        <Zone label="Oblivion · public" />
        <Zone label="Persona · public"><PublicCardStack ids={personaCards} /></Zone>
      </>}
    </div>

    <div className={styles.battleGrid}>
      {Array.from({ length: 6 }).map((_, index) => index === protagonistIndex
        ? <Zone key={index} label="Protagonist" className={styles.protagonistSlot}>
            <Protagonist id={player?.protagonistId} />
          </Zone>
        : <Zone key={index} label="Battle" className={styles.battleSlot} />)}
    </div>

    <div className={styles.sideZones}>
      {opponentSide ? <>
        <Zone label="Graveyard · public" />
        <Zone label="Main deck"><DeckStack count={deckCount} /></Zone>
      </> : <>
        <Zone label="Main deck"><DeckStack count={deckCount} /></Zone>
        <Zone label="Graveyard · public" />
      </>}
    </div>

    {opponentSide && <div className={styles.handLabel}>Hand · {player?.handCards?.length || 0}</div>}
  </section>;
}

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());

  useEffect(() => gameConnection.onState(setState), []);

  const myId = gameConnection.getSocketId();
  const me = state.host?.socketId === myId
    ? state.host
    : state.guest?.socketId === myId ? state.guest : null;
  const opponent = me?.role === "host" ? state.guest : state.host;

  return <div className={styles.root}>
    <header className={styles.toolbar}>
      <div><strong>Match {state.code || "—"}</strong><span>Manual table</span></div>
      <button onClick={() => { gameConnection.leave(); navigate("/"); }}>Leave match</button>
    </header>
    <main className={styles.playmat}>
      <PlayerTable player={opponent} opponentSide />
      <div className={styles.divider}><span>VS</span></div>
      <PlayerTable player={me} />
      <section className={styles.handDock} aria-label="Your hand">
        <div className={styles.handDockLabel}>Hand · {me?.handCards?.length || 0}</div>
        {me?.handCards && <Hand ids={me.handCards} />}
      </section>
    </main>
  </div>;
}
