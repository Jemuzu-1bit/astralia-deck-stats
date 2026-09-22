import Papa from "papaparse";
import type { Card } from "../types/Card.ts";

let cache: Card[] | null = null;

export function isAlternativeArt(card: Pick<Card, "setId">): boolean {
  return /\s(?:P|SR|SSR)$/i.test(card.setId);
}

export async function readCardData(): Promise<Card[]> {
  if (cache) return cache;

  const response = await fetch("/data/cards.csv");
  const csvText = await response.text();

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  cache = result.data.map((r) => ({
    id: r.id,
    setId: r.setId,
    name: r.name,
    faction: r.faction,
    mainDeck: r.mainDeck,
    cost: r.cost,
    type: r.type,
    subtype: r.subtype,
    sets: r.sets,
    atk: r.atk || undefined,
    hp: r.hp || undefined,
    keywords: r.keywords || undefined,
    flip: r.flip?.toLowerCase() === "true",
    face: Number(r.face),
    singularity: r.singularity?.toLowerCase() === "true",
    description: r.description || undefined,
    imageId: r.imageId,
  }));

  return cache;
}
