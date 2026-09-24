import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gameConnection, type LobbyState } from "../services/gameConnection";
import styles from "./OnlineGamePage.module.scss";

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  useEffect(() => gameConnection.onState(setState), []);
  const myId = gameConnection.getSocketId();
  const me = state.host?.socketId === myId ? state.host : state.guest?.socketId === myId ? state.guest : null;
  const opponent = me?.role === "host" ? state.guest : state.host;
  return <div className={styles.root}>
    <header><span>Match {state.code}</span><button onClick={() => { gameConnection.leave(); navigate("/"); }}>Leave match</button></header>
    <main><section><small>OPPONENT</small><h1>{opponent?.name || "Waiting…"}</h1><p>{opponent?.deckName || "Deck not selected"}</p></section><div className={styles.vs}>VS</div><section><small>YOU</small><h1>{me?.name || "Player"}</h1><p>{me?.deckName || "Deck not selected"}</p></section></main>
    <p className={styles.notice}>The online lobby and synchronized match session are active. Game actions can now be connected to the server-authoritative rules engine.</p>
  </div>;
}
