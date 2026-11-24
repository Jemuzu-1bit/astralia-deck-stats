import type { Card } from "../types/Card.ts";

export type CardImageVariant = "thumb" | "full";

// The Cloudflare Worker serves the same /cards tree from R2 when configured.
const cardImageOrigin = import.meta.env.VITE_CARD_IMAGE_BASE_URL?.replace(/\/+$/, "") ?? "";

export function getCardImagePath(
  card: Card,
  variant: CardImageVariant = "thumb"
): string {
  return getImagePath(card.faction, card.imageId, variant);
}

export function getImagePath(
  faction: string,
  imageId: string,
  variant: CardImageVariant = "thumb"
): string {
  const normalizedImageId = imageId.toLowerCase();
  const directory = faction.toLowerCase() || "neutral";
  return `${cardImageOrigin}/cards/${directory}/${normalizedImageId}-${variant}.webp`;
}
