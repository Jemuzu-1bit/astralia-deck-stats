import { isAlternativeArt, readCardData } from "../data/cardDataReader.ts";
import type { Card } from "../types/Card.ts";

export async function getAllCards(): Promise<Card[]> {
  const cards = await readCardData();

  return cards.filter((card) => card.face === 1 && !isAlternativeArt(card));
}

export async function getCardsByField<T extends keyof Card>(
  field: T,
  value: string
): Promise<Card[]> {
  const cards = await getAllCards();
  const target = value.toLowerCase();

  return cards.filter((card) => {
    const fieldValue = card[field];

    if (typeof fieldValue === "string")
      return fieldValue.toLowerCase() === target;

    if (Array.isArray(fieldValue))
      return fieldValue.some((v) => v.toLowerCase() === target);

    return false;
  });
}

export async function getCardFaces(
  id: string
): Promise<{ front?: Card; back?: Card }> {
  const cards = await readCardData();
  const faces = cards.filter(
    (card) => card.id.toLowerCase() === id.toLowerCase()
  );

  const front = faces.find((c) => c.face === 1);
  const back = faces.find((c) => c.face === 2);

  return { front, back };
}
