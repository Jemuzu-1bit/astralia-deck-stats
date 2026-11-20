import type { Deck } from "../types/Deck.ts";
import { profileWebsite } from "./playerProfile.ts";

export type PublicProfile = {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  favoriteChronicle: string;
  website: string;
};

export type PublicDeckEngagement = {
  likeCount: number;
  viewCount: number;
  importCount: number;
  likedByViewer: boolean;
};

export type PublicDeck = Deck & PublicDeckEngagement & { ownerId: string; author: PublicProfile | null };

export const PUBLIC_DECK_SORTS = {
  newest: { column: "published_at", ascending: false, label: "Newest first" },
  mostLikes: { column: "like_count", ascending: false, label: "Most likes" },
  fewestLikes: { column: "like_count", ascending: true, label: "Fewest likes" },
  mostViews: { column: "view_count", ascending: false, label: "Most views" },
  fewestViews: { column: "view_count", ascending: true, label: "Fewest views" },
  mostImports: { column: "import_count", ascending: false, label: "Most imports" },
  fewestImports: { column: "import_count", ascending: true, label: "Fewest imports" },
} as const;

export type PublicDeckSort = keyof typeof PUBLIC_DECK_SORTS;

export function safeProfileUrl(value: string): string {
  try { return profileWebsite(value); } catch { return ""; }
}

// Copies never retain another player's ID, revision, publication or storage path.
export function privateDeckCopy(deck: Deck): Omit<Deck, "id" | "updatedAt"> {
  return {
    name: deck.name,
    ...(deck.description !== undefined ? { description: deck.description } : {}),
    faction: deck.faction,
    protagonist: deck.protagonist ?? null,
    persona: [...deck.persona],
    deck: deck.deck.map(entry => ({ id: entry.id, qty: entry.qty })),
    ...(deck.sideboard?.length ? { sideboard: deck.sideboard.map(({ id, qty }) => ({ id, qty })) } : {}),
    backgroundImage: null,
    visibility: "private",
    publishedAt: null,
  };
}
