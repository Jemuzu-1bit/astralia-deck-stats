import type { PublicDeck } from "../domain/publicDecks";
import ArchiveIcon from "./ArchiveIcon";
import styles from "./PublicDeckCollection.module.scss";

export default function PublicDeckMetrics({ deck, onLike, likeDisabled, error }: {
  deck: PublicDeck;
  onLike?: () => void;
  likeDisabled: boolean;
  error?: string;
}) {
  const likes = `${deck.likeCount.toLocaleString()} ${deck.likeCount === 1 ? "like" : "likes"}`;
  return <>
    <div className={styles.metrics}>
      {onLike
        ? <button type="button" className={styles.like} aria-label={`Like ${deck.name} (${likes})`} aria-pressed={deck.likedByViewer} disabled={likeDisabled} onClick={onLike}>
          <ArchiveIcon name="heart" size={15} />{likes}
        </button>
        : <span><ArchiveIcon name="heart" size={15} />{likes}</span>}
      <span><ArchiveIcon name="eye" size={15} />{deck.viewCount.toLocaleString()} {deck.viewCount === 1 ? "view" : "views"}</span>
      <span><ArchiveIcon name="download" size={15} />{deck.importCount.toLocaleString()} {deck.importCount === 1 ? "import" : "imports"}</span>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}
