import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import { COMMENT_LIMIT, commentThreads, type DeckComment } from "../domain/deckComments";
import { listDeckComments, postDeckComment, type CommentCursor } from "../services/deckCommentService";
import PlayerAvatar from "./PlayerAvatar";
import styles from "./DeckDiscussion.module.scss";

function mergeComments(existing: DeckComment[], incoming: DeckComment[]) {
  return [...new Map([...existing, ...incoming].map(comment => [comment.id, comment])).values()];
}

function Discussion({ deckId, ownerId, userId, authReady }: { deckId: string; ownerId: string; userId?: string; authReady: boolean }) {
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [cursor, setCursor] = useState<CommentCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [replyTo, setReplyTo] = useState<DeckComment | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  const morePending = useRef(false);
  const attempt = useRef<{ id: string; body: string; parentId: string | null } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (replyTo) input.current?.focus(); }, [replyTo]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    void listDeckComments(deckId).then(result => {
      if (current) { setComments(result.comments); setCursor(result.cursor); setHasMore(result.hasMore); }
    }).catch(() => { if (current) setLoadError("Could not load comments. Please try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [deckId, reload]);

  const loadMore = async () => {
    if (morePending.current || loading) return;
    morePending.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const result = await listDeckComments(deckId, cursor);
      if (active.current) { setComments(current => mergeComments(current, result.comments)); setCursor(result.cursor); setHasMore(result.hasMore); }
    } catch { if (active.current) setLoadError("Could not load more comments. Please try again."); }
    finally { morePending.current = false; if (active.current) setLoadingMore(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || !authReady || pending.current || loading) return;
    pending.current = true;
    setPosting(true);
    setPostError(null);
    setPosted(false);
    const text = body.trim();
    const parentId = replyTo?.id ?? null;
    if (!attempt.current || attempt.current.body !== text || attempt.current.parentId !== parentId) {
      attempt.current = { id: crypto.randomUUID(), body: text, parentId };
    }
    try {
      const comment = await postDeckComment({ ...attempt.current, deckId, userId });
      if (active.current) {
        setComments(current => mergeComments(current, [comment]));
        setBody(""); setReplyTo(null); setPosted(true); attempt.current = null;
      }
    } catch (error) { if (active.current) setPostError(error instanceof Error ? error.message : "Could not post your comment."); }
    finally { pending.current = false; if (active.current) setPosting(false); }
  };

  const composer = userId && <form className={styles.composer} onSubmit={event => void submit(event)}>
    <label htmlFor="deck-comment-body">{replyTo ? `Reply to ${replyTo.author?.name || "Player"}` : "Add a comment"}</label>
    <textarea ref={input} id="deck-comment-body" rows={3} maxLength={COMMENT_LIMIT} value={body} disabled={posting} onChange={event => { setBody(event.target.value); setPosted(false); }} placeholder={replyTo ? "Write your reply…" : "Share a question, suggestion or your experience with this deck."} required />
    <div className={styles.composerActions}><span>{body.length}/{COMMENT_LIMIT}</span>{replyTo && <button type="button" disabled={posting} onClick={() => setReplyTo(null)}>Cancel reply</button>}<button type="submit" disabled={!authReady || posting || loading || !body.trim()}>{posting ? "Posting..." : replyTo ? "Post reply" : "Post comment"}</button></div>
    {postError && <p role="alert" className={styles.error}>{postError}</p>}
    <p className={styles.hint}>Your name, avatar and player profile are visible with your comment.</p>
  </form>;

  return <section className={styles.discussion} aria-labelledby="deck-discussion-title">
    <div className={styles.heading}><h3 id="deck-discussion-title">Comments</h3><button type="button" disabled={loading || loadingMore || posting} onClick={() => { setReplyTo(null); setReload(value => value + 1); }}>Refresh</button></div>
    {!authReady ? <p role="status">Loading account...</p> : !userId && <p>Sign in with Discord to comment or reply.</p>}
    {!replyTo && composer}
    {posted && <p role="status" className={styles.success}>Your comment was posted.</p>}
    {loading && <p role="status">Loading comments...</p>}
    {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
    {!loading && !loadError && comments.length === 0 && <p>No comments yet. Start the conversation.</p>}
    <ol className={styles.commentList}>{commentThreads(comments).map(({ comment, depth }) => {
      const parent = comments.find(item => item.id === comment.parentId);
      return <li key={comment.id} className={styles.comment} style={{ marginInlineStart: `${Math.min(depth, 3) * 16}px` }}>
        <article aria-label={`Comment by ${comment.author?.name || "Player"}`}>
          <div className={styles.commentHeader}>
            <Link className={styles.identity} to={`/players/${comment.authorId}`}><PlayerAvatar name={comment.author?.name || "Player"} avatar={comment.author?.avatar || ""} className={styles.avatar} /><span>{comment.author?.name || "Player"}</span></Link>
            {comment.authorId === ownerId && <span className={styles.creator}>Deck creator</span>}
            <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
          </div>
          {comment.parentId && <span className={styles.replyContext}>Reply to {parent?.author?.name || "a comment"}</span>}
          <p className={styles.body}>{comment.body}</p>
          {userId && <button type="button" disabled={posting} onClick={() => { setReplyTo(comment); setPostError(null); setPosted(false); }}>Reply</button>}
        </article>
        {replyTo?.id === comment.id && composer}
      </li>;
    })}</ol>
    {hasMore && <button type="button" disabled={loadingMore || loading} onClick={() => void loadMore()}>{loadingMore ? "Loading..." : "Load more comments"}</button>}
  </section>;
}

export default function DeckDiscussion({ deckId, ownerId }: { deckId: string; ownerId: string }) {
  const { user, authReady } = useOutletContext<AuthSession>();
  return <Discussion key={`${deckId}:${user?.id ?? "guest"}`} deckId={deckId} ownerId={ownerId} userId={user?.id} authReady={authReady} />;
}
