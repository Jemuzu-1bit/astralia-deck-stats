import type { AugCard } from "../types/AugCard";

export function getCardFilterValues(options: AugCard[]) {
  const costs = new Set<string>();
  const types = new Set<string>();
  const subtypes = new Set<string>();
  const keywords = new Set<string>();
  const atks = new Set<string>();
  const hps = new Set<string>();

  options.forEach((c) => {
    if (
      c.cost !== undefined &&
      c.cost !== null &&
      String(c.cost).trim() !== ""
    )
      costs.add(String(c.cost));
    if (c.type) types.add(c.type);
    if (c.subtype) subtypes.add(c.subtype);
    const rawKeys = (c as AugCard).mergedKeywords ?? c.keywords;
    if (rawKeys) {
      rawKeys
        .split(",")
        .map((k: string) => k.trim())
        .forEach((k: string) => {
          if (k) keywords.add(k);
        });
    }

    // ATK / HP may be present on flipped faces; prefer merged fields when present
    const rawAtks = (c as AugCard).mergedAtk ?? c.atk;
    if (rawAtks) {
      rawAtks
        .split(",")
        .map((a: string) => a.trim())
        .forEach((a: string) => {
          if (a) atks.add(a);
        });
    }

    const rawHps = (c as AugCard).mergedHp ?? c.hp;
    if (rawHps) {
      rawHps
        .split(",")
        .map((h: string) => h.trim())
        .forEach((h: string) => {
          if (h) hps.add(h);
        });
    }
    if (c.atk !== undefined && c.atk !== null && String(c.atk).trim() !== "")
      atks.add(String(c.atk));
    if (c.hp !== undefined && c.hp !== null && String(c.hp).trim() !== "")
      hps.add(String(c.hp));
  });

  const sortNumericLike = (arr: string[]) =>
    arr.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

  return {
    costs: sortNumericLike(Array.from(costs)),
    types: Array.from(types).sort(),
    subtypes: Array.from(subtypes).sort(),
    keywords: Array.from(keywords).sort(),
    atks: sortNumericLike(Array.from(atks)),
    hps: sortNumericLike(Array.from(hps)),
  };

}
