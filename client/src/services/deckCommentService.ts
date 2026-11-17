import { supabase } from "./supabaseClient";
import { getPublicProfiles } from "./publicDeckService";
import { getPlayerProfile } from "../domain/playerProfile";
import { commentBody, type DeckComment } from "../domain/deckComments";

const COLUMNS = "id, deck_id, author_id, parent_id, body, created_at";
const PAGE_SIZE = 50;
type Row = { id: string; deck_id: string; author_id: string; parent_id: string | null; body: string; created_at: string };
export type CommentCursor = { id: string; createdAt: string };
function client() {
  if (!supabase) throw new Error("Online comments are not configured.");
  return supabase;
}
function mapRow(row: Row): DeckComment {
  return { id: row.id, deckId: row.deck_id, authorId: row.author_id, parentId: row.parent_id,
    body: row.body, createdAt: row.created_at, author: null };
}

export async function listDeckComments(deckId: string, cursor: CommentCursor | null = null) {
  let query = client().from("deck_comments").select(COLUMNS).eq("deck_id", deckId);
  if (cursor) query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
  const { data, error } = await query.order("created_at").order("id").limit(PAGE_SIZE + 1);
  if (error) throw error;
  const rows = (data as Row[]).slice(0, PAGE_SIZE);
  const profiles = await getPublicProfiles(rows.map(row => row.author_id));
  const comments = rows.map(row => ({ ...mapRow(row), author: profiles.get(row.author_id) ?? null }));
  const last = comments.at(-1);
  return { comments, hasMore: data.length > PAGE_SIZE, cursor: last ? { id: last.id, createdAt: last.createdAt } : cursor };
}

export async function postDeckComment({ id, deckId, parentId, body, userId }: {
  id: string; deckId: string; parentId: string | null; body: string; userId: string;
}): Promise<DeckComment> {
  const text = commentBody(body);
  const { data: auth, error: authError } = await client().auth.getUser();
  if (authError || !auth.user || auth.user.id !== userId) throw new Error("Sign in again before posting your comment.");
  const result = await client().from("deck_comments").insert({ id, deck_id: deckId, author_id: userId, parent_id: parentId, body: text }).select(COLUMNS).single();
  let row = result.data as Row | null;
  if (result.error?.code === "23505") {
    // A lost response can be retried without creating a second comment.
    const existing = await client().from("deck_comments").select(COLUMNS).eq("id", id).eq("author_id", userId).maybeSingle();
    row = existing.data as Row | null;
    if (!row || row.deck_id !== deckId || row.parent_id !== parentId || row.body !== text) throw new Error("Could not confirm your comment. Please refresh the discussion.");
  } else if (result.error) {
    throw new Error("Could not post your comment. The deck or reply may no longer be public. Please try again.");
  }
  if (!row) throw new Error("Could not confirm your comment.");
  return { ...mapRow(row), author: { id: userId, ...getPlayerProfile(auth.user) } };
}
