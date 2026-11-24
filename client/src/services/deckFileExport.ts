import { SECTION_LABELS, type DeckSection } from "../domain/deckBuilder.ts";
import type { Deck, DeckEntry } from "../types/Deck.ts";
import { getAllCards } from "./cardDataService.ts";

export type DeckFileFormat = "txt" | "xlsx";

export async function createDeckFile(deck: Deck, chronicle: string, format: DeckFileFormat, { includeSideboard = false } = {}) {
  const cards = new Map((await getAllCards({ includePrintings: true })).map(card => [card.id.toLowerCase(), card]));
  const entries: [DeckSection, DeckEntry[]][] = [
    ["protagonist", deck.protagonist ? [{ id: deck.protagonist, qty: 1 }] : []],
    ["persona", deck.persona.map(id => ({ id, qty: 1 }))],
    ["deck", deck.deck],
  ];
  if (includeSideboard) entries.push(["sideboard", deck.sideboard ?? []]);

  const sections = entries.map(([section, cardsInSection]) => {
    const rows = cardsInSection.filter(entry => entry.qty > 0).map(({ id, qty }) => {
      const card = cards.get(id.toLowerCase());
      return { qty, name: card?.name ?? "", code: card?.setId || id, type: card?.type ?? "" };
    });
    return { label: SECTION_LABELS[section], total: rows.reduce((sum, row) => sum + row.qty, 0), rows };
  });
  const name = deck.name.trim() || "Untitled deck";
  const description = deck.description?.trim().replace(/\r\n?/g, "\n");
  const filenameBase = name.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").replace(/[. ]+$/, "");
  const filename = `astralia-${filenameBase || "deck"}.${format}`;

  if (format === "txt") {
    const lines = [
      name,
      `Chronicle: ${chronicle}`,
      ...sections.flatMap(({ label, total, rows }) => [
        "",
        `${label} (${total})`,
        ...rows.map(({ qty, name, code }) => `${qty}x ${name ? `${name} [${code}]` : code}`),
      ]),
      ...(description ? ["", "Description", ...description.split("\n")] : []),
      "",
    ];
    return { filename, blob: new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" }) };
  }

  const { default: writeExcelFile } = await import("write-excel-file/universal");
  const header = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#262333", color: "#FFFFFF" });
  const summary = [
    ["Deck", name],
    ["Chronicle", chronicle],
    ...sections.map(({ label, total }) => [label, total]),
    ...(description ? [["Description", { value: description, wrap: true }]] : []),
  ];
  const cardRows = sections.flatMap(({ label, rows }) => rows.map(card => [label, card.qty, card.name, card.code, card.type]));
  const blob = await writeExcelFile([
    {
      sheet: "Summary",
      columns: [{ width: 20 }, { width: 56 }],
      data: [[header("Field"), header("Value")], ...summary],
    },
    {
      sheet: "Cards",
      columns: [{ width: 18 }, { width: 10 }, { width: 46 }, { width: 20 }, { width: 17 }],
      stickyRowsCount: 1,
      data: [["Section", "Quantity", "Card", "Printing code", "Type"].map(header), ...cardRows],
    },
  ]).toBlob();
  return { filename, blob };
}
