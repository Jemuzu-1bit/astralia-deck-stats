import type { Card } from "../types/Card.ts";

export function getCardImagePath(card: Card): string {
  const faction = card.faction.toLowerCase();
  const imageId = card.imageId.toLowerCase();
  const extension = imageId.startsWith("apx_") ? "webp" : "png";

  return new URL(`/src/assets/${faction}/${imageId}.${extension}`, import.meta.url).href;
}

export function getImagePath(faction: string, imageId: string): string {
  const normalizedImageId = imageId.toLowerCase();
  const extension = normalizedImageId.startsWith("apx_") ? "webp" : "png";
  return new URL(`/src/assets/${faction.toLowerCase()}/${normalizedImageId}.${extension}`, import.meta.url).href;
}
