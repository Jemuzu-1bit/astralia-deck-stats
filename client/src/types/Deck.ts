export interface DeckEntry {
  id: string;
  qty: number;
}

export interface Deck {
  id: string;
  name: string;
  faction: string;
  protagonist?: string | null;
  persona: string[];
  deck: DeckEntry[];
  backgroundImage?: string | null;
  updatedAt: number;
  revision?: number;
  visibility?: "private" | "public";
  publishedAt?: number | null;
}
