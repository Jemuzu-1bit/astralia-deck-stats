import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./LobbyPage.module.scss";
import { gameConnection, type LobbyState } from "../services/gameConnection";
import { listDecks } from "../services/deckService";
import type { Deck } from "../types/Deck";

export default function LobbyPage() {
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  const [error, setError] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState("");
  const decks = useMemo(() => listDecks(), []);
  const myId = gameConnection.getSocketId();
  const me = state.host?.socketId === myId ? state.host : state.guest?.socketId === myId ? state.guest : null;
  const isHost = me?.role === "host";

  useEffect(() => {
    const offState = gameConnection.onState(setState);
    const offError = gameConnection.onError(setError);
    if (routeCode) gameConnection.resume(routeCode);
    else gameConnection.connect();
    return () => { offState(); offError(); };
  }, [routeCode]);
  useEffect(() => {
    if (!state.code) return;
    if (state.started) navigate(`/game/${state.code}`, { replace: true });
    else if (routeCode !== state.code) navigate(`/lobby/${state.code}`, { replace: true });
  }, [state.code, state.started, routeCode, navigate]);

  function chooseDeck(id: string) {
    setSelectedDeck(id);
    const deck = decks.find((entry) => entry.id === id);
    if (!deck) return;
    gameConnection.setDeck(deck.id, deck.name, deck.faction, deck.protagonist ?? null, deck.persona, deck.deck);
  }
  function leave() { gameConnection.leave(); navigate("/"); }

  return <div className={styles.root}>
    <header className={styles.header}><div><h1>Online lobby</h1><p>Share this code with your opponent.</p></div><button onClick={leave}>Leave</button></header>
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.code}>{state.code || "------"}</div>
    <main className={styles.players}>
      {[state.host, state.guest].map((player, index) => <section className={styles.player} key={player?.socketId || index}>
        <h2>{player ? player.name : "Waiting for opponent"}</h2>
        {player && <><p>{player.role === "host" ? "Host" : "Guest"}</p><strong>{player.deckName || "No deck selected"}</strong>{player.socketId === myId && <select value={selectedDeck || player.deckId || ""} onChange={(event) => chooseDeck(event.target.value)}><option value="">Choose your deck</option>{decks.map((deck: Deck) => <option key={deck.id} value={deck.id}>{deck.name} · {deck.faction}</option>)}</select>}</>}
      </section>)}
    </main>
    <div className={styles.footer}>{isHost && <button className={styles.start} disabled={!state.host?.deckId || !state.guest?.deckId} onClick={() => gameConnection.startRequest()}>Start match</button>}<span>{state.guest ? "Both players are connected." : "Waiting for the second player…"}</span></div>
  </div>;
}
