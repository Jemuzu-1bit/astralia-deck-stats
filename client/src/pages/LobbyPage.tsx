import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "./LobbyPage.module.scss";
import { gameConnection, type LobbyState } from "../services/gameConnection";
import { getAllCards } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import { DEFAULT_FRAGMENT_IMAGE_ID } from "../services/fragmentAppearance";
import { listDecks } from "../services/deckService";
import type { Card } from "../types/Card";
import type { Deck } from "../types/Deck";
import { supabase } from "../services/supabaseClient";
import { listCloudDecks } from "../services/cloudDeckService";
import ArchiveIcon from "../components/ArchiveIcon";
import PlayerProfileIdentity from "../components/PlayerProfileIdentity";
import { getChronicle } from "../data/chronicles";
import { readRoomPlayerIdentity } from "../domain/playerProfile";

const fragmentLabels: Readonly<Record<string, string>> = {
  dcs_06_001_n: "Standard",
  dcs_06_001_gr: "DCS GR",
  gf_01_001_pr: "Gamefound",
  ks_01_011_pr: "Kickstarter",
};

export default function LobbyPage() {
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const [searchParams] = useSearchParams();
  const isSpectator = searchParams.get("watch") === "1";
  const [state, setState] = useState<LobbyState>(gameConnection.getCurrentState());
  const [error, setError] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState("");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [fragmentPrintings, setFragmentPrintings] = useState<Card[] | null>(null);
  const role = state.viewerRole;
  const me = !isSpectator && (role === "host" || role === "guest") ? state[role] : null;
  const isHost = me?.role === "host";

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error } = supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
        if (error) throw error;
        const result = data.session?.user ? await listCloudDecks() : listDecks();
        if (active) setDecks(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load decks.");
      } finally {
        if (active) setDecksLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isSpectator) return;
    let active = true;
    void getAllCards({ includePrintings: true, includeFragments: true }).then((cards) => {
      if (active) setFragmentPrintings(cards.filter(card => card.type.trim().toLowerCase() === "fragment"));
    }).catch(() => {
      if (active) setFragmentPrintings([]);
    });
    return () => { active = false; };
  }, [isSpectator]);

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
  function leave() { gameConnection.leave(); navigate("/multiplayer"); }
  const ready = Boolean(state.host?.connected && state.guest?.connected && state.host.deckId && state.guest.deckId);
  const bothConnected = state.host?.connected && state.guest?.connected;
  const selectedChronicle = getChronicle(decks.find(deck => deck.id === selectedDeck)?.faction ?? "");

  return <div className={styles.root}>
    <header className={styles.header}><div><span className={styles.eyebrow}>{state.visibility === "public" ? "PUBLIC ROOM" : "PRIVATE ROOM"}</span><h1>{state.roomName || "Match lobby"}</h1><p>{isSpectator ? "You are watching. The host will start the match when both players are ready." : "Choose your deck and get ready for your next match."}</p></div><nav className={styles.headerActions}><Link to="/help" target="_blank" rel="noopener noreferrer">Getting started</Link><button onClick={leave}>Leave room</button></nav></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.roomDetails}><div><span>ROOM CODE</span><strong className={styles.code}>{state.code || "------"}</strong></div><p><ArchiveIcon name={state.visibility === "public" ? "multiplayer" : "lock"} size={18} />{state.visibility === "public" ? "Visible in public rooms" : "Invite players and spectators with this code"}</p><span className={styles.spectators}><ArchiveIcon name="eye" size={18} />{state.spectatorCount ?? 0} watching</span></div>
    <main className={styles.players}>
      {(["host", "guest"] as const).map((seat) => {
        const player = state[seat];
        const isMe = seat === me?.role;
        const playerColor = getChronicle(player?.faction ?? "")?.color;
        return <section className={styles.player} key={seat}>
          <div className={styles.playerHeading}>
            {!player?.profile && <span className={styles.avatar}><ArchiveIcon name={player ? "user" : "multiplayer"} size={25} /></span>}
            <div><span className={styles.role}>{seat === "host" ? "HOST" : "OPPONENT"}{isMe ? " · YOU" : ""}</span>
              {!player?.profile && <h2>{player ? player.name : "An open seat"}</h2>}
            </div>
            {player && <span className={styles.status}>{!player.connected ? "Disconnected" : player.deckId ? "Ready" : "Choosing deck"}</span>}
          </div>
          {player?.profile && <div className={styles.playerProfile}><PlayerProfileIdentity profile={readRoomPlayerIdentity(player.profile)} /></div>}
          {player ? <>
            <div className={styles.deck}>
              <ArchiveIcon name="decks" size={22} />
              <div>
                <span>SELECTED DECK</span>
                <strong style={{ color: playerColor }}>{player.deckName || "No deck selected"}</strong>
              </div>
            </div>
            {isMe && <>
              <label className={styles.deckLabel} htmlFor="lobby-deck">Your saved decks</label>
              <select id="lobby-deck" disabled={decksLoading} value={selectedDeck || player.deckId || ""} style={{ colorScheme: "dark", borderColor: selectedChronicle?.color ?? playerColor }} onChange={event => chooseDeck(event.target.value)}>
                <option value="" disabled>{decksLoading ? "Loading decks..." : "Choose your deck"}</option>
                {decks.map(deck => {
                  const chronicle = getChronicle(deck.faction);
                  return <option key={deck.id} value={deck.id} style={{ color: chronicle?.color }}>{deck.name} · {chronicle?.name ?? deck.faction}</option>;
                })}
              </select>
              {!decksLoading && !decks.length && <p>No saved decks yet. <Link to="/my-decks?new=1">Build your first deck</Link>, then return to this room.</p>}
            </>}
          </> : <div className={styles.waiting}><p>{state.visibility === "public" ? "Your room is listed. An opponent can join from Multiplayer." : "Share the room code to invite your opponent."}</p></div>}
          {isMe && <fieldset className={styles.fragmentField} disabled={!player?.connected}>
            <legend>Fragment artwork</legend>
            {fragmentPrintings === null ? <p role="status">Loading artwork…</p>
              : fragmentPrintings.length === 0 ? <p role="status">Fragment artwork is unavailable.</p>
              : <div className={styles.fragmentChoices}>
                {fragmentPrintings.map(card => <label className={styles.fragmentChoice} key={card.id} title={card.setId}>
                  <input
                    type="radio"
                    name="fragment-artwork"
                    value={card.imageId}
                    checked={card.imageId === (player?.fragmentImageId ?? DEFAULT_FRAGMENT_IMAGE_ID)}
                    onChange={() => gameConnection.setFragmentImage(card.imageId)}
                  />
                  <img src={getCardImagePath(card)} alt="" width={64} height={90} />
                  <span>{fragmentLabels[card.imageId] ?? card.setId}</span>
                </label>)}
              </div>}
          </fieldset>}
        </section>;
      })}
    </main>
    <div className={styles.footer}><div><strong>{ready ? "The table is ready." : bothConnected ? "Choose your decks." : "Waiting for your opponent."}</strong><p>{ready ? isHost ? "Both players are ready. Start when you are." : "The host will start the match." : "Both players must be connected and select a deck before the host can start."}</p></div>{isHost && <button className={styles.start} disabled={!ready} onClick={() => gameConnection.startRequest()}><ArchiveIcon name="play" size={16} /> Start match</button>}</div>
    {!state.code && <p className={styles.returnLink}><Link to="/multiplayer?join=1">Join with a room code</Link> or <Link to="/multiplayer">return to Multiplayer</Link>.</p>}
  </div>;
}
