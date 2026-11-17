import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./App.module.scss";
import ArchiveIcon from "./components/ArchiveIcon";
import { gameConnection } from "./services/gameConnection";
import { listDecks } from "./services/deckService";
import { FACTIONS } from "./domain/deckBuilder";
import { CHRONICLES } from "./data/chronicles";

function App() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => localStorage.getItem("astralia.playerName") || "");
  const [joinCode, setJoinCode] = useState("");
  const [joinMode, setJoinMode] = useState<"play" | "watch" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentDecks] = useState(() => listDecks().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3));
  useEffect(() => gameConnection.onError(setError), []);
  const connectAnd = (action: () => void) => {
    gameConnection.connect();
    gameConnection.runWhenConnected(action);
    localStorage.setItem("astralia.playerName", name.trim());
    navigate("/lobby");
  };

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroArt} aria-hidden="true" />
      <div className={styles.heroContent}>
        <span className={styles.eyebrow}><span /> THE ASTRALIA DECK ARCHIVE</span>
        <h1>Every great game<br />starts with <em>a deck.</em></h1>
        <p>Discover your cards. Find your synergies.<br />Build your next chapter in Astralia.</p>
        <div className={styles.heroActions}><Link to="/my-decks?new=1" className={styles.primary}><ArchiveIcon name="plus" size={18} /> Build a deck</Link><Link to="/cards" className={styles.secondary}>Explore cards <ArchiveIcon name="arrow" size={17} /></Link></div>
      </div>
      <span className={styles.heroCaption}>FIVE CHRONICLES. YOUR STORY.</span>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>PICK YOUR PATH</span><h2>The chronicles</h2></div><Link to="/cards">Browse the library <ArchiveIcon name="arrow" size={16} /></Link></div>
      <div className={styles.chronicles}>{FACTIONS.map((faction, index) => <Link key={faction} to={`/my-decks?new=1&faction=${faction}`} className={styles.chronicle} style={{ backgroundImage: `linear-gradient(0deg, #101113 0%, #10111300 85%), url(${CHRONICLES[faction].image})` }}><span className={styles.chronicleNumber}>0{index + 1}</span><div><span style={{ color: CHRONICLES[faction].color }}>CHRONICLE OF</span><h3>{CHRONICLES[faction].name}</h3></div><ArchiveIcon name="arrow" size={18} /></Link>)}</div>
    </section>
    <div className={styles.bottomGrid}>
      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>YOUR WORKSPACE</span><h2>On this device</h2></div><Link to="/my-decks">All decks <ArchiveIcon name="arrow" size={16} /></Link></div>
        {recentDecks.length > 0 ? <div className={styles.recentList}>{recentDecks.map(deck => <Link key={deck.id} to={`/my-decks?edit=${encodeURIComponent(deck.id)}`} className={styles.recentDeck}><span className={styles.deckSwatch} style={{ background: CHRONICLES[deck.faction]?.color }}><ArchiveIcon name="decks" /></span><div><strong>{deck.name}</strong><span>{CHRONICLES[deck.faction]?.name ?? deck.faction} · {deck.deck.reduce((sum, card) => sum + card.qty, 0)} cards</span></div><ArchiveIcon name="arrow" size={18} /></Link>)}</div> : <div className={styles.emptyDeck}><ArchiveIcon name="decks" size={32} /><h3>A new story is waiting.</h3><p>Your saved decks will appear here.<br />Choose a chronicle and make it your own.</p><Link to="/my-decks?new=1">Create your first deck <ArchiveIcon name="arrow" size={16} /></Link></div>}
      </section>
      <section className={styles.playPanel}>
        <span className={styles.eyebrow}>TAKE IT TO THE TABLE</span><h2>Ready to play?</h2><p>Bring your deck. Invite a friend.<br />See how your strategy holds up.</p>
        <label htmlFor="player-name">Player name</label><input id="player-name" placeholder="Enter your name" value={name} onChange={event => setName(event.target.value)} />
        <div className={styles.playActions}><button className={styles.primary} onClick={() => connectAnd(() => gameConnection.host(name || "Host"))}><ArchiveIcon name="play" size={15} /> Host game</button><button className={styles.secondary} onClick={() => { setError(null); setJoinMode("play"); }}>Join game</button></div>
        <button className={styles.watchButton} onClick={() => { setError(null); setJoinMode("watch"); }}>Have a code? Watch a game <ArchiveIcon name="arrow" size={14} /></button>
      </section>
    </div>
    {joinMode && <div className={styles.modalOverlay} onClick={() => setJoinMode(null)}><form className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="join-title" onClick={event => event.stopPropagation()} onSubmit={event => {
      event.preventDefault();
      if (!joinCode.trim()) return;
      if (joinMode === "watch") { const code = joinCode.trim().toUpperCase(); gameConnection.watch(code); navigate(`/lobby/${code}?watch=1`); }
      else connectAnd(() => gameConnection.join(name || "Guest", joinCode));
    }}><button type="button" className={styles.modalClose} aria-label="Close" onClick={() => setJoinMode(null)}><ArchiveIcon name="close" /></button><h2 id="join-title">{joinMode === "watch" ? "Watch a game" : "Join a game"}</h2><p>Enter the six-character lobby code.</p>{error && <p role="alert">{error}</p>}<label htmlFor="join-code">Lobby code</label><input id="join-code" placeholder="AB12CD" maxLength={6} value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} autoFocus /><button className={styles.primary} disabled={!joinCode.trim()}>{joinMode === "watch" ? "Watch game" : "Join game"}<ArchiveIcon name="arrow" size={16} /></button></form></div>}
  </div>;
}
export default App;
