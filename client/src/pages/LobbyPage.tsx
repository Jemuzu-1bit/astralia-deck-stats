import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "./LobbyPage.module.scss";
import { gameConnection, type LobbyState } from "../services/gameConnection";
import { listDecks } from "../services/deckService";
import type { Deck } from "../types/Deck";

export default function LobbyPage() {
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const [searchParams] = useSearchParams();
  const isSpectator = searchParams.get("watch") === "1";
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  const [error, setError] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState("");
  const decks = useMemo(() => listDecks(), []);
  const myId = gameConnection.getSocketId();
  const me = !isSpectator && myId ? state.host?.socketId === myId ? state.host : state.guest?.socketId === myId ? state.guest : null : null;
  const isHost = me?.role === "host";

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
    if (!state.code) return;
    const watchQuery = isSpectator ? "?watch=1" : "";
    if (state.started) navigate(`/game/${state.code}${watchQuery}`, { replace: true });
    else if (routeCode !== state.code) navigate(`/lobby/${state.code}${watchQuery}`, { replace: true });
  }, [state.code, state.started, routeCode, isSpectator, navigate]);

  function chooseDeck(id: string) {
    setSelectedDeck(id);
    const deck = decks.find((entry) => entry.id === id);
    if (!deck) return;
    gameConnection.setDeck(deck.id, deck.name, deck.faction, deck.protagonist ?? null, deck.persona, deck.deck);
  }
  function leave() { gameConnection.leave(); navigate("/"); }

  return <div className={styles.root}>
    <header className={styles.header}><div><h1>Online lobby</h1><p>{isSpectator ? "Watching this match. You can see public cards and actions." : "Share this code with your opponent or spectators."}</p></div><nav className={styles.headerActions}><Link to="/help" target="_blank" rel="noopener noreferrer">Guide</Link><button onClick={leave}>Leave</button></nav></header>
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.code}>{state.code || "------"}</div>
    <p>Spectators: {state.spectatorCount ?? 0}</p>
    <main className={styles.players}>
      {[state.host, state.guest].map((player, index) => <section className={styles.player} key={player?.socketId || index}>
        <h2>{player ? player.name : "Waiting for opponent"}</h2>
        {player && <><p>{player.role === "host" ? "Host" : "Guest"}</p><strong>{player.deckName || "No deck selected"}</strong>{!isSpectator && myId && player.socketId === myId && <select value={selectedDeck || player.deckId || ""} onChange={(event) => chooseDeck(event.target.value)}><option value="">Choose your deck</option>{decks.map((deck: Deck) => <option key={deck.id} value={deck.id}>{deck.name} · {deck.faction}</option>)}</select>}</>}
      </section>)}
    </main>
    <div className={styles.footer}>{isHost && <button className={styles.start} disabled={!state.host?.deckId || !state.guest?.deckId} onClick={() => gameConnection.startRequest()}>Start match</button>}<span>{state.guest ? "Both players are connected." : "Waiting for the second player…"}</span></div>
  </div>;
}
