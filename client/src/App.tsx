import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./App.module.scss";
import ArchiveIcon from "./components/ArchiveIcon";
import ChronicleLabel, { ChronicleBadge } from "./components/ChronicleLabel";
import { listDecks } from "./services/deckService";
import { FACTIONS } from "./domain/deckBuilder";
import { CHRONICLES, getChronicle } from "./data/chronicles";

const HERO_FACTIONS = ["purple", ...FACTIONS.filter(faction => faction !== "purple")];

function App() {
  const [recentDecks] = useState(() => listDecks().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3));
  const [heroIndex, setHeroIndex] = useState(0);

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroArt} aria-hidden="true">
        {HERO_FACTIONS.map((faction, index) => <img
          key={faction}
          data-chronicle={faction}
          className={`${styles.heroCharacter} ${index === heroIndex ? styles.heroCharacterActive : ""}`}
          src={CHRONICLES[faction].image}
          alt=""
          draggable={false}
          onAnimationEnd={() => setHeroIndex(current => (current + 1) % HERO_FACTIONS.length)}
        />)}
      </div>
      <div className={styles.heroContent}>
        <span className={styles.eyebrow}><span /> THE ASTRALIA DECK ARCHIVE</span>
        <h1>Every great game<br />starts with <em>a deck.</em></h1>
        <p>Discover your cards. Find your synergies.<br />Build your next chapter in Astralia.</p>
        <div className={styles.heroActions}><Link to="/my-decks?new=1" className={styles.primary}><ArchiveIcon name="plus" size={18} /> Build a deck</Link><Link to="/cards" className={styles.secondary}>Explore cards <ArchiveIcon name="arrow" size={17} /></Link></div>
      </div>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>PICK YOUR PATH</span><h2>The chronicles</h2></div><Link to="/cards">Browse the library <ArchiveIcon name="arrow" size={16} /></Link></div>
      <div className={styles.chronicles}>
        {FACTIONS.map(faction => {
          const chronicle = CHRONICLES[faction];
          return <Link
            key={faction}
            to={`/my-decks?new=1&faction=${faction}`}
            className={styles.chronicle}
            style={{ backgroundImage: `linear-gradient(0deg, #101113 10%, #101113d9 30%, transparent 85%), url(${chronicle.image})` }}
          >
            <div>
              <h3><span>Chronicle of</span>{chronicle.name}</h3>
              <ChronicleBadge chronicle={chronicle} />
            </div>
          </Link>;
        })}
      </div>
    </section>
    <div className={styles.bottomGrid}>
      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>YOUR WORKSPACE</span><h2>On this device</h2></div><Link to="/my-decks">All decks <ArchiveIcon name="arrow" size={16} /></Link></div>
        {recentDecks.length > 0 ? <div className={styles.recentList}>
          {recentDecks.map(deck => <Link key={deck.id} to={`/my-decks?edit=${encodeURIComponent(deck.id)}`} className={styles.recentDeck}>
            <span className={styles.deckSwatch} style={{ background: getChronicle(deck.faction)?.color }}><ArchiveIcon name="decks" /></span>
            <div>
              <strong>{deck.name}</strong>
              <div className={styles.recentDeckMeta}>
                <ChronicleLabel faction={deck.faction} showFaction />
                <span>{deck.deck.reduce((sum, card) => sum + card.qty, 0)} cards</span>
              </div>
            </div>
            <ArchiveIcon name="arrow" size={18} />
          </Link>)}
        </div> : <div className={styles.emptyDeck}><ArchiveIcon name="decks" size={32} /><h3>A new story is waiting.</h3><p>Your saved decks will appear here.<br />Choose a chronicle and make it your own.</p><Link to="/my-decks?new=1">Create your first deck <ArchiveIcon name="arrow" size={16} /></Link></div>}
      </section>
      <section className={styles.playPanel}>
        <span className={styles.eyebrow}>TAKE IT TO THE TABLE</span><h2>Ready to play?</h2><p>Find an opponent in a public room or invite<br />a friend to a private table.</p>
        <div className={styles.playActions}><Link className={styles.primary} to="/multiplayer"><ArchiveIcon name="multiplayer" size={17} /> Multiplayer</Link><Link className={styles.secondary} to="/multiplayer?create=1">Create room</Link></div>
        <Link className={styles.watchButton} to="/multiplayer?join=1">Have a private room code? Join or watch</Link>
      </section>
    </div>
  </div>;
}
export default App;
