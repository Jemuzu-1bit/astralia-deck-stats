import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import { dealOpeningHand } from "../../server/gameTable.js";
import { getCardIdentity, getCardPrintingGroup } from "../src/data/cardDataReader.ts";
import { officialPrintingBaseIds } from "../src/data/officialCardPrintings.ts";
import { CARD_SETS, addDeckCard, buildDeckPayload, changeSelectionPrinting, filterCards } from "../src/domain/deckBuilder.ts";
import { getAllCards, getCardFaces } from "../src/services/cardDataService.ts";
import { getDeck, saveLocalDeck } from "../src/services/deckService.ts";

const csv = await readFile(new URL("../public/data/cards.csv", import.meta.url), "utf8");
globalThis.fetch = async () => new Response(csv);

function checkArtwork(card) {
  const directory = card.faction.toLowerCase() || "neutral";
  return Promise.all(["thumb", "full"].map(size => access(new URL(
    `../public/cards/${directory}/${card.imageId}-${size}.webp`,
    import.meta.url,
  ))));
}

test("alternate prints are catalogued with their own assets and share the standard card identity", async () => {
  const cards = await getAllCards({ includePrintings: true });
  const alternates = cards.filter(card => getCardPrintingGroup(card) !== card.id);
  assert.equal(alternates.filter(card => card.setId.startsWith("LS-")).length, 7);
  assert.ok(alternates.some(card => card.id === "ks_02_009_pr"));
  for (const printing of alternates) {
    const standard = cards.find(card => card.id === getCardPrintingGroup(printing));
    assert.ok(standard, printing.id);
    assert.equal(printing.faction, standard.faction, printing.id);
    assert.equal(printing.mainDeck, standard.mainDeck, printing.id);
    await checkArtwork(printing);
  }
});

test("the collection shows playable printings and the lobby can still load Fragment artwork", async () => {
  const collection = await getAllCards({ includePrintings: true });
  const withFragments = await getAllCards({ includePrintings: true, includeFragments: true });
  const defaults = await getAllCards();
  for (const [id, baseId] of officialPrintingBaseIds) {
    const { front, back } = await getCardFaces(id);
    const base = await getCardFaces(baseId);
    assert.ok(front && base.front, id);
    assert.equal(collection.includes(front), front.type !== "Fragment", id);
    assert.equal(getCardPrintingGroup(front), baseId);
    assert.equal(front.mainDeck, base.front.mainDeck);
    await checkArtwork(front);
    assert.equal(defaults.includes(front), false);
    if (base.back) {
      assert.equal(back?.id, id);
      assert.equal(back?.name, base.back.name);
      assert.match(back.imageId, /_r_pr$/);
      await checkArtwork(back);
      const player = { protagonistId: id };
      dealOpeningHand(player);
      assert.equal(player.table.protagonist[0].id, id);
      assert.equal(player.table.protagonist[0].hp, Number(base.front.hp));
    }
  }
  const fragments = withFragments.filter(card => card.type === "Fragment");
  assert.deepEqual(fragments.map(card => card.imageId).sort(), [
    "dcs_06_001_gr", "dcs_06_001_n", "gf_01_001_pr", "ks_01_011_pr",
  ]);
  assert.ok(fragments.every(card => !collection.includes(card)));
  await Promise.all(fragments.map(checkArtwork));
});

test("APX A and B have separate printing groups and keep their quantities in a saved deck", async () => {
  const { front: a } = await getCardFaces("apx_01_001_a_n");
  const { front: b } = await getCardFaces("apx_01_001_b_n");
  assert.equal(getCardPrintingGroup(a), a.id);
  assert.equal(getCardPrintingGroup(b), b.id);
  assert.equal(getCardIdentity(a), getCardIdentity(b));

  let selections = { deck: {}, persona: {}, sideboard: {} };
  for (const card of [a, b, b, b]) selections = addDeckCard(selections, "deck", card);
  assert.equal(addDeckCard(selections, "deck", a), selections);
  assert.equal(changeSelectionPrinting(selections.deck, b), selections.deck);
  const payload = buildDeckPayload({
    ...selections, name: "APX deck", faction: "green", protagonist: null, backgroundImage: null,
  });
  assert.deepEqual(payload.deck, [{ id: a.id, qty: 1 }, { id: b.id, qty: 3 }]);
});

test("switching a printing merges copies in place and keeps the copy limit across sections", async () => {
  const { front: standard } = await getCardFaces("dcs04015n");
  const { front: alternate } = await getCardFaces("dcs04015sr");
  const { front: other } = await getCardFaces("dcs04024n");
  let selections = { deck: {}, persona: {}, sideboard: {} };
  selections = addDeckCard(selections, "deck", standard);
  selections = addDeckCard(selections, "deck", other);
  selections = addDeckCard(selections, "deck", alternate);
  selections = addDeckCard(selections, "sideboard", standard);
  selections = addDeckCard(selections, "sideboard", standard);
  assert.equal(addDeckCard(selections, "deck", alternate), selections);

  const deck = changeSelectionPrinting(selections.deck, alternate);
  const sideboard = changeSelectionPrinting(selections.sideboard, alternate);
  assert.deepEqual(Object.keys(deck), [alternate.id, other.id]);
  assert.equal(deck[alternate.id].qty, 2);
  assert.deepEqual(sideboard, { [alternate.id]: { card: alternate, qty: 2 } });
});

test("the collection finds a printing by rarity and set and the builder can search its ID", async () => {
  const cards = await getAllCards({ includePrintings: true });
  const filters = {
    searchText: "", selectedSets: ["KS"], selectedRarities: ["PR"], selectedCosts: [],
    selectedTypes: [], selectedSubtypes: [], selectedKeywords: [], selectedAtks: [], selectedHps: [],
  };
  const [promo] = filterCards(cards, { ...filters, searchText: "Miyako" });
  assert.equal(promo.id, "ks_02_009_pr");
  const { front: standard } = await getCardFaces(getCardIdentity(promo));
  assert.deepEqual(filterCards([standard], {
    ...filters, searchText: "KS-02-009", selectedSets: [], selectedRarities: [],
  }, () => [standard, promo]), [standard]);
});

test("the collection can show just the APX appendix with both A and B cards", async () => {
  assert.ok(CARD_SETS.some(({ code }) => code === "APX"));
  const cards = await getAllCards({ includePrintings: true });
  const filters = {
    searchText: "", selectedSets: ["APX"], selectedRarities: [], selectedCosts: [],
    selectedTypes: [], selectedSubtypes: [], selectedKeywords: [], selectedAtks: [], selectedHps: [],
  };
  const appendix = filterCards(cards, filters);
  assert.deepEqual(appendix, cards.filter(card => card.setId.startsWith("APX-")));
  const theron = filterCards(cards, { ...filters, searchText: "APX-01-001" });
  assert.deepEqual(theron.map(card => card.id), ["apx_01_001_a_n", "apx_01_001_b_n"]);
  const dcs = filterCards(cards, { ...filters, selectedSets: ["DCS"] });
  assert.ok(appendix.every(card => dcs.includes(card)));
});

test("a saved deck deals the selected SSR and Kickstarter artwork in a game", async t => {
  const previousStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  t.after(() => { globalThis.localStorage = previousStorage; });

  const { front: promo } = await getCardFaces("ks_02_009_pr");
  const { front: ssr } = await getCardFaces("ls_01_005_ssr");
  const deck = await saveLocalDeck(buildDeckPayload({
    name: "Printings", faction: "pink", protagonist: { card: promo, qty: 1 },
    persona: {}, deck: { [ssr.id]: { card: ssr, qty: 4 } }, backgroundImage: null,
  }));
  const saved = getDeck(deck.id);
  const player = { protagonistId: saved.protagonist, personaCards: saved.persona, mainDeckCards: saved.deck };
  dealOpeningHand(player);

  assert.equal(player.table.protagonist[0].id, promo.id);
  assert.equal(player.table.protagonist[0].hp, 18);
  assert.deepEqual(player.table.hand.map(card => card.id), Array(4).fill(ssr.id));
  assert.equal((await getCardFaces(player.table.hand[0].id)).front.imageId, "ls_01_005_ssr");
});
