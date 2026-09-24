import type { Card } from "../types/Card.ts";

export type CardImageVariant = "thumb" | "full";

export function getCardImagePath(
  card: Card,
  variant: CardImageVariant = "thumb"
): string {
  const faction = card.faction.toLowerCase();
  const imageId = card.imageId.toLowerCase();

  return `/cards/${faction}/${imageId}-${variant}.webp`;
}

export function getImagePath(
  faction: string,
  imageId: string,
  variant: CardImageVariant = "thumb"
): string {
  const normalizedImageId = imageId.toLowerCase();
  return `/cards/${faction.toLowerCase()}/${normalizedImageId}-${variant}.webp`;
}
