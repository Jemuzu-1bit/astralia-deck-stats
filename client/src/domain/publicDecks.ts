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

export type PublicDeck = Deck & { ownerId: string; author: PublicProfile | null };

export function safeProfileUrl(value: string): string {
  try { return profileWebsite(value); } catch { return ""; }
}

// Copies never retain another player's ID, revision, publication or storage path.
export function privateDeckCopy(deck: Deck): Omit<Deck, "id" | "updatedAt"> {
  return {
    name: deck.name,
    faction: deck.faction,
    protagonist: deck.protagonist ?? null,
    persona: [...deck.persona],
    deck: deck.deck.map(entry => ({ id: entry.id, qty: entry.qty })),
    backgroundImage: null,
    visibility: "private",
    publishedAt: null,
  };
}
