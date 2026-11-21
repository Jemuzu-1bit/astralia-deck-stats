import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type Active, type DragEndEvent, type Over } from "@dnd-kit/core";
import type { Deck } from "../types/Deck";
import type { Card } from "../types/Card";
import { COPIES_PER_CARD, FACTIONS, SECTION_LABELS, SECTION_LIMITS, countSelectedCards, getCardDeckSection, otherDeckSection, type DeckCardSection, type DeckSection, type CardSelection } from "../domain/deckBuilder";
import { CHRONICLES } from "../data/chronicles";
import { getCardImagePath } from "../services/cardImageService";
import { useDeckEditor } from "../hooks/useDeckEditor";
import { useCardFilters } from "../hooks/useCardFilters";
import { useDeckPanelResize } from "../hooks/useDeckPanelResize";
import { useModalFocus } from "../hooks/useModalFocus";
import CardDetailsModal from "./CardDetailsModal";
import CardBrowser, { type CardDestination } from "./CardBrowser";
import SortableDeckSection, { DeckDragPreview } from "./SortableDeckSection";
import CardViewToggle, { type CardViewMode } from "./CardViewToggle";
import DeckStats from "./DeckStats";
import OpeningHandSimulator from "./OpeningHandSimulator";
import ArchiveIcon from "./ArchiveIcon";
import { deckCollisionDetection, deckKeyboardCoordinates, getCollectionCardDrag, getDeckCardDrag, getDeckDrop, type CollectionCardDrag, type DeckCardDrag, type DeckDropTarget } from "./deckCollectionDrag";
import viewControlStyles from "./CardViewToggle.module.scss";
import styles from "./DeckWorkspace.module.scss";

interface DeckCreationModalProps {
  onClose: () => void;
  initialDeck?: Deck;
  initialFaction?: string;
  sideboardEnabled: boolean;
  onSaved?: (deck: Deck) => void;
  saveDeck?: (deck: Omit<Deck, "id" | "updatedAt">, initialDeck?: Deck) => Promise<Deck>;
}

const collectionTabs = ["protagonist", "persona", "deck"] as const;
type CollectionTab = typeof collectionTabs[number];
const sectionsWithSideboard = [...collectionTabs, "sideboard"] as const;

const COLLECTION_ZOOM_KEY = "astralia.deckBuilderCollectionZoom.v1";
const MIN_COLLECTION_ZOOM = 100;
const MAX_COLLECTION_ZOOM = 200;
const COLLECTION_ZOOM_STEP = 10;

function draggedCardName(active: Active): string {
  return getDeckCardDrag(active)?.item.card.name ?? getCollectionCardDrag(active)?.card.name ?? "Card";
}

function dropSectionName(over: Over): string {
  const target = over.data.current?.deckTarget as DeckDropTarget | undefined;
  return target ? SECTION_LABELS[target.section] : "the selected section";
}

function isEmptySideboardDrag(drag: DeckCardDrag | undefined): drag is DeckCardDrag {
  return drag?.section === "sideboard" && drag.item.qty === 0;
}

function getSavedCollectionZoom() {
  try {
    const zoom = Number(localStorage.getItem(COLLECTION_ZOOM_KEY));
    if (Number.isInteger(zoom) && zoom >= MIN_COLLECTION_ZOOM && zoom <= MAX_COLLECTION_ZOOM) {
      return zoom;
    }
  } catch { /* Storage is optional. */ }
  return MIN_COLLECTION_ZOOM;
}

export default function DeckCreationModal({ onClose, initialDeck, initialFaction, sideboardEnabled, onSaved, saveDeck }: DeckCreationModalProps) {
  const [activeDrag, setActiveDrag] = useState<CollectionCardDrag | DeckCardDrag | null>(null);
  const collectionDrag = activeDrag && "card" in activeDrag ? activeDrag : null;
  const deckDrag = activeDrag && "item" in activeDrag ? activeDrag : null;
  const dragging = activeDrag !== null;
  const editor = useDeckEditor({ initialDeck, initialFaction, sideboardEnabled, onSaved, onClose, saveDeck, suppressEscape: dragging });
  const { selectedFaction, setSelectedFaction, deckName, setDeckName, description, setDescription, backgroundImage, setBackgroundImage, cardOptions, protagonistSelection, deckSelections, detailCard, openCardDetails, closeCardDetails, canAddCard, addCard, removeCard, discardEmptySideboardCard, moveCard, handleSave, saving, saveError, loadingDeck, loadError } = editor;
  const [collectionTab, setCollectionTab] = useState<CollectionTab>(initialDeck ? "deck" : "protagonist");
  const collectionFilters = { protagonist: useCardFilters(), persona: useCardFilters(), deck: useCardFilters() };
  const [view, setView] = useState<"overview" | "cards" | "stats" | "hand">("overview");
  const isOverview = view === "overview";
  const [mobileView, setMobileView] = useState<"browse" | "deck">("browse");
  const [collectionView, setCollectionView] = useState<CardViewMode>("grid");
  const [collectionZoom, setCollectionZoom] = useState(getSavedCollectionZoom);
  const [collectionZoomDraft, setCollectionZoomDraft] = useState<string | null>(null);
  const [deckView, setDeckView] = useState<CardViewMode>("list");
  const deckTitle = deckName.trim() || "Untitled Deck";
  const { bodyRef, panelRef, deckWidth, resizing, separatorProps } = useDeckPanelResize(Boolean(selectedFaction));
  const modal = useRef<HTMLDivElement>(null);
  const catalog = useRef<HTMLElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  useModalFocus(modal, Boolean(detailCard) || dragging);
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: deckKeyboardCoordinates }),
  );
  const selections: Record<DeckSection, CardSelection> = { protagonist: protagonistSelection ? { [protagonistSelection.card.id]: protagonistSelection } : {}, ...deckSelections };
  const totals = { protagonist: protagonistSelection ? 1 : 0, persona: countSelectedCards(deckSelections.persona), deck: countSelectedCards(deckSelections.deck), sideboard: countSelectedCards(deckSelections.sideboard) };
  const complete = collectionTabs.every(section => totals[section] === SECTION_LIMITS[section]);
  const chronicle = selectedFaction ? CHRONICLES[selectedFaction] : null;
  const canEdit = !isOverview && !saving && !loadingDeck && !cardOptions.loading && !loadError && !cardOptions.error;
  const getDestinations = (card: Card): CardDestination[] => {
    const home = getCardDeckSection(card);
    if (!home) return [];
    const destinations: DeckSection[] = sideboardEnabled && home !== "protagonist" ? [home, "sideboard"] : [home];
    return destinations.map(section => {
      const full = totals[section] >= SECTION_LIMITS[section];
      let disabledReason: string | undefined;
      if (!canEdit) disabledReason = "Unavailable";
      else if (!canAddCard(section, card)) {
        if (section !== "protagonist" && full) disabledReason = "Section full";
        else if (home === "protagonist") disabledReason = "Already selected";
        else if (home === "persona") disabledReason = "One copy per Persona";
        else disabledReason = `${COPIES_PER_CARD} copies already assigned`;
      }
      return { section, quantity: selections[section][card.id]?.qty ?? 0, full, disabledReason };
    });
  };
  const moveDestinations = (from: DeckCardSection, card: Card): DeckCardSection[] => {
    const to = otherDeckSection(from, card);
    return sideboardEnabled && canEdit && to && totals[to] < SECTION_LIMITS[to] ? [from, to] : [from];
  };
  const finishDrag = ({ active, collisions }: DragEndEvent) => {
    const collectionCard = getCollectionCardDrag(active);
    const deckCard = getDeckCardDrag(active);
    const drop = getDeckDrop(collisions);
    if (canEdit) {
      if (!drop && isEmptySideboardDrag(deckCard)) {
        discardEmptySideboardCard(deckCard.item.card);
      } else if (drop && collectionCard && canAddCard(drop.section, collectionCard.card)) {
        addCard(drop.section, collectionCard.card, drop.insertionIndex);
      } else if (drop && deckCard && drop.section !== "protagonist" && drop.insertionIndex !== undefined) {
        moveCard(deckCard.section, drop.section, deckCard.item.card, drop.insertionIndex);
      }
    }
    setActiveDrag(null);
  };
  const browseCards = (section?: DeckSection) => {
    if (section === "sideboard") setCollectionTab(tab => tab === "protagonist" ? "deck" : tab);
    else if (section) setCollectionTab(section);
    setView("cards");
    setMobileView("browse");
  };
  const updateCollectionZoom = (zoom: number) => {
    const nextZoom = Math.min(MAX_COLLECTION_ZOOM, Math.max(MIN_COLLECTION_ZOOM, zoom));
    if (nextZoom === collectionZoom) return;
    setCollectionZoom(nextZoom);
    try { localStorage.setItem(COLLECTION_ZOOM_KEY, String(nextZoom)); } catch { /* Keep the in-memory preference. */ }
  };
  const renderDeckSections = (overview = false) => <div className={`${styles.deckSections} ${overview ? styles.overviewSections : ""}`}>
    {(sideboardEnabled ? sectionsWithSideboard : collectionTabs).map(target => <div key={target} className={styles.deckSection} data-collection-destination={collectionDrag?.destinations.includes(target) || undefined}>
      <SortableDeckSection section={target} title={SECTION_LABELS[target]}
        selection={selections[target]} viewMode={overview ? "grid" : deckView} overview={overview} readOnly={isOverview}
        acceptsCollectionDrop={!overview && view === "cards"}
        disabled={!canEdit} onBrowse={() => browseCards(target)}
        onOpenCard={openCardDetails} onAddCard={card => addCard(target, card)}
        onRemoveCard={card => removeCard(target, card)} canAdd={card => canEdit && canAddCard(target, card)}
        moveDestinations={moveDestinations} />
    </div>)}
  </div>;
  useEffect(() => {
    const onSaveKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (selectedFaction && !dragging && canEdit) void handleSave();
      }
    };
    document.addEventListener("keydown", onSaveKey);
    return () => document.removeEventListener("keydown", onSaveKey);
  });

  return <div className={styles.backdrop}>
    <div ref={modal} className={styles.workspace} role="dialog" aria-modal="true" aria-labelledby="builder-title" tabIndex={-1}>
      <header className={styles.header}>
        <div className={styles.heading}><ArchiveIcon name="decks" /><div><span>ASTRALIA / YOUR WORKSPACE</span><h2 id="builder-title" title={selectedFaction ? deckTitle : undefined}>{selectedFaction ? deckTitle : "Deck builder"}</h2></div></div>
        <div className={styles.headerActions}>
          {selectedFaction && <>
            <span className={styles.draftLabel}>{complete ? "Deck complete" : "Draft deck"}</span>
            {isOverview ? <button type="button" className={styles.save} onClick={() => browseCards()}>Edit deck</button>
              : <button type="button" className={styles.save} onClick={() => void handleSave()} disabled={dragging || !canEdit}><ArchiveIcon name="check" size={16} />{saving ? "Saving…" : "Save deck"}</button>}
          </>}
          <button className={styles.close} onClick={onClose} aria-label="Close deck builder"><ArchiveIcon name="close" /></button>
        </div>
      </header>
      {!selectedFaction ? <section className={styles.factionPicker}><span className={styles.eyebrow}>A NEW CHAPTER</span><h1>Choose your chronicle.</h1><p>Every strategy starts somewhere. Which story will you tell?</p><div className={styles.factionGrid}>{FACTIONS.map((faction, index) => <button key={faction} aria-label={`Select Chronicle of ${CHRONICLES[faction].name}`} onClick={() => setSelectedFaction(faction)} style={{ backgroundImage: `linear-gradient(0deg, #111215 2%, #11121500 90%), url(${CHRONICLES[faction].image})` }}><span className={styles.factionNumber}>0{index + 1}</span><div><span style={{ color: CHRONICLES[faction].color }}>CHRONICLE OF</span><h3>{CHRONICLES[faction].name}</h3><ArchiveIcon name="arrow" /></div></button>)}</div><p className={styles.rules}>1 protagonist <span>·</span> 5 persona cards <span>·</span> 45 main deck cards</p></section> : <>
        <div className={styles.mobileTabs}><button aria-pressed={mobileView === "browse"} onClick={() => setMobileView("browse")}>{isOverview ? "Overview" : "Browse cards"}</button><button aria-pressed={mobileView === "deck"} onClick={() => setMobileView("deck")}>Your deck · {totals.deck}/{SECTION_LIMITS.deck}</button></div>
        <DndContext
          sensors={dragSensors}
          collisionDetection={deckCollisionDetection}
          autoScroll={{ layoutShiftCompensation: false }}
          onDragStart={({ active }) => setActiveDrag(getCollectionCardDrag(active) ?? getDeckCardDrag(active) ?? null)}
          onDragEnd={finishDrag}
          onDragCancel={() => setActiveDrag(null)}
          accessibility={{
            screenReaderInstructions: { draggable: "Press Space to pick up a card. Use the arrow keys to move it, Space to drop, or Escape to cancel." },
            announcements: {
              onDragStart: ({ active }) => `Picked up ${draggedCardName(active)}.`,
              onDragOver: ({ active, over }) => over ? `${draggedCardName(active)} is over ${dropSectionName(over)}.` : "Move over a valid section.",
              onDragEnd: ({ active, over }) => {
                if (over) return `${draggedCardName(active)} dropped in ${dropSectionName(over)}.`;
                return isEmptySideboardDrag(getDeckCardDrag(active)) ? `${draggedCardName(active)} removed from Sideboard.` : "Move cancelled.";
              },
              onDragCancel: () => "Move cancelled.",
            },
          }}
        >
        <div ref={bodyRef} className={`${styles.body} ${resizing ? styles.resizing : ""} ${collectionDrag ? styles.collectionDragging : ""}`} style={deckWidth === null ? undefined : { "--deck-panel-width": `${deckWidth}px` } as CSSProperties}>
          <section ref={catalog} className={`${styles.catalog} ${mobileView === "deck" ? styles.mobileHidden : ""}`}>
            <div className={styles.catalogHeader}>
              <div><h3>{view === "overview" ? "Deck Overview" : view === "cards" ? "Card collection" : view === "stats" ? "Deck analysis" : "Test your opening hand"}</h3><span style={{ color: chronicle?.color }}>Chronicle of {chronicle?.name}</span></div>
              <div className={styles.viewTabs} role="group" aria-label="Deck builder views">
                <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")} aria-label="Deck Overview" title="Deck Overview"><ArchiveIcon name="decks" size={17} /></button>
                <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} aria-label="Card collection" title="Card collection"><ArchiveIcon name="cards" size={17} /></button>
                <button type="button" aria-pressed={view === "stats"} onClick={() => setView("stats")} aria-label="Deck statistics" title="Deck statistics"><ArchiveIcon name="chart" size={17} /></button>
                <button type="button" aria-pressed={view === "hand"} onClick={() => setView("hand")} aria-label="Opening hand simulator" title="Opening hand simulator"><ArchiveIcon name="play" size={17} /></button>
              </div>
            </div>
            {isOverview ? (
              loadingDeck || cardOptions.loading ? <p role="status">Loading deck...</p> : loadError || cardOptions.error ? <p className={styles.error} role="alert">{loadError || cardOptions.error}</p> : renderDeckSections(true)
            ) : view === "cards" ? <>
              <div className={styles.collectionToolbar}>
                <div className={styles.sectionTabs} role="tablist" aria-label="Card section">
                  {collectionTabs.map((tab, index) => <button type="button" key={tab} id={`builder-tab-${tab}`} role="tab"
                    aria-selected={collectionTab === tab} aria-controls="builder-collection-panel" tabIndex={collectionTab === tab ? 0 : -1}
                    onClick={() => setCollectionTab(tab)} onKeyDown={event => {
                      const last = collectionTabs.length - 1;
                      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? last
                        : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
                        : event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : undefined;
                      if (nextIndex === undefined) return;
                      event.preventDefault();
                      const next = collectionTabs[nextIndex];
                      setCollectionTab(next);
                      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#builder-tab-${next}`)?.focus();
                    }}>{SECTION_LABELS[tab]}<span aria-hidden="true">{cardOptions[tab].length}</span></button>)}
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
              <div role="tabpanel" id="builder-collection-panel" aria-labelledby={`builder-tab-${collectionTab}`}>
                <CardBrowser key={collectionTab}
                  autoLoadMore
                  scrollRootRef={catalog}
                  viewMode={collectionView}
                  gridZoom={collectionZoom}
                  options={cardOptions[collectionTab]}
                  filters={collectionFilters[collectionTab]}
                  onOpenCard={openCardDetails}
                  loading={cardOptions.loading || loadingDeck}
                  error={cardOptions.error || loadError}
                  destinations={getDestinations}
                  onAdd={addCard}
                  onRemove={canEdit ? removeCard : undefined}
                />
              </div>
            </> : view === "stats" ? <DeckStats entries={Object.values(deckSelections.deck)} limit={SECTION_LIMITS.deck} /> : <OpeningHandSimulator deckSelectionMap={deckSelections.deck} onOpenCard={openCardDetails} />}
          </section>
          <div className={styles.panelDivider} {...separatorProps} />
          <aside ref={panelRef} id="builder-deck-panel" className={`${styles.deckPanel} ${mobileView === "browse" ? styles.mobileHidden : ""}`}>
            <div className={styles.deckHero} style={{ backgroundImage: `linear-gradient(0deg, #1b1c20, #1b1c2070), url(${backgroundImage || chronicle?.image})` }}>
              <span className={styles.eyebrow}>YOUR DECK</span>
              {isOverview ? <h3 className={styles.deckSummaryName}>{deckTitle}</h3>
                : <label className={styles.nameLabel}>Deck name<input aria-label="Deck name" value={deckName} onChange={event => setDeckName(event.target.value)} placeholder="Name your deck" maxLength={120} /></label>}
              <span className={styles.chronicleLabel} style={{ color: chronicle?.color }}>Chronicle of {chronicle?.name}</span>
              {!isOverview && <>
                <div className={styles.coverActions}><button onClick={() => backgroundInput.current?.click()}>Change cover</button>{backgroundImage && <button onClick={() => setBackgroundImage(null)}>Reset cover</button>}</div>
                <input ref={backgroundInput} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setBackgroundImage(String(reader.result)); reader.readAsDataURL(file); } event.currentTarget.value = ""; }} />
              </>}
            </div>
            {isOverview ? (description.trim() && <div className={styles.descriptionField}><p>{description}</p></div>)
              : <div className={styles.descriptionField}><label htmlFor="deck-description">Description</label><textarea id="deck-description" rows={4} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Explain your strategy, key cards and how to play this deck." /><span>{description.length}/5000 · Visible to others when you publish this deck.</span></div>}
            <div className={styles.progressBlock}><div><strong>{totals.deck}<span> / {SECTION_LIMITS.deck}</span></strong><span>{complete ? "Ready to play" : "Building your deck"}</span></div><progress value={totals.deck} max={SECTION_LIMITS.deck} aria-label="Main deck completion" /><p>{complete ? "All three sections are complete." : "You can save your draft at any time."}</p></div>
            {(saveError || loadError) && <p className={styles.error} role="alert">{saveError || loadError}</p>}
            <div className={styles.deckToolbar}><span>Deck cards</span><CardViewToggle label="Deck cards view" value={deckView} onChange={setDeckView} /></div>
            {renderDeckSections()}
            <div className={styles.deckFooter}><span>Up to {COPIES_PER_CARD} copies per Main Deck card and 1 per Persona{sideboardEnabled && " across the deck and Sideboard"}</span><button className={styles.analysisLink} onClick={() => { setView("stats"); setMobileView("browse"); }}><ArchiveIcon name="chart" size={15} /> View deck statistics <ArchiveIcon name="arrow" size={14} /></button></div>
          </aside>
        </div>
        <DragOverlay zIndex={10050} adjustScale={false} dropAnimation={null} style={{ pointerEvents: "none" }}>
          {collectionDrag && <img className={styles.collectionDragImage} src={getCardImagePath(collectionDrag.card, "thumb")} alt="" draggable={false} />}
          {deckDrag && <DeckDragPreview item={deckDrag.item} viewMode={deckDrag.viewMode} />}
        </DragOverlay>
        </DndContext>
      </>}
      {detailCard && <CardDetailsModal card={detailCard} onClose={closeCardDetails} />}
    </div>
  </div>;
}
