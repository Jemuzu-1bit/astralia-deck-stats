export const DEFAULT_FRAGMENT_IMAGE_ID = "gf_01_001_pr";

const STORAGE_KEY = "astralia.fragmentImage";

export function savedFragmentImage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveFragmentImage(imageId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, imageId);
  } catch { /* The room selection also works without browser storage. */ }
}
