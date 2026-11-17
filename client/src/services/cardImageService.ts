import type { Card } from "../types/Card.ts";

export type CardImageVariant = "thumb" | "full";

// Use the same /cards tree on a Cloudflare custom domain when it is ready.
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
  return `${cardImageOrigin}/cards/${faction.toLowerCase()}/${normalizedImageId}-${variant}.webp`;
}
