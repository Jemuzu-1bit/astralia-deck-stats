import type { Deck } from "../types/Deck";
import { getChronicle } from "../data/chronicles";
import ChronicleLabel from "./ChronicleLabel";
import { SECTION_LIMITS } from "../domain/deckBuilder";
import ArchiveIcon from "./ArchiveIcon";
import styles from "./DeckCard.module.scss";

interface DeckCardProps {
  deck: Deck;
  onEdit: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
  onShare: (deck: Deck) => void;
  onExport: (deck: Deck) => void;
  onPublish?: (deck: Deck) => void;
}

export default function DeckCard({ deck, onEdit, onDelete, onShare, onExport, onPublish }: DeckCardProps) {
  const chronicle = getChronicle(deck.faction);
  const total = deck.deck.reduce((sum, card) => sum + card.qty, 0);
  const complete = total === SECTION_LIMITS.deck && deck.persona.length === SECTION_LIMITS.persona && Boolean(deck.protagonist);
  return <article className={styles.card}>
    {onPublish && <div className={styles.publication}><span>{deck.visibility === "public" ? "Public deck" : "Private deck"}</span><button onClick={() => onPublish(deck)}>{deck.visibility === "public" ? "Unpublish" : "Publish"}</button></div>}
    <button className={styles.cover} aria-label={`Edit ${deck.name}`} aria-description={chronicle ? `Chronicle of ${chronicle.name}` : undefined} onClick={() => onEdit(deck)} style={{ backgroundImage: `linear-gradient(0deg, #1b1c21 6%, #1b1c21db 26%, #1b1c2110 85%), url(${deck.backgroundImage || chronicle?.image || ""})` }}>
      <span className={styles.status}>{complete ? "Complete" : "Draft"}</span>
      <ChronicleLabel faction={deck.faction} fullName className={styles.faction} />
    </button>
    <div className={styles.info}>
      <button className={styles.title} onClick={() => onEdit(deck)}>{deck.name || "Untitled deck"}</button>
      <div className={styles.meta}><span>{total} / {SECTION_LIMITS.deck} cards</span><span>{new Date(deck.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
      <div className={`${styles.actions} ${styles.ownDeckActions}`}>
        <button onClick={() => onEdit(deck)}><ArchiveIcon name="decks" size={14} /> Edit deck</button>
        <button onClick={() => onShare(deck)}>Share ↗</button>
        <button onClick={() => onExport(deck)} aria-label={`Export ${deck.name || "Untitled deck"}`} aria-haspopup="dialog">Export</button>
        <button className={styles.delete} onClick={() => onDelete(deck)} aria-label={`Delete ${deck.name}`}>Delete</button>
      </div>
    </div>
  </article>;
}
