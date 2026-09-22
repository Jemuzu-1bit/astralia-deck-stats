import { useState, useEffect } from "react";
import { getCardsByField } from "../services/cardDataService";
import type { Card } from "../types/Card.ts";
import type { AugCard } from "../types/AugCard";
import type { Deck } from "../types/Deck";
import { createDeck, updateDeck } from "../services/deckService";
import CardDisplay from "./CardDisplay";
import CardDetailsModal from "./CardDetailsModal";
import CardFilters from "./CardFilters";
import DeckStats from "./DeckStats";
import FactionSelection from "./FactionSelection";
import styles from "./DeckCreationModal.module.scss";

interface DeckCreationModalProps {
  onClose: () => void;
  initialDeck?: Deck;
  onSaved?: (deck: Deck) => void;
}

const factions = ["red", "blue", "green", "purple", "pink"];

type SectionKey = "protagonist" | "persona" | "deck";

interface SelectedCard {
  card: Card;
  qty: number;
}

export default function DeckCreationModal({
  onClose,
  initialDeck,
  onSaved,
}: DeckCreationModalProps) {
  const [selectedFaction, setSelectedFaction] = useState<string | null>(
    initialDeck?.faction ?? null
  );
  const [deckName, setDeckName] = useState<string>(
    initialDeck?.name ?? "New Deck"
  );
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    initialDeck?.backgroundImage ?? null
  );

  const [protagonistOptions, setProtagonistOptions] = useState<AugCard[]>([]);
  const [personaOptions, setPersonaOptions] = useState<AugCard[]>([]);
  const [deckOptions, setDeckOptions] = useState<AugCard[]>([]);

  const [protagonistSelection, setProtagonistSelection] =
    useState<SelectedCard | null>(null);
  const [personaSelectionMap, setPersonaSelectionMap] = useState<
    Record<string, SelectedCard>
  >({});
  const [deckSelectionMap, setDeckSelectionMap] = useState<
    Record<string, SelectedCard>
  >({});

  const [editing, setEditing] = useState<Record<SectionKey, boolean>>({
    protagonist: false,
    persona: false,
    deck: false,
  });

  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const openCardDetails = (card: Card) => setDetailCard(card);
  const closeCardDetails = () => setDetailCard(null);

  useEffect(() => {
    if (!selectedFaction) return;

    (async () => {
      const [pros, personas, deckCards] = await Promise.all([
        getCardsByField("mainDeck", "Protagonist"),
        getCardsByField("mainDeck", "Persona"),
        getCardsByField("mainDeck", "Deck"),
      ]);

      const low = selectedFaction.toLowerCase();
      const mergeList = async (list: Card[]) => {
        const { getCardFaces } = await import("../services/cardDataService");

        const out: AugCard[] = await Promise.all(
          list
            .filter((c) => c.faction.toLowerCase() === low)
            .map(async (c) => {
              try {
                const faces = await getCardFaces(c.id);
                const back = faces.back;
                const frontKeys = (c.keywords || "").trim();
                const backKeys = (back?.keywords || "").trim();
                const mergedKeys = [frontKeys, backKeys]
                  .filter(Boolean)
                  .join(",")
                  .split(",")
                  .map((k: string) => k.trim())
                  .filter(Boolean)
                  .join(",");

                const frontAtk = (c.atk || "").trim();
                const backAtk = (back?.atk || "").trim();
                const mergedAtk = [frontAtk, backAtk]
                  .filter(Boolean)
                  .map((a: string) => a.trim())
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .join(",");

                const frontHp = (c.hp || "").trim();
                const backHp = (back?.hp || "").trim();
                const mergedHp = [frontHp, backHp]
                  .filter(Boolean)
                  .map((h: string) => h.trim())
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .join(",");

                const aug: AugCard = {
                  ...c,
                  mergedKeywords: mergedKeys,
                  mergedAtk,
                  mergedHp,
                };
                return aug;
              } catch {
                return { ...c } as AugCard;
              }
            })
        );

        return out;
      };

      setProtagonistOptions(await mergeList(pros));
      setPersonaOptions(await mergeList(personas));
      setDeckOptions(await mergeList(deckCards));
    })();
  }, [selectedFaction]);

  useEffect(() => {
    if (!initialDeck) return;
    if (
      !selectedFaction ||
      selectedFaction.toLowerCase() !== initialDeck.faction.toLowerCase()
    )
      return;
    const tryPrefill = async () => {
      const { getCardFaces } = await import("../services/cardDataService");
      if (initialDeck.protagonist) {
        const faces = await getCardFaces(initialDeck.protagonist);
        if (faces.front) {
          setProtagonistSelection({ card: faces.front, qty: 1 });
        }
      }
      const pMap: Record<string, { card: Card; qty: number }> = {};
      for (const id of initialDeck.persona) {
        const faces = await getCardFaces(id);
        if (faces.front) pMap[id] = { card: faces.front, qty: 1 };
      }
      setPersonaSelectionMap(pMap);
      const dMap: Record<string, { card: Card; qty: number }> = {};
      for (const ent of initialDeck.deck) {
        const faces = await getCardFaces(ent.id);
        if (faces.front) dMap[ent.id] = { card: faces.front, qty: ent.qty };
      }
      setDeckSelectionMap(dMap);
    };
    tryPrefill();
    setBackgroundImage(initialDeck.backgroundImage ?? null);
  }, [
    initialDeck,
    selectedFaction,
    personaOptions.length,
    deckOptions.length,
    protagonistOptions.length,
  ]);

  const sectionLimits: Record<SectionKey, number> = {
    protagonist: 1,
    persona: 5,
    deck: 45,
  };

  const perCardMax = 4;

  const getTotalInMap = (map: Record<string, SelectedCard>) =>
    Object.values(map).reduce((s, it) => s + it.qty, 0);

  const toggleEdit = (section: SectionKey) => {
    setEditing((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  function useFilters() {
    const [searchText, setSearchText] = useState("");
    const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([]);
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
    const [selectedAtks, setSelectedAtks] = useState<string[]>([]);
    const [selectedHps, setSelectedHps] = useState<string[]>([]);

    const clearFilters = () => {
      setSearchText("");
      setSelectedCosts([]);
      setSelectedTypes([]);
      setSelectedSubtypes([]);
      setSelectedKeywords([]);
      setSelectedAtks([]);
      setSelectedHps([]);
    };

    return {
      searchText,
      setSearchText,
      selectedCosts,
      setSelectedCosts,
      selectedTypes,
      setSelectedTypes,
      selectedSubtypes,
      setSelectedSubtypes,
      selectedKeywords,
      setSelectedKeywords,
      selectedAtks,
      setSelectedAtks,
      selectedHps,
      setSelectedHps,
      clearFilters,
    };
  }

  const protagonistFilters = useFilters();
  const personaFilters = useFilters();
  const deckFilters = useFilters();

  const applyFilters = (
    cards: Card[] | (Card & { mergedKeywords?: string })[],
    f: ReturnType<typeof useFilters>
  ) => {
    const q = f.searchText.trim().toLowerCase();

    return cards.filter((card) => {
      if (q) {
        const nameMatch = card.name.toLowerCase().includes(q);
        const idMatch = card.id.toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }

      if (
        f.selectedCosts.length > 0 &&
        !f.selectedCosts.includes(String(card.cost))
      )
        return false;
      if (f.selectedTypes.length > 0 && !f.selectedTypes.includes(card.type))
        return false;
      if (
        f.selectedSubtypes.length > 0 &&
        !f.selectedSubtypes.includes(card.subtype)
      )
        return false;

      if (f.selectedKeywords.length > 0) {
        const rawKeywords =
          (card as any).mergedKeywords ?? (card.keywords || "");
        const cardKeys = rawKeywords
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean);
        if (!f.selectedKeywords.some((k) => cardKeys.includes(k.toLowerCase())))
          return false;
      }

      if (f.selectedAtks.length > 0) {
        const rawAtks = (card as any).mergedAtk ?? card.atk ?? "";
        const cardAtkVals = String(rawAtks)
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean);
        if (!f.selectedAtks.some((a) => cardAtkVals.includes(a))) return false;
      }

      if (f.selectedHps.length > 0) {
        const rawHps = (card as any).mergedHp ?? card.hp ?? "";
        const cardHpVals = String(rawHps)
          .split(",")
          .map((h: string) => h.trim())
          .filter(Boolean);
        if (!f.selectedHps.some((h) => cardHpVals.includes(h))) return false;
      }

      return true;
    });
  };

  const addCard = (section: SectionKey, card: Card) => {
    if (section === "protagonist") {
      setProtagonistSelection({ card, qty: 1 });
      return;
    }

    const map =
      section === "persona"
        ? { ...personaSelectionMap }
        : { ...deckSelectionMap };

    const total = getTotalInMap(map);
    if (total >= sectionLimits[section]) return;

    const existing = map[card.id];
    const maxForCard = section === "persona" ? 1 : perCardMax;
    if (existing) {
      if (existing.qty >= maxForCard) return;
      existing.qty += 1;
    } else {
      map[card.id] = { card, qty: 1 };
    }

    if (section === "persona") setPersonaSelectionMap(map);
    else setDeckSelectionMap(map);
  };

  const removeCard = (section: SectionKey, card: Card) => {
    if (section === "protagonist") {
      setProtagonistSelection((prev) =>
        prev && prev.card.id === card.id ? null : prev
      );
      return;
    }

    const map =
      section === "persona"
        ? { ...personaSelectionMap }
        : { ...deckSelectionMap };
    const existing = map[card.id];
    if (!existing) return;
    existing.qty -= 1;
    if (existing.qty <= 0) delete map[card.id];

    if (section === "persona") setPersonaSelectionMap(map);
    else setDeckSelectionMap(map);
  };

  const renderSelectedList = (section: SectionKey) => {
    if (section === "protagonist") {
      if (!protagonistSelection)
        return <div className={styles.empty}>No protagonist selected</div>;
      return (
        <div className={styles.selectedProtagonist}>
          <div className={styles.cardWrapper}>
            <CardDisplay
              card={protagonistSelection.card}
              onClick={openCardDetails}
            />
          </div>
        </div>
      );
    }

    const map = section === "persona" ? personaSelectionMap : deckSelectionMap;
    const items = Object.values(map);
    if (items.length === 0)
      return <div className={styles.empty}>No cards selected</div>;

    return (
      <div className={styles.selectedGrid}>
        {items.map((it) => (
          <div key={it.card.id} className={styles.selectedItem}>
            <div className={styles.cardWrapper}>
              <CardDisplay card={it.card} onClick={openCardDetails} />
              {section === "deck" && (
                <div className={styles.qtyBadge}>{it.qty}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEditGrid = (section: SectionKey) => {
    const options =
      section === "protagonist"
        ? protagonistOptions
        : section === "persona"
        ? personaOptions
        : deckOptions;
    const map = section === "persona" ? personaSelectionMap : deckSelectionMap;
    const filters =
      section === "protagonist"
        ? protagonistFilters
        : section === "persona"
        ? personaFilters
        : deckFilters;

    const displayOptions = applyFilters(options, filters);

    return (
      <div className={styles.editGrid}>
        {displayOptions.map((card) => {
          const currentQty =
            section === "protagonist"
              ? protagonistSelection?.card.id === card.id
                ? protagonistSelection.qty
                : 0
              : map[card.id]?.qty ?? 0;

          const total =
            section === "persona"
              ? getTotalInMap(personaSelectionMap)
              : section === "deck"
              ? getTotalInMap(deckSelectionMap)
              : 0;

          const maxForCard =
            section === "protagonist" || section === "persona" ? 1 : perCardMax;

          const disableAdd =
            currentQty >= maxForCard ||
            (section !== "protagonist" && total >= sectionLimits[section]);

          return (
            <div key={card.id} className={styles.editRow}>
              <div className={styles.cardWrapper}>
                <CardDisplay card={card} onClick={openCardDetails} />
              </div>
              <div className={styles.controls}>
                <button
                  onClick={() => removeCard(section, card)}
                  disabled={currentQty <= 0}
                >
                  -
                </button>
                <span className={styles.qty}>{currentQty}</span>
                <button
                  onClick={() => addCard(section, card)}
                  disabled={disableAdd}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  function buildDeckPayload(): Omit<Deck, "id" | "updatedAt"> {
    const personaIds = Object.keys(personaSelectionMap);
    const deckEntries = Object.values(deckSelectionMap).map((it) => ({
      id: it.card.id,
      qty: it.qty,
    }));
    return {
      name: deckName.trim() || "New Deck",
      faction: selectedFaction || "red",
      protagonist: protagonistSelection?.card.id ?? null,
      persona: personaIds,
      deck: deckEntries,
      backgroundImage: backgroundImage ?? null,
    };
  }

  const handleSave = () => {
    if (!selectedFaction) {
      alert("Please select a faction first.");
      return;
    }

    const payload = buildDeckPayload();
    let saved: Deck;
    if (initialDeck) {
      saved = updateDeck({
        ...payload,
        id: initialDeck.id,
        updatedAt: Date.now(),
      });
    } else {
      saved = createDeck(payload);
    }
    onSaved?.(saved);
    onClose();
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        {detailCard && (
          <CardDetailsModal card={detailCard} onClose={closeCardDetails} />
        )}

        {!selectedFaction ? (
          <FactionSelection factions={factions} onSelect={setSelectedFaction} />
        ) : (
          <>
            {(() => {
              const cap =
                (selectedFaction || "").charAt(0).toUpperCase() +
                (selectedFaction || "").slice(1);
              const factionClass =
                (styles[
                  `factionHeader${cap}` as keyof typeof styles
                ] as string) || "";
              return (
                <div className={`${styles.modalHeader} ${factionClass}`}>
                  <h2 className={styles.modalTitle}>
                    {selectedFaction.toUpperCase()} Deck Builder
                  </h2>
                  <div className={styles.headerActions}>
                    <button
                      className={styles.closeButton}
                      onClick={onClose}
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className={styles.editorHeader}>
              <div className={styles.headerLeft}>
                <input
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Deck name"
                  className={styles.deckNameInput}
                />
                <input
                  id="deck-bg-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setBackgroundImage(String(reader.result));
                    reader.readAsDataURL(file);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  className={styles.editButton}
                  onClick={() =>
                    document.getElementById("deck-bg-input")?.click()
                  }
                >
                  Set Background
                </button>
                {backgroundImage && (
                  <button
                    className={styles.editButton}
                    onClick={() => setBackgroundImage(null)}
                  >
                    Remove Background
                  </button>
                )}
              </div>

              <div className={styles.headerActions}>
                <button className={styles.editButton} onClick={handleSave}>
                  Save Deck
                </button>
              </div>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>
                  Protagonist
                  <span className={styles.sectionCount}>
                    {protagonistSelection ? protagonistSelection.qty : 0}/
                    {sectionLimits.protagonist}
                  </span>
                </h3>
                <div>
                  <button
                    className={styles.editButton}
                    onClick={() => toggleEdit("protagonist")}
                  >
                    {editing.protagonist ? "Done" : "Edit"}
                  </button>
                </div>
              </div>

              <div className={styles.sectionBody}>
                {editing.protagonist ? (
                  <>
                    <CardFilters
                      options={protagonistOptions}
                      searchText={protagonistFilters.searchText}
                      setSearchText={protagonistFilters.setSearchText}
                      selectedCosts={protagonistFilters.selectedCosts}
                      setSelectedCosts={protagonistFilters.setSelectedCosts}
                      selectedTypes={protagonistFilters.selectedTypes}
                      setSelectedTypes={protagonistFilters.setSelectedTypes}
                      selectedSubtypes={protagonistFilters.selectedSubtypes}
                      setSelectedSubtypes={
                        protagonistFilters.setSelectedSubtypes
                      }
                      selectedKeywords={protagonistFilters.selectedKeywords}
                      setSelectedKeywords={
                        protagonistFilters.setSelectedKeywords
                      }
                      selectedAtks={protagonistFilters.selectedAtks}
                      setSelectedAtks={protagonistFilters.setSelectedAtks}
                      selectedHps={protagonistFilters.selectedHps}
                      setSelectedHps={protagonistFilters.setSelectedHps}
                      clearFilters={protagonistFilters.clearFilters}
                      hideTypeFilter
                    />
                    {renderEditGrid("protagonist")}
                  </>
                ) : (
                  renderSelectedList("protagonist")
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>
                  Persona Cards
                  <span className={styles.sectionCount}>
                    {getTotalInMap(personaSelectionMap)}/{sectionLimits.persona}
                  </span>
                </h3>
                <div>
                  <button
                    className={styles.editButton}
                    onClick={() => toggleEdit("persona")}
                  >
                    {editing.persona ? "Done" : "Edit"}
                  </button>
                </div>
              </div>

              <div className={styles.sectionBody}>
                {editing.persona ? (
                  <>
                    <CardFilters
                      options={personaOptions}
                      searchText={personaFilters.searchText}
                      setSearchText={personaFilters.setSearchText}
                      selectedCosts={personaFilters.selectedCosts}
                      setSelectedCosts={personaFilters.setSelectedCosts}
                      selectedTypes={personaFilters.selectedTypes}
                      setSelectedTypes={personaFilters.setSelectedTypes}
                      selectedSubtypes={personaFilters.selectedSubtypes}
                      setSelectedSubtypes={personaFilters.setSelectedSubtypes}
                      selectedKeywords={personaFilters.selectedKeywords}
                      setSelectedKeywords={personaFilters.setSelectedKeywords}
                      selectedAtks={personaFilters.selectedAtks}
                      setSelectedAtks={personaFilters.setSelectedAtks}
                      selectedHps={personaFilters.selectedHps}
                      setSelectedHps={personaFilters.setSelectedHps}
                      clearFilters={personaFilters.clearFilters}
                    />
                    {renderEditGrid("persona")}
                  </>
                ) : (
                  renderSelectedList("persona")
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>
                  Deck Cards
                  <span className={styles.sectionCount}>
                    {getTotalInMap(deckSelectionMap)}/{sectionLimits.deck}
                  </span>
                </h3>
                <div>
                  <button
                    className={styles.editButton}
                    onClick={() => toggleEdit("deck")}
                  >
                    {editing.deck ? "Done" : "Edit"}
                  </button>
                </div>
              </div>

              <div className={styles.sectionBody}>
                {editing.deck ? (
                  <>
                    <CardFilters
                      options={deckOptions}
                      searchText={deckFilters.searchText}
                      setSearchText={deckFilters.setSearchText}
                      selectedCosts={deckFilters.selectedCosts}
                      setSelectedCosts={deckFilters.setSelectedCosts}
                      selectedTypes={deckFilters.selectedTypes}
                      setSelectedTypes={deckFilters.setSelectedTypes}
                      selectedSubtypes={deckFilters.selectedSubtypes}
                      setSelectedSubtypes={deckFilters.setSelectedSubtypes}
                      selectedKeywords={deckFilters.selectedKeywords}
                      setSelectedKeywords={deckFilters.setSelectedKeywords}
                      selectedAtks={deckFilters.selectedAtks}
                      setSelectedAtks={deckFilters.setSelectedAtks}
                      selectedHps={deckFilters.selectedHps}
                      setSelectedHps={deckFilters.setSelectedHps}
                      clearFilters={deckFilters.clearFilters}
                    />

                    {renderEditGrid("deck")}
                  </>
                ) : (
                  renderSelectedList("deck")
                )}
              </div>
            </section>

            <DeckStats
              entries={Object.values(deckSelectionMap)}
              limit={sectionLimits.deck}
            />
          </>
        )}
      </div>
    </div>
  );
}
