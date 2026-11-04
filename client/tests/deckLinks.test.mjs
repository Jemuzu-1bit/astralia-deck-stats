import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { exportDeck, importDeck } from "../src/services/deckService.ts";
import { deflateToBase64Url, inflateBase64Url } from "../src/services/deckShareCodec.ts";

const csv = await readFile(new URL("../public/data/cards.csv", import.meta.url), "utf8");
globalThis.fetch = async (url) => {
  assert.equal(url, "/data/cards.csv");
  return new Response(csv);
};
test("official share links keep new AOR card IDs and copies", async () => {
  const deck = {
    id: "saved-deck",
    name: "New AOR cards",
    faction: "purple",
    protagonist: "aor_05_001_ex",
    persona: ["aor_05_004_ex"],
    deck: [{ id: "aor_05_037_n", qty: 2 }, { id: "aor_05_014_n", qty: 3 }],
    updatedAt: 1,
  };
  const link = await exportDeck(deck);
  const url = new URL(link);
  assert.equal(url.origin, "https://www.astraliachronicles.com");
  assert.equal(url.pathname, "/deck-import");
  const deckData = url.searchParams.get("deckData");
  assert.ok(deckData);
  const payload = JSON.parse(await inflateBase64Url(deckData));
  assert.deepEqual(Object.keys(payload).sort(), ["deckCards", "faction", "hasError", "id", "image", "imageKey", "name", "personaDeck", "protagonist"]);
  assert.deepEqual(payload.deckCards, { AOR_05_037_N: 2, AOR_05_014_N: 3 });
  assert.deepEqual(await importDeck(link), {
    name: deck.name,
    faction: deck.faction,
    protagonist: deck.protagonist,
    persona: deck.persona,
    deck: deck.deck,
    backgroundImage: null,
  });
});

test("existing official and compact links remain importable", async () => {
  const official = {
    deckCards: { AOR_05_037_N: 2 },
    personaDeck: { AOR_05_004_EX: 1 },
    protagonist: { AOR_05_001_EX: 1 },
    name: "Official deck",
  };
  const officialLink = `https://www.astraliachronicles.com/deck-import?deckData=${await deflateToBase64Url(JSON.stringify(official))}`;
  const importedOfficial = await importDeck(officialLink);
  assert.deepEqual(importedOfficial.deck, [{ id: "aor_05_037_n", qty: 2 }]);
  assert.deepEqual(importedOfficial.persona, ["aor_05_004_ex"]);
  assert.equal(importedOfficial.protagonist, "aor_05_001_ex");

  const compactCode = btoa(JSON.stringify({
    v: 1, n: "Old deck", f: "purple", p: "aor_05_001_ex",
    pe: ["aor_05_004_ex"], d: [["aor_05_037_n", 2]],
  }));
  const importedCompact = await importDeck(compactCode);
  assert.equal(importedCompact.name, "Old deck");
  assert.deepEqual(importedCompact.deck, [{ id: "aor_05_037_n", qty: 2 }]);
});

test("official app links with base64 padding remain importable", async () => {
  const link = "https://www.astraliachronicles.com/deck-import?deckData=eNplkc1qAyEQgF9lmbMHx59s6i0k6aVQCoWSm0jWbKSNBt0eSsjr9EX6Yh22W5q6Bxn85nNm1At0fv-6drkrYC6wWT9bLi1HYR_BKAarpx3tLOd3djWhX0cuKyDaCuCiBroGsxpYd5kVVfWRcVZxA0ZDXhkc3H4IKVIWJbZaa9UyOLqyzTllMAf3VjyD0JG9oHhyvf9xhUSl2wk9-A8w4ztZRGAQ3Yk0ePFxeG-OLjR9-Ppszj6XRNkxRrch_fZFaW13YPBvTK7sfc2Qz6zl3KLPmBjd8ZzT4PoUQxn-9ROTcf0G4aeDWA==";
  const deck = await importDeck(link);
  assert.equal(deck.protagonist, "dcs_03_002ex");
  assert.equal(deck.deck.reduce((total, card) => total + card.qty, 0), 45);
  assert.equal(deck.persona.length, 5);
});

test("local links generated before the format change remain importable", async () => {
  const local = {
    v: 2, n: "Variant deck", f: "purple", p: "aor_05_001_ex",
    pe: ["aor_05_004_ex"], d: [["dcs05015p", 1]],
  };
  const link = `https://decks.example/my-decks?deck=${await deflateToBase64Url(JSON.stringify(local))}`;
  const imported = await importDeck(link);
  assert.deepEqual(imported.deck, [{ id: "dcs05015p", qty: 1 }]);
});

test("shared links reject cards absent from the current catalog", async () => {
  const invalid = { v: 2, n: "Unknown", f: "purple", p: null, pe: [], d: [["unknown_card", 1]] };
  const link = `https://decks.example/my-decks?deck=${await deflateToBase64Url(JSON.stringify(invalid))}`;
  await assert.rejects(importDeck(link), /Card not found in catalog/);
});
