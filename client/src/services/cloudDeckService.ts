import type { User } from "@supabase/supabase-js";
import type { Deck } from "../types/Deck";
import { supabase } from "./supabaseClient";

type DeckInput = Omit<Deck, "id" | "updatedAt">;
type DeckRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  faction: string;
  protagonist_id: string | null;
  content: { persona: string[]; deck: Deck["deck"] };
  background_image_path: string | null;
  updated_at: string;
  revision: number;
  visibility: "private" | "public";
  published_at: string | null;
};

const BUCKET = "deck-backgrounds";
const imagePaths = new Map<string, string | null>();

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function currentUser(): Promise<User> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error("Sign in to save decks online.");
  return data.user;
}

async function mapRow(row: DeckRow): Promise<Deck> {
  imagePaths.set(row.id, row.background_image_path);
  let backgroundImage: string | null = null;
  if (row.background_image_path) {
    const { data, error } = await client().storage.from(BUCKET).createSignedUrl(row.background_image_path, 24 * 60 * 60);
    if (!error) backgroundImage = data.signedUrl;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    faction: row.faction,
    protagonist: row.protagonist_id,
    persona: row.content.persona,
    deck: row.content.deck,
    backgroundImage,
    updatedAt: Date.parse(row.updated_at),
    revision: row.revision,
    visibility: row.visibility,
    publishedAt: row.published_at ? Date.parse(row.published_at) : null,
  };
}

export async function listCloudDecks(): Promise<Deck[]> {
  const user = await currentUser();
  const { data, error } = await client().from("decks")
    .select("id, owner_id, name, description, faction, protagonist_id, content, background_image_path, updated_at, revision, visibility, published_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data as DeckRow[]).map(mapRow));
}

async function uploadBackground(userId: string, deckId: string, dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.type) || blob.size > 5 * 1024 * 1024) {
    throw new Error("Background must be a PNG, JPEG, WebP or GIF under 5 MB.");
  }
  const extension = blob.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${deckId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client().storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

export async function createCloudDeck(input: DeckInput, importKey?: string): Promise<Deck> {
  const user = await currentUser();
  const id = crypto.randomUUID();
  const path = input.backgroundImage?.startsWith("data:")
    ? await uploadBackground(user.id, id, input.backgroundImage)
    : null;
  const { data, error } = await client().from("decks").insert({
    id,
    owner_id: user.id,
    import_key: importKey ?? null,
    name: input.name,
    description: input.description ?? "",
    faction: input.faction,
    protagonist_id: input.protagonist ?? null,
    content: { persona: input.persona, deck: input.deck },
    background_image_path: path,
  }).select("id, owner_id, name, description, faction, protagonist_id, content, background_image_path, updated_at, revision, visibility, published_at").single();
  if (error) {
    if (path) await client().storage.from(BUCKET).remove([path]);
    throw error;
  }
  return mapRow(data as DeckRow);
}

export async function importLocalDecks(decks: Deck[]): Promise<number> {
  const user = await currentUser();
  const { data, error } = await client().from("decks").select("import_key").eq("owner_id", user.id).not("import_key", "is", null);
  if (error) throw error;
  const imported = new Set(data.map((row) => row.import_key));
  let count = 0;
  for (const deck of decks) {
    if (imported.has(deck.id)) continue;
    try {
      await createCloudDeck(deck, deck.id);
      imported.add(deck.id);
      count++;
    } catch (error) {
      // A retry after a lost response may find an already imported deck.
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        imported.add(deck.id);
        continue;
      }
      throw error;
    }
  }
  return count;
}

export async function updateCloudDeck(deck: Deck): Promise<Deck> {
  const user = await currentUser();
  if (!Number.isInteger(deck.revision)) throw new Error("Reload the deck before editing it.");
  const oldPath = imagePaths.get(deck.id) ?? null;
  const newPath = deck.backgroundImage?.startsWith("data:")
    ? await uploadBackground(user.id, deck.id, deck.backgroundImage)
    : deck.backgroundImage ? oldPath : null;
  const { data, error } = await client().from("decks").update({
    name: deck.name,
    description: deck.description ?? "",
    faction: deck.faction,
    protagonist_id: deck.protagonist ?? null,
    content: { persona: deck.persona, deck: deck.deck },
    background_image_path: newPath,
  }).eq("id", deck.id).eq("owner_id", user.id).eq("revision", deck.revision!)
    .select("id, owner_id, name, description, faction, protagonist_id, content, background_image_path, updated_at, revision, visibility, published_at").single();
  if (error) {
    if (newPath && newPath !== oldPath) await client().storage.from(BUCKET).remove([newPath]);
    if (error.code === "PGRST116") throw new Error("This deck changed on another device. Reload before saving again.");
    throw error;
  }
  if (oldPath && oldPath !== newPath) await client().storage.from(BUCKET).remove([oldPath]);
  return mapRow(data as DeckRow);
}

export async function deleteCloudDeck(id: string): Promise<void> {
  const user = await currentUser();
  const path = imagePaths.get(id);
  const { error } = await client().from("decks").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  imagePaths.delete(id);
  if (path) await client().storage.from(BUCKET).remove([path]);
}

export async function setDeckVisibility(deck: Deck, visibility: "private" | "public", description?: string): Promise<Deck> {
  const user = await currentUser();
  if (!Number.isInteger(deck.revision)) throw new Error("Reload the deck before publishing it.");
  const { data, error } = await client().from("decks").update({ visibility, ...(description !== undefined ? { description: description.trim() } : {}) })
    .eq("id", deck.id).eq("owner_id", user.id).eq("revision", deck.revision!)
    .select("id, owner_id, name, description, faction, protagonist_id, content, background_image_path, updated_at, revision, visibility, published_at").single();
  if (error) {
    if (error.code === "PGRST116") throw new Error("This deck changed on another device. Reload before changing its visibility.");
    throw error;
  }
  return mapRow(data as DeckRow);
}
