import { supabase } from "./supabaseClient";
import { PUBLIC_DECK_SORTS, privateDeckCopy, safeProfileUrl, type PublicDeck, type PublicDeckSort, type PublicProfile } from "../domain/publicDecks";
import type { Deck } from "../types/Deck";

const PAGE_SIZE = 24;
const COLUMNS = "id, owner_id, name, description, faction, protagonist_id, content, background_image_path, updated_at, published_at";
type ProfileRow = { id: string; name: string; avatar: string; bio: string; favorite_chronicle: string; website: string };
type PublicRow = {
  id: string; owner_id: string; name: string; description: string; faction: string; protagonist_id: string | null;
  content: Pick<Deck, "persona" | "deck" | "sideboard">;
  background_image_path: string | null; updated_at: string; published_at: string;
};
type ListedRow = PublicRow & {
  like_count: number; view_count: number; import_count: number; liked_by_viewer: boolean;
};

function client() {
  if (!supabase) throw new Error("Public decks are not configured yet.");
  return supabase;
}

function profile(row: ProfileRow): PublicProfile {
  return { id: row.id, name: row.name, avatar: safeProfileUrl(row.avatar), bio: row.bio,
    favoriteChronicle: row.favorite_chronicle, website: safeProfileUrl(row.website) };
}

export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await client().from("player_profiles")
    .select("id, name, avatar, bio, favorite_chronicle, website").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? profile(data as ProfileRow) : null;
}

export async function getPublicProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  if (!ids.length) return new Map();
  const { data, error } = await client().from("player_profiles")
    .select("id, name, avatar, bio, favorite_chronicle, website").in("id", [...new Set(ids)]);
  if (error) throw error;
  return new Map((data as ProfileRow[]).map(row => [row.id, profile(row)]));
}

export async function listPublicDecks({ search = "", faction = "", ownerId, page = 0, sort = "newest" }: {
  search?: string; faction?: string; ownerId?: string; page?: number; sort?: PublicDeckSort;
} = {}): Promise<{ decks: PublicDeck[]; hasMore: boolean }> {
  let query = client().from("published_decks").select(`${COLUMNS}, like_count, view_count, import_count, liked_by_viewer`);
  if (faction) query = query.eq("faction", faction);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (search.trim()) query = query.ilike("name", `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`);
  const { column, ascending } = PUBLIC_DECK_SORTS[sort];
  query = query.order(column, { ascending });
  if (column !== "published_at") query = query.order("published_at", { ascending: false });
  const { data, error } = await query.order("id")
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (error) throw error;
  const rows = (data as ListedRow[]).slice(0, PAGE_SIZE);
  if (!rows.length) return { decks: [], hasMore: false };
  const byId = await getPublicProfiles(rows.map(row => row.owner_id));
  const decks = await Promise.all(rows.map(async (row): Promise<PublicDeck> => {
    let backgroundImage: string | null = null;
    if (row.background_image_path) {
      const { data } = await client().storage.from("deck-backgrounds").createSignedUrl(row.background_image_path, 3600);
      backgroundImage = data?.signedUrl ?? null;
    }
    return { id: row.id, ownerId: row.owner_id, author: byId.get(row.owner_id) ?? null,
      name: row.name, description: row.description, faction: row.faction, protagonist: row.protagonist_id,
      persona: row.content.persona, deck: row.content.deck, sideboard: row.content.sideboard, backgroundImage,
      updatedAt: Date.parse(row.updated_at), publishedAt: Date.parse(row.published_at), visibility: "public",
      likeCount: row.like_count, viewCount: row.view_count, importCount: row.import_count, likedByViewer: row.liked_by_viewer };
  }));
  return { decks, hasMore: data.length > PAGE_SIZE };
}

export async function fetchPublicDeckCopy(id: string) {
  // Recheck visibility at import time, including after an author withdraws a deck.
  const { data, error } = await client().from("decks").select(COLUMNS)
    .eq("id", id).eq("visibility", "public").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This deck is no longer public. Refresh the collection.");
  const row = data as PublicRow;
  return privateDeckCopy({ id: row.id, name: row.name, description: row.description, faction: row.faction,
    protagonist: row.protagonist_id, persona: row.content.persona, deck: row.content.deck,
    sideboard: row.content.sideboard, updatedAt: 0 });
}

export async function setPublicDeckLike(id: string, liked: boolean): Promise<number> {
  const { data, error } = await client().rpc("set_public_deck_like", { p_deck_id: id, p_liked: liked });
  if (error) throw error;
  return data;
}

export async function recordPublicDeckView(id: string): Promise<number> {
  const { data, error } = await client().rpc("record_public_deck_view", { p_deck_id: id });
  if (error) throw error;
  return data;
}

export async function importCloudPublicDeck(id: string): Promise<{ id: string; name: string; importCount: number }> {
  const copyId = crypto.randomUUID();
  const request = () => client().rpc("import_public_deck", { p_deck_id: id, p_copy_id: copyId }).single();
  const first = await request();
  const { data, error } = first.status === 0 ? await request() : first;
  if (error) throw new Error(error.message);
  const row = data as { id: string; name: string; import_count: number };
  return { id: row.id, name: row.name, importCount: row.import_count };
}

export async function recordLocalPublicDeckImport(id: string, copyId: string): Promise<number> {
  const request = () => client().rpc("record_local_public_deck_import", { p_deck_id: id, p_copy_id: copyId });
  const first = await request();
  const { data, error } = first.status === 0 ? await request() : first;
  if (error) throw error;
  return data;
}
