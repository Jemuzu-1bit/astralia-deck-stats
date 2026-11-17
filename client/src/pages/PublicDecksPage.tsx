import { Link } from "react-router-dom";
import PublicDeckCollection from "../components/PublicDeckCollection";
import styles from "./MyDecksPage.module.scss";

export default function PublicDecksPage() {
  return <div className={styles.pageRoot}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>THE COMMUNITY ARCHIVE</span><h1>Public decks</h1><p>Discover strategies, meet their creators and make a deck your own.</p></div><Link className={styles.importButton} to="/my-decks">Publish from My decks →</Link></header>
    <PublicDeckCollection />
  </div>;
}
