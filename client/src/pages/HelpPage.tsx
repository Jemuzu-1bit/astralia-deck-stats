import { Link } from "react-router-dom";
import ArchiveIcon from "../components/ArchiveIcon";
import FeedbackLink from "../components/FeedbackLink";
import { CHRONICLES } from "../data/chronicles";
import styles from "./HelpPage.module.scss";

const archiveSections = [
  {
    title: "Card library",
    to: "/cards",
    icon: "cards",
    description: "Browse the card catalog and use filters to find cards for your deck.",
  },
  {
    title: "My decks",
    to: "/my-decks",
    icon: "decks",
    description: "Create or import a deck, check its stats, and try a sample opening hand.",
  },
  {
    title: "Public decks",
    to: "/public-decks",
    icon: "user",
    description: "See what other players are building and import a list to make it your own.",
  },
] as const;

export default function HelpPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Getting started</h1>
          <p>The Astralia Deck Archive is where you explore cards, build decks, and play Astralia Chronicles online.</p>
          <Link to="/my-decks?new=1" className={styles.primary}>
            <ArchiveIcon name="plus" size={18} /> Build a deck
          </Link>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <img src={CHRONICLES.green.image} alt="" />
        </div>
      </header>

      <section aria-labelledby="explore-archive">
        <h2 id="explore-archive" className={styles.sectionTitle}>Explore the archive</h2>
        <ul className={styles.sections}>
          {archiveSections.map(({ title, to, icon, description }) => (
            <li key={to}>
              <Link to={to} className={styles.sectionLink} aria-label={title}>
                <span className={styles.icon}><ArchiveIcon name={icon} size={22} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.playPanel} aria-labelledby="play-online">
        <span className={styles.icon}><ArchiveIcon name="multiplayer" size={22} /></span>
        <div className={styles.playDescription}>
          <h2 id="play-online">Play online</h2>
          <p>Join or watch a public match, or share a private room code with a friend. Both players choose a saved deck in the lobby, then the host starts the match.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/multiplayer" className={styles.primary}>Multiplayer</Link>
          <Link to="/multiplayer?join=1" className={styles.secondary}>Join with code</Link>
        </div>
      </section>

      <p className={styles.feedback}>
        Found a bug or have a suggestion? <FeedbackLink className={styles.feedbackLink} />
      </p>
    </div>
  );
}
