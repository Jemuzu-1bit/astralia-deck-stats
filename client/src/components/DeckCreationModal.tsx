import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Deck } from "../types/Deck";
import type { Card } from "../types/Card";
import { COPIES_PER_CARD, FACTIONS, SECTION_LIMITS, countCardIdentity, countSelectedCards, type DeckSection, type CardSelection } from "../domain/deckBuilder";
import { getCardIdentity } from "../data/cardDataReader";
import { CHRONICLES } from "../data/chronicles";
import { useDeckEditor } from "../hooks/useDeckEditor";
import { useDeckPanelResize } from "../hooks/useDeckPanelResize";
import { useModalFocus } from "../hooks/useModalFocus";
import CardDetailsModal from "./CardDetailsModal";
import CardBrowser from "./CardBrowser";
import SortableDeckSection from "./SortableDeckSection";
import CardViewToggle, { type CardViewMode } from "./CardViewToggle";
import DeckStats from "./DeckStats";
import OpeningHandSimulator from "./OpeningHandSimulator";
import ArchiveIcon from "./ArchiveIcon";
import viewControlStyles from "./CardViewToggle.module.scss";
import styles from "./DeckWorkspace.module.scss";

interface DeckCreationModalProps {
  onClose: () => void;
  initialDeck?: Deck;
  initialFaction?: string;
  onSaved?: (deck: Deck) => void;
  saveDeck?: (deck: Omit<Deck, "id" | "updatedAt">, initialDeck?: Deck) => Promise<Deck>;
}

const sections: { id: DeckSection; label: string }[] = [
  { id: "protagonist", label: "Protagonist" },
  { id: "persona", label: "Persona" },
  { id: "deck", label: "Main deck" },
];

const COLLECTION_ZOOM_KEY = "astralia.deckBuilderCollectionZoom.v1";
const MIN_COLLECTION_ZOOM = 100;
const MAX_COLLECTION_ZOOM = 200;
const COLLECTION_ZOOM_STEP = 10;

function getSavedCollectionZoom() {
  try {
    const zoom = Number(localStorage.getItem(COLLECTION_ZOOM_KEY));
    if (Number.isInteger(zoom) && zoom >= MIN_COLLECTION_ZOOM && zoom <= MAX_COLLECTION_ZOOM) {
      return zoom;
    }
  } catch { /* Storage is optional. */ }
  return MIN_COLLECTION_ZOOM;
}

export default function DeckCreationModal({ onClose, initialDeck, initialFaction, onSaved, saveDeck }: DeckCreationModalProps) {
  const [sorting, setSorting] = useState(false);
  const editor = useDeckEditor({ initialDeck, initialFaction, onSaved, onClose, saveDeck, suppressEscape: sorting });
  const { selectedFaction, setSelectedFaction, deckName, setDeckName, description, setDescription, backgroundImage, setBackgroundImage, cardOptions, protagonistSelection, personaSelectionMap, deckSelectionMap, detailCard, openCardDetails, closeCardDetails, protagonistFilters, personaFilters, deckFilters, addCard, removeCard, moveCard, handleSave, saving, saveError, loadingDeck, loadError } = editor;
  const [section, setSection] = useState<DeckSection>(initialDeck ? "deck" : "protagonist");
  const [view, setView] = useState<"overview" | "cards" | "stats" | "hand">("overview");
  const [mobileView, setMobileView] = useState<"browse" | "deck">("browse");
  const [collectionView, setCollectionView] = useState<CardViewMode>("grid");
  const [collectionZoom, setCollectionZoom] = useState(getSavedCollectionZoom);
  const [collectionZoomDraft, setCollectionZoomDraft] = useState<string | null>(null);
  const [deckView, setDeckView] = useState<CardViewMode>("list");
  const deckTitle = deckName.trim() || "Untitled Deck";
  const { bodyRef, panelRef, deckWidth, resizing, separatorProps } = useDeckPanelResize(Boolean(selectedFaction));
  const modal = useRef<HTMLDivElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  useModalFocus(modal, Boolean(detailCard) || sorting);
  const totals = { protagonist: protagonistSelection ? 1 : 0, persona: countSelectedCards(personaSelectionMap), deck: countSelectedCards(deckSelectionMap) };
  const selections: Record<DeckSection, CardSelection> = { protagonist: protagonistSelection ? { [protagonistSelection.card.id]: protagonistSelection } : {}, persona: personaSelectionMap, deck: deckSelectionMap };
  const filters = { protagonist: protagonistFilters, persona: personaFilters, deck: deckFilters }[section];
  const complete = sections.every(item => totals[item.id] === SECTION_LIMITS[item.id]);
  const chronicle = selectedFaction ? CHRONICLES[selectedFaction] : null;
  const canAdd = (target: DeckSection, card: Card) => target === "protagonist"
    ? !protagonistSelection || getCardIdentity(protagonistSelection.card) !== getCardIdentity(card)
    : totals[target] < SECTION_LIMITS[target] && countCardIdentity(selections[target], card) < (target === "persona" ? 1 : COPIES_PER_CARD);
  const browseSection = (target: DeckSection) => { setSection(target); setView("cards"); setMobileView("browse"); };
  const updateCollectionZoom = (zoom: number) => {
    const nextZoom = Math.min(MAX_COLLECTION_ZOOM, Math.max(MIN_COLLECTION_ZOOM, zoom));
    if (nextZoom === collectionZoom) return;
    setCollectionZoom(nextZoom);
    try { localStorage.setItem(COLLECTION_ZOOM_KEY, String(nextZoom)); } catch { /* Keep the in-memory preference. */ }
  };
  const renderDeckSections = (overview = false) => <div className={`${styles.deckSections} ${overview ? styles.overviewSections : ""}`}>
    {sections.map(item => {
      const target = item.id;
      return <SortableDeckSection key={target} section={target} title={item.label}
        selection={selections[target]} viewMode={overview ? "grid" : deckView} overview={overview}
        disabled={loadingDeck || saving || Boolean(loadError)} onBrowse={() => browseSection(target)}
        onOpenCard={openCardDetails} onAddCard={card => addCard(target, card)}
        onRemoveCard={card => removeCard(target, card)} canAdd={card => !loadingDeck && canAdd(target, card)}
        onMoveCard={target === "protagonist" ? undefined : (cardId, targetId) => moveCard(target, cardId, targetId)}
        onSortingChange={setSorting} />;
    })}
  </div>;
  useEffect(() => {
    const onSaveKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (selectedFaction && !sorting && !loadingDeck && !cardOptions.loading && !loadError && !cardOptions.error) void handleSave();
      }
    };
    document.addEventListener("keydown", onSaveKey);
    return () => document.removeEventListener("keydown", onSaveKey);
  });

  return <div className={styles.backdrop}>
    <div ref={modal} className={styles.workspace} role="dialog" aria-modal="true" aria-labelledby="builder-title" tabIndex={-1}>
      <header className={styles.header}><div className={styles.heading}><ArchiveIcon name="decks" /><div><span>ASTRALIA / YOUR WORKSPACE</span><h2 id="builder-title" title={selectedFaction ? deckTitle : undefined}>{selectedFaction ? deckTitle : "Deck builder"}</h2></div></div><div className={styles.headerActions}>{selectedFaction && <><span className={styles.draftLabel}>{complete ? "Deck complete" : "Draft deck"}</span><button className={styles.save} onClick={() => void handleSave()} disabled={sorting || saving || loadingDeck || cardOptions.loading || Boolean(loadError || cardOptions.error)}><ArchiveIcon name="check" size={16} />{saving ? "Saving…" : "Save deck"}</button></>}<button className={styles.close} onClick={onClose} aria-label="Close deck builder"><ArchiveIcon name="close" /></button></div></header>
      {!selectedFaction ? <section className={styles.factionPicker}><span className={styles.eyebrow}>A NEW CHAPTER</span><h1>Choose your chronicle.</h1><p>Every strategy starts somewhere. Which story will you tell?</p><div className={styles.factionGrid}>{FACTIONS.map((faction, index) => <button key={faction} aria-label={`Select Chronicle of ${CHRONICLES[faction].name}`} onClick={() => setSelectedFaction(faction)} style={{ backgroundImage: `linear-gradient(0deg, #111215 2%, #11121500 90%), url(${CHRONICLES[faction].image})` }}><span className={styles.factionNumber}>0{index + 1}</span><div><span style={{ color: CHRONICLES[faction].color }}>CHRONICLE OF</span><h3>{CHRONICLES[faction].name}</h3><ArchiveIcon name="arrow" /></div></button>)}</div><p className={styles.rules}>1 protagonist <span>·</span> 5 persona cards <span>·</span> 45 main deck cards</p></section> : <>
        <div className={styles.mobileTabs}><button aria-pressed={mobileView === "browse"} onClick={() => setMobileView("browse")}>Browse cards</button><button aria-pressed={mobileView === "deck"} onClick={() => setMobileView("deck")}>Your deck · {totals.deck}/{SECTION_LIMITS.deck}</button></div>
        <div ref={bodyRef} className={`${styles.body} ${resizing ? styles.resizing : ""}`} style={deckWidth === null ? undefined : { "--deck-panel-width": `${deckWidth}px` } as CSSProperties}>
          <section className={`${styles.catalog} ${mobileView === "deck" ? styles.mobileHidden : ""}`}>
            <div className={styles.catalogHeader}>
              <div><h3>{view === "overview" ? "Deck Overview" : view === "cards" ? "Card collection" : view === "stats" ? "Deck analysis" : "Test your opening hand"}</h3><span style={{ color: chronicle?.color }}>Chronicle of {chronicle?.name}</span></div>
              <div className={styles.viewTabs} role="group" aria-label="Deck builder views">
                <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")} aria-label="Deck Overview" title="Deck Overview"><ArchiveIcon name="decks" size={17} /></button>
                <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} aria-label="Card collection" title="Card collection"><ArchiveIcon name="cards" size={17} /></button>
                <button type="button" aria-pressed={view === "stats"} onClick={() => setView("stats")} aria-label="Deck statistics" title="Deck statistics"><ArchiveIcon name="chart" size={17} /></button>
                <button type="button" aria-pressed={view === "hand"} onClick={() => setView("hand")} aria-label="Opening hand simulator" title="Opening hand simulator"><ArchiveIcon name="play" size={17} /></button>
              </div>
            </div>
            {view === "overview" ? <>
              <p className={styles.overviewHint}>Drag cards to change their order. On touch screens, hold a card before moving it.</p>
              {loadingDeck || cardOptions.loading ? <p role="status">Loading deck...</p> : loadError || cardOptions.error ? <p className={styles.error} role="alert">{loadError || cardOptions.error}</p> : renderDeckSections(true)}
            </> : view === "cards" ? <>
              <div className={styles.collectionToolbar}>
                <div className={styles.sectionTabs} aria-label="Card section">
                  {sections.map(item => <button key={item.id} aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}<span>{cardOptions[item.id].length}</span></button>)}
                </div>
                <div className={styles.collectionViewControls}>
                  <CardViewToggle label="Card collection view" value={collectionView} onChange={setCollectionView} />
                  {collectionView === "grid" && <div className={`${viewControlStyles.toggle} ${styles.collectionZoom}`} role="group" aria-label="Card zoom">
                    <button
                      type="button"
                      aria-label="Zoom out"
                      title="Zoom out"
                      disabled={collectionZoom === MIN_COLLECTION_ZOOM}
                      onClick={() => updateCollectionZoom(collectionZoom - COLLECTION_ZOOM_STEP)}
                    >
                      <ArchiveIcon name="minus" size={16} />
                    </button>
                    <label className={styles.collectionZoomEntry}>
                      <input
                        type="number"
                        min={MIN_COLLECTION_ZOOM}
                        max={MAX_COLLECTION_ZOOM}
                        step={1}
                        inputMode="numeric"
                        enterKeyHint="done"
                        aria-label="Card zoom percentage"
                        value={collectionZoomDraft ?? String(collectionZoom)}
                        onFocus={event => event.currentTarget.select()}
                        onChange={event => setCollectionZoomDraft(event.currentTarget.value)}
                        onBlur={event => {
                          const zoom = event.currentTarget.valueAsNumber;
                          setCollectionZoomDraft(null);
                          if (Number.isInteger(zoom)) updateCollectionZoom(zoom);
                        }}
                        onKeyDown={event => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      <span aria-hidden="true">%</span>
                    </label>
                    <button
                      type="button"
                      aria-label="Zoom in"
                      title="Zoom in"
                      disabled={collectionZoom === MAX_COLLECTION_ZOOM}
                      onClick={() => updateCollectionZoom(collectionZoom + COLLECTION_ZOOM_STEP)}
                    >
                      <ArchiveIcon name="plus" size={16} />
                    </button>
                  </div>}
                </div>
              </div>
              <CardBrowser
                key={section}
                viewMode={collectionView}
                gridZoom={collectionZoom}
                options={cardOptions[section]}
                filters={filters}
                onOpenCard={openCardDetails}
                loading={cardOptions.loading || loadingDeck}
                error={cardOptions.error || loadError}
                quantity={card => selections[section][card.id]?.qty ?? 0}
                canAdd={card => !loadingDeck && canAdd(section, card)}
                onAdd={card => addCard(section, card)}
                onRemove={card => removeCard(section, card)}
              />
            </> : view === "stats" ? <DeckStats entries={Object.values(deckSelectionMap)} limit={SECTION_LIMITS.deck} /> : <OpeningHandSimulator deckSelectionMap={deckSelectionMap} onOpenCard={openCardDetails} />}
          </section>
          <div className={styles.panelDivider} {...separatorProps} />
          <aside ref={panelRef} id="builder-deck-panel" className={`${styles.deckPanel} ${mobileView === "browse" ? styles.mobileHidden : ""}`}>
            <div className={styles.deckHero} style={{ backgroundImage: `linear-gradient(0deg, #1b1c20, #1b1c2070), url(${backgroundImage || chronicle?.image})` }}><span className={styles.eyebrow}>YOUR DECK</span><label className={styles.nameLabel}>Deck name<input aria-label="Deck name" value={deckName} onChange={event => setDeckName(event.target.value)} placeholder="Name your deck" maxLength={120} /></label><span className={styles.chronicleLabel} style={{ color: chronicle?.color }}>Chronicle of {chronicle?.name}</span><div className={styles.coverActions}><button onClick={() => backgroundInput.current?.click()}>Change cover</button>{backgroundImage && <button onClick={() => setBackgroundImage(null)}>Reset cover</button>}</div><input ref={backgroundInput} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setBackgroundImage(String(reader.result)); reader.readAsDataURL(file); } event.currentTarget.value = ""; }} /></div>
            <div className={styles.descriptionField}><label htmlFor="deck-description">Description</label><textarea id="deck-description" rows={4} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Explain your strategy, key cards and how to play this deck." /><span>{description.length}/5000 ? Visible to others when you publish this deck.</span></div>
            <div className={styles.progressBlock}><div><strong>{totals.deck}<span> / {SECTION_LIMITS.deck}</span></strong><span>{complete ? "Ready to play" : "Building your deck"}</span></div><progress value={totals.deck} max={SECTION_LIMITS.deck} aria-label="Main deck completion" /><p>{complete ? "All three sections are complete." : "You can save your draft at any time."}</p></div>
            {(saveError || loadError) && <p className={styles.error} role="alert">{saveError || loadError}</p>}
            <div className={styles.deckToolbar}><span>Deck cards</span><CardViewToggle label="Deck cards view" value={deckView} onChange={setDeckView} /></div>
            {renderDeckSections()}
            <div className={styles.deckFooter}><span>Up to {COPIES_PER_CARD} copies per main deck card</span><button className={styles.analysisLink} onClick={() => { setView("stats"); setMobileView("browse"); }}><ArchiveIcon name="chart" size={15} /> View deck statistics <ArchiveIcon name="arrow" size={14} /></button></div>
          </aside>
        </div>
      </>}
      {detailCard && <CardDetailsModal card={detailCard} onClose={closeCardDetails} />}
    </div>
  </div>;
}
