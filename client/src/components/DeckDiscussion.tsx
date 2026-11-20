import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import { COMMENT_LIMIT, commentThreads, type DeckComment } from "../domain/deckComments";
import { deleteDeckComment, listDeckComments, postDeckComment, updateDeckComment, type CommentCursor } from "../services/deckCommentService";
import PlayerAvatar from "./PlayerAvatar";
import styles from "./DeckDiscussion.module.scss";

function mergeComments(existing: DeckComment[], incoming: DeckComment[]) {
  return [...new Map([...existing, ...incoming].map(comment => [comment.id, comment])).values()];
}

type CommentAction =
  | { kind: "edit"; comment: DeckComment; body: string }
  | { kind: "delete"; comment: DeckComment };

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
  const [success, setSuccess] = useState<string | null>(null);
  const [commentAction, setCommentAction] = useState<CommentAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  const morePending = useRef(false);
  const attempt = useRef<{ id: string; body: string; parentId: string | null } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = loading || loadingMore || posting || saving;
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
    if (morePending.current || pending.current || loading) return;
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
    if (!userId || !authReady || pending.current || morePending.current || loading) return;
    pending.current = true;
    setPosting(true);
    setPostError(null);
    setSuccess(null);
    const text = body.trim();
    const parentId = replyTo?.id ?? null;
    if (!attempt.current || attempt.current.body !== text || attempt.current.parentId !== parentId) {
      attempt.current = { id: crypto.randomUUID(), body: text, parentId };
    }
    try {
      const comment = await postDeckComment({ ...attempt.current, deckId, userId });
      if (active.current) {
        setComments(current => mergeComments(current, [comment]));
        setBody(""); setReplyTo(null); setSuccess("Your comment was posted."); attempt.current = null;
      }
    } catch (error) { if (active.current) setPostError(error instanceof Error ? error.message : "Could not post your comment."); }
    finally { pending.current = false; if (active.current) setPosting(false); }
  };

  const openAction = (action: CommentAction) => {
    setCommentAction(action);
    setActionError(null);
    setSuccess(null);
  };

  const submitCommentAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!commentAction || !authReady || commentAction.comment.authorId !== userId
      || pending.current || morePending.current || loading) return;

    const { comment, kind } = commentAction;
    pending.current = true;
    setSaving(true);
    setActionError(null);
    try {
      if (kind === "edit") {
        const updatedBody = await updateDeckComment(comment, commentAction.body);
        if (!active.current) return;
        setComments(current => current.map(item => item.id === comment.id ? { ...item, body: updatedBody } : item));
        setSuccess("Your comment was updated.");
      } else {
        await deleteDeckComment(comment);
        if (!active.current) return;
        setComments(current => current.filter(item => item.id !== comment.id)
          .map(item => item.parentId === comment.id ? { ...item, parentId: null } : item));
        setReplyTo(current => current?.id === comment.id ? null : current);
        setSuccess("Your comment was deleted.");
      }
      setCommentAction(null);
    } catch (error) {
      if (active.current) setActionError(error instanceof Error ? error.message : "Could not complete your request. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  };

  const composer = userId && <form className={styles.composer} onSubmit={event => void submit(event)}>
    <label htmlFor="deck-comment-body">{replyTo ? `Reply to ${replyTo.author?.name || "Player"}` : "Add a comment"}</label>
    <textarea ref={input} id="deck-comment-body" rows={3} maxLength={COMMENT_LIMIT} value={body} disabled={posting} onChange={event => { setBody(event.target.value); setSuccess(null); }} placeholder={replyTo ? "Write your reply…" : "Share a question, suggestion or your experience with this deck."} required />
    <div className={styles.composerActions}><span>{body.length}/{COMMENT_LIMIT}</span>{replyTo && <button type="button" disabled={posting || saving} onClick={() => setReplyTo(null)}>Cancel reply</button>}<button type="submit" disabled={!authReady || busy || !body.trim()}>{posting ? "Posting..." : replyTo ? "Post reply" : "Post comment"}</button></div>
    {postError && <p role="alert" className={styles.error}>{postError}</p>}
    <p className={styles.hint}>Your name, avatar and player profile are visible with your comment.</p>
  </form>;

  return <section className={styles.discussion} aria-labelledby="deck-discussion-title">
    <div className={styles.heading}><h3 id="deck-discussion-title">Comments</h3><button type="button" disabled={busy} onClick={() => { setReplyTo(null); setCommentAction(null); setSuccess(null); setReload(value => value + 1); }}>Refresh</button></div>
    {!authReady ? <p role="status">Loading account...</p> : !userId && <p>Sign in with Discord to comment or reply.</p>}
    {!replyTo && composer}
    {success && <p role="status" className={styles.success}>{success}</p>}
    {loading && <p role="status">Loading comments...</p>}
    {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
    {!loading && !loadError && comments.length === 0 && <p>No comments yet. Start the conversation.</p>}
    <ol className={styles.commentList}>{commentThreads(comments).map(({ comment, depth }) => {
      const parent = comments.find(item => item.id === comment.parentId);
      const action = commentAction?.comment.id === comment.id ? commentAction : null;
      const editId = `edit-comment-${comment.id}`;
      return <li key={comment.id} className={styles.comment} style={{ marginInlineStart: `${Math.min(depth, 3) * 16}px` }}>
        <article aria-label={`Comment by ${comment.author?.name || "Player"}`}>
          <div className={styles.commentHeader}>
            <Link className={styles.identity} to={`/players/${comment.authorId}`}><PlayerAvatar name={comment.author?.name || "Player"} avatar={comment.author?.avatar || ""} className={styles.avatar} /><span>{comment.author?.name || "Player"}</span></Link>
            {comment.authorId === ownerId && <span className={styles.creator}>Deck creator</span>}
            <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
          </div>
          {comment.parentId && <span className={styles.replyContext}>Reply to {parent?.author?.name || "a comment"}</span>}
          {action?.kind !== "edit" && <p className={styles.body}>{comment.body}</p>}
          {userId && !action && <div className={styles.commentActions}>
            <button type="button" disabled={busy} onClick={() => { setReplyTo(comment); setPostError(null); setSuccess(null); }}>Reply</button>
            {authReady && comment.authorId === userId && <>
              <button type="button" disabled={busy || Boolean(commentAction)} onClick={() => openAction({ kind: "edit", comment, body: comment.body })}>Edit</button>
              <button type="button" className={styles.delete} disabled={busy || Boolean(commentAction)} onClick={() => openAction({ kind: "delete", comment })}>Delete</button>
            </>}
          </div>}
          {action && <form className={styles.composer} onSubmit={event => void submitCommentAction(event)}>
            {action.kind === "edit" ? <>
              <label htmlFor={editId}>Edit your comment</label>
              <textarea id={editId} rows={3} maxLength={COMMENT_LIMIT} value={action.body} disabled={saving} onChange={event => setCommentAction({ ...action, body: event.target.value })} autoFocus required />
              <div className={styles.composerActions}>
                <span>{action.body.length}/{COMMENT_LIMIT}</span>
                <button type="button" disabled={saving} onClick={() => setCommentAction(null)}>Cancel</button>
                <button type="submit" disabled={busy || !action.body.trim() || action.body.trim() === comment.body}>{saving ? "Saving..." : "Save changes"}</button>
              </div>
            </> : <>
              <p className={styles.deletePrompt}>Delete this comment? Any replies will stay visible.</p>
              <div className={styles.commentActions}>
                <button type="button" disabled={saving} onClick={() => setCommentAction(null)} autoFocus>Cancel</button>
                <button type="submit" className={styles.delete} disabled={busy}>{saving ? "Deleting..." : "Delete comment"}</button>
              </div>
            </>}
            {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
          </form>}
        </article>
        {replyTo?.id === comment.id && composer}
      </li>;
    })}</ol>
    {hasMore && <button type="button" disabled={busy} onClick={() => void loadMore()}>{loadingMore ? "Loading..." : "Load more comments"}</button>}
  </section>;
}

export default function DeckDiscussion({ deckId, ownerId }: { deckId: string; ownerId: string }) {
  const { user, authReady } = useOutletContext<AuthSession>();
  return <Discussion key={`${deckId}:${user?.id ?? "guest"}`} deckId={deckId} ownerId={ownerId} userId={user?.id} authReady={authReady} />;
}
