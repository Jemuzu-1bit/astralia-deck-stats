import Papa from "papaparse";
import type { Card } from "../types/Card.ts";
import { officialPrintingBaseIds } from "./officialCardPrintings.ts";

let cache: Promise<Card[]> | undefined;

const standardPrintIds = new Map([
  ["dcs01015sr", "dcs_01_015n"],
  ["dcs01017p", "dcs_01_017n"],
  ["dcs01036p", "dcs_01_036n"],
  ["dcs02018p", "dcs_02_018n"],
  ["dcs02033sr", "dcs_02_033n"],
  ["dcs02035p", "dcs_02_035n"],
  ["dcs03016p", "dcs_03_016n"],
  ["dcs03025sr", "dcs_03_025n"],
  ["dcs03037p", "dcs_03_037n"],
  ["dcs04013p", "dcs04013n"],
  ["dcs04015sr", "dcs04015n"],
  ["dcs04035p", "dcs04035n"],
  ["dcs05015p", "dcs05015n"],
  ["dcs05021sr", "dcs05021n"],
  ["dcs05035p", "dcs05035n"],
  ["ks_02_009_pr", "aor_04_001_ex"],
  ["ls_01_001_ssr", "dcs_01_023n"],
  ["ls_01_002_ssr", "dcs_01_024n"],
  ["ls_01_003_ssr", "dcs_02_037n"],
  ["ls_01_004_ssr", "dcs_03_019n"],
  ["ls_01_005_ssr", "dcs04024n"],
  ["ls_01_006_ssr", "dcs05014n"],
  ["ls_01_007_ssr", "dcs05028n"],
]);

export function isAlternativeArt(card: Pick<Card, "id" | "setId">): boolean {
  return /\s(?:P|SR|SSR)$/i.test(card.setId) || officialPrintingBaseIds.has(card.id);
}

export function getCardPrintingGroup(cardOrId: Pick<Card, "id"> | string): string {
  const id = (typeof cardOrId === "string" ? cardOrId : cardOrId.id).trim().toLowerCase();
  return standardPrintIds.get(id) ?? officialPrintingBaseIds.get(id) ?? id;
}

/** APX A and B appear separately in the builder and share the same deck limit. */
export function getCardIdentity(cardOrId: Pick<Card, "id"> | string): string {
  return getCardPrintingGroup(cardOrId).replace(/^(apx_[^_]+_[^_]+)_[ab](_n)$/, "$1_a$2");
}

export function getCardRarity(card: Pick<Card, "setId">): string {
  return card.setId.trim().split(/\s+/).at(-1)?.toUpperCase() ?? "";
}

async function loadCardData(): Promise<Card[]> {
  const response = await fetch("/data/cards.csv");
  if (!response.ok) throw new Error("Could not load the card catalog.");
  const csvText = await response.text();

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data.map((r) => ({
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

}

export function readCardData(): Promise<Card[]> {
  cache ??= loadCardData().catch(error => {
    cache = undefined;
    throw error;
  });
  return cache;
}
