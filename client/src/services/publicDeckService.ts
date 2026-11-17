import { supabase } from "./supabaseClient";
import { privateDeckCopy, safeProfileUrl, type PublicDeck, type PublicProfile } from "../domain/publicDecks";

const PAGE_SIZE = 24;
const COLUMNS = "id, owner_id, name, faction, protagonist_id, content, background_image_path, updated_at, published_at";
type ProfileRow = { id: string; name: string; avatar: string; bio: string; favorite_chronicle: string; website: string };
type PublicRow = {
  id: string; owner_id: string; name: string; faction: string; protagonist_id: string | null;
  content: { persona: string[]; deck: { id: string; qty: number }[] };
  background_image_path: string | null; updated_at: string; published_at: string;
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

export async function listPublicDecks({ search = "", faction = "", ownerId, page = 0 }: {
  search?: string; faction?: string; ownerId?: string; page?: number;
} = {}): Promise<{ decks: PublicDeck[]; hasMore: boolean }> {
  let query = client().from("decks").select(COLUMNS).eq("visibility", "public");
  if (faction) query = query.eq("faction", faction);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (search.trim()) query = query.ilike("name", `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query.order("published_at", { ascending: false }).order("id")
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (error) throw error;
  const rows = (data as PublicRow[]).slice(0, PAGE_SIZE);
  if (!rows.length) return { decks: [], hasMore: false };
  const { data: authors, error: authorError } = await client().from("player_profiles")
    .select("id, name, avatar, bio, favorite_chronicle, website").in("id", [...new Set(rows.map(row => row.owner_id))]);
  if (authorError) throw authorError;
  const byId = new Map((authors as ProfileRow[]).map(row => [row.id, profile(row)]));
  const decks = await Promise.all(rows.map(async (row): Promise<PublicDeck> => {
    let backgroundImage: string | null = null;
    if (row.background_image_path) {
      const { data } = await client().storage.from("deck-backgrounds").createSignedUrl(row.background_image_path, 3600);
      backgroundImage = data?.signedUrl ?? null;
    }
    return { id: row.id, ownerId: row.owner_id, author: byId.get(row.owner_id) ?? null,
      name: row.name, faction: row.faction, protagonist: row.protagonist_id,
      persona: row.content.persona, deck: row.content.deck, backgroundImage,
      updatedAt: Date.parse(row.updated_at), publishedAt: Date.parse(row.published_at), visibility: "public" };
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
  return privateDeckCopy({ id: row.id, name: row.name, faction: row.faction,
    protagonist: row.protagonist_id, persona: row.content.persona, deck: row.content.deck, updatedAt: 0 });
}
