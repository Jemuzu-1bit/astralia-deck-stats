import { useEffect, useRef } from "react";
import type { GameActivity } from "../../services/gameConnection";
import styles from "../OnlineGamePage.module.scss";

export function ActivityLog({ entries, onClose }: { entries: GameActivity[]; onClose: () => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const followLatest = useRef(true);
  useEffect(() => {
    const list = listRef.current;
    if (list && followLatest.current) list.scrollTop = list.scrollHeight;
  }, [entries]);

  return <section id="match-activity-log" className={styles.activityLog} aria-label="Match activity log" onClick={(event) => event.stopPropagation()}>
    <div className={styles.activityLogHeader}>
      <div><strong>Activity log</strong><span>Shared with players and spectators</span></div>
      <button type="button" onClick={onClose} aria-label="Close activity log">Close</button>
    </div>
    <div role="log" aria-label="Match actions" aria-live="polite" aria-relevant="additions" className={styles.activityLogFeed}>
      <ol ref={listRef} tabIndex={0} onScroll={() => {
        const list = listRef.current;
        if (list) followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      }}>
        {entries.map((entry) => <li key={entry.id}>
          <div className={styles.activityLogMeta}>
            <span>{entry.turn ? `Turn ${entry.turn}` : "Setup"}</span>
            <time dateTime={new Date(entry.timestamp).toISOString()}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
          </div>
          <p><strong>{entry.actorName}</strong> {entry.text}</p>
        </li>)}
      </ol>
    </div>
    {!entries.length && <p className={styles.activityLogEmpty}>Actions will appear when the match starts.</p>}
    {entries.length >= 1000 && <p className={styles.activityLogLimit}>Showing the latest 1,000 actions.</p>}
  </section>;
}
