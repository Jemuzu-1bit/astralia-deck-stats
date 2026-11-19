import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Deck } from "../types/Deck";
import type { Card } from "../types/Card";
import { COPIES_PER_CARD, FACTIONS, SECTION_LIMITS, countCardIdentity, countSelectedCards, type DeckSection, type CardSelection } from "../domain/deckBuilder";
import { getCardIdentity } from "../data/cardDataReader";
import { CHRONICLES } from "../data/chronicles";
import { getCardImagePath } from "../services/cardImageService";
import { useDeckEditor } from "../hooks/useDeckEditor";
import { useDeckPanelResize } from "../hooks/useDeckPanelResize";
import { useModalFocus } from "../hooks/useModalFocus";
import CardDetailsModal from "./CardDetailsModal";
import CardBrowser from "./CardBrowser";
import CardDisplay from "./CardDisplay";
import CardViewToggle, { type CardViewMode } from "./CardViewToggle";
import DeckStats from "./DeckStats";
import OpeningHandSimulator from "./OpeningHandSimulator";
import ArchiveIcon from "./ArchiveIcon";
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

export default function DeckCreationModal({ onClose, initialDeck, initialFaction, onSaved, saveDeck }: DeckCreationModalProps) {
  const editor = useDeckEditor({ initialDeck, initialFaction, onSaved, onClose, saveDeck });
  const { selectedFaction, setSelectedFaction, deckName, setDeckName, description, setDescription, backgroundImage, setBackgroundImage, cardOptions, protagonistSelection, personaSelectionMap, deckSelectionMap, detailCard, openCardDetails, closeCardDetails, protagonistFilters, personaFilters, deckFilters, addCard, removeCard, moveCard, handleSave, saving, saveError, loadingDeck, loadError } = editor;
  const [section, setSection] = useState<DeckSection>(initialDeck ? "deck" : "protagonist");
  const [view, setView] = useState<"cards" | "stats" | "hand">("cards");
  const [mobileView, setMobileView] = useState<"browse" | "deck">("browse");
  const [collectionView, setCollectionView] = useState<CardViewMode>("grid");
  const [deckView, setDeckView] = useState<CardViewMode>("list");
  const { bodyRef, panelRef, deckWidth, resizing, separatorProps } = useDeckPanelResize(Boolean(selectedFaction));
  const [dragged, setDragged] = useState<string | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  useModalFocus(modal, Boolean(detailCard));
  const totals = { protagonist: protagonistSelection ? 1 : 0, persona: countSelectedCards(personaSelectionMap), deck: countSelectedCards(deckSelectionMap) };
  const selections: Record<DeckSection, CardSelection> = { protagonist: protagonistSelection ? { [protagonistSelection.card.id]: protagonistSelection } : {}, persona: personaSelectionMap, deck: deckSelectionMap };
  const filters = { protagonist: protagonistFilters, persona: personaFilters, deck: deckFilters }[section];
  const complete = sections.every(item => totals[item.id] === SECTION_LIMITS[item.id]);
  const chronicle = selectedFaction ? CHRONICLES[selectedFaction] : null;
  const canAdd = (target: DeckSection, card: Card) => target === "protagonist"
    ? !protagonistSelection || getCardIdentity(protagonistSelection.card) !== getCardIdentity(card)
    : totals[target] < SECTION_LIMITS[target] && countCardIdentity(selections[target], card) < (target === "persona" ? 1 : COPIES_PER_CARD);
  const browseSection = (target: DeckSection) => { setSection(target); setView("cards"); setMobileView("browse"); };
  useEffect(() => {
    const onSaveKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (selectedFaction && !loadingDeck && !cardOptions.loading && !loadError && !cardOptions.error) void handleSave();
      }
    };
    document.addEventListener("keydown", onSaveKey);
    return () => document.removeEventListener("keydown", onSaveKey);
  });

  return <div className={styles.backdrop}>
    <div ref={modal} className={styles.workspace} role="dialog" aria-modal="true" aria-labelledby="builder-title" tabIndex={-1}>
      <header className={styles.header}><div className={styles.heading}><ArchiveIcon name="decks" /><div><span>ASTRALIA / YOUR WORKSPACE</span><h2 id="builder-title">Deck builder</h2></div></div><div className={styles.headerActions}>{selectedFaction && <><span className={styles.draftLabel}>{complete ? "Deck complete" : "Draft deck"}</span><button className={styles.save} onClick={() => void handleSave()} disabled={saving || loadingDeck || cardOptions.loading || Boolean(loadError || cardOptions.error)}><ArchiveIcon name="check" size={16} />{saving ? "Saving…" : "Save deck"}</button></>}<button className={styles.close} onClick={onClose} aria-label="Close deck builder"><ArchiveIcon name="close" /></button></div></header>
      {!selectedFaction ? <section className={styles.factionPicker}><span className={styles.eyebrow}>A NEW CHAPTER</span><h1>Choose your chronicle.</h1><p>Every strategy starts somewhere. Which story will you tell?</p><div className={styles.factionGrid}>{FACTIONS.map((faction, index) => <button key={faction} aria-label={`Select Chronicle of ${CHRONICLES[faction].name}`} onClick={() => setSelectedFaction(faction)} style={{ backgroundImage: `linear-gradient(0deg, #111215 2%, #11121500 90%), url(${CHRONICLES[faction].image})` }}><span className={styles.factionNumber}>0{index + 1}</span><div><span style={{ color: CHRONICLES[faction].color }}>CHRONICLE OF</span><h3>{CHRONICLES[faction].name}</h3><ArchiveIcon name="arrow" /></div></button>)}</div><p className={styles.rules}>1 protagonist <span>·</span> 5 persona cards <span>·</span> 45 main deck cards</p></section> : <>
        <div className={styles.mobileTabs}><button aria-pressed={mobileView === "browse"} onClick={() => setMobileView("browse")}>Browse cards</button><button aria-pressed={mobileView === "deck"} onClick={() => setMobileView("deck")}>Your deck · {totals.deck}/{SECTION_LIMITS.deck}</button></div>
        <div ref={bodyRef} className={`${styles.body} ${resizing ? styles.resizing : ""}`} style={deckWidth === null ? undefined : { "--deck-panel-width": `${deckWidth}px` } as CSSProperties}>
          <section className={`${styles.catalog} ${mobileView === "deck" ? styles.mobileHidden : ""}`}>
            <div className={styles.catalogHeader}><div><h3>{view === "cards" ? "Card collection" : view === "stats" ? "Deck analysis" : "Test your opening hand"}</h3><span style={{ color: chronicle?.color }}>Chronicle of {chronicle?.name}</span></div><div className={styles.viewTabs}><button aria-pressed={view === "cards"} onClick={() => setView("cards")} aria-label="Browse cards"><ArchiveIcon name="cards" size={17} /></button><button aria-pressed={view === "stats"} onClick={() => setView("stats")} aria-label="Deck statistics"><ArchiveIcon name="chart" size={17} /></button><button aria-pressed={view === "hand"} onClick={() => setView("hand")} aria-label="Opening hand simulator"><ArchiveIcon name="play" size={17} /></button></div></div>
            {view === "cards" ? <><div className={styles.collectionToolbar}><div className={styles.sectionTabs} aria-label="Card section">{sections.map(item => <button key={item.id} aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}<span>{cardOptions[item.id].length}</span></button>)}</div><CardViewToggle label="Card collection view" value={collectionView} onChange={setCollectionView} /></div><CardBrowser key={section} viewMode={collectionView} options={cardOptions[section]} filters={filters} onOpenCard={openCardDetails} loading={cardOptions.loading || loadingDeck} error={cardOptions.error || loadError} quantity={card => selections[section][card.id]?.qty ?? 0} canAdd={card => !loadingDeck && canAdd(section, card)} onAdd={card => addCard(section, card)} onRemove={card => removeCard(section, card)} /></> : view === "stats" ? <DeckStats entries={Object.values(deckSelectionMap)} limit={SECTION_LIMITS.deck} /> : <OpeningHandSimulator deckSelectionMap={deckSelectionMap} onOpenCard={openCardDetails} />}
          </section>
          <div className={styles.panelDivider} {...separatorProps} />
          <aside ref={panelRef} id="builder-deck-panel" className={`${styles.deckPanel} ${mobileView === "browse" ? styles.mobileHidden : ""}`}>
            <div className={styles.deckHero} style={{ backgroundImage: `linear-gradient(0deg, #1b1c20, #1b1c2070), url(${backgroundImage || chronicle?.image})` }}><span className={styles.eyebrow}>YOUR DECK</span><label className={styles.nameLabel}>Deck name<input aria-label="Deck name" value={deckName} onChange={event => setDeckName(event.target.value)} placeholder="Name your deck" maxLength={120} /></label><span className={styles.chronicleLabel} style={{ color: chronicle?.color }}>Chronicle of {chronicle?.name}</span><div className={styles.coverActions}><button onClick={() => backgroundInput.current?.click()}>Change cover</button>{backgroundImage && <button onClick={() => setBackgroundImage(null)}>Reset cover</button>}</div><input ref={backgroundInput} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setBackgroundImage(String(reader.result)); reader.readAsDataURL(file); } event.currentTarget.value = ""; }} /></div>
            <div className={styles.descriptionField}><label htmlFor="deck-description">Description</label><textarea id="deck-description" rows={4} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Explain your strategy, key cards and how to play this deck." /><span>{description.length}/5000 ? Visible to others when you publish this deck.</span></div>
            <div className={styles.progressBlock}><div><strong>{totals.deck}<span> / {SECTION_LIMITS.deck}</span></strong><span>{complete ? "Ready to play" : "Building your deck"}</span></div><progress value={totals.deck} max={SECTION_LIMITS.deck} aria-label="Main deck completion" /><p>{complete ? "All three sections are complete." : "You can save your draft at any time."}</p></div>
            {(saveError || loadError) && <p className={styles.error} role="alert">{saveError || loadError}</p>}
            <div className={styles.deckToolbar}><span>Deck cards</span><CardViewToggle label="Deck cards view" value={deckView} onChange={setDeckView} /></div>
            <div className={styles.deckSections}>{sections.map(item => <section key={item.id} className={styles.deckSection}><button className={styles.sectionHeading} onClick={() => browseSection(item.id)}><span>{item.label}</span><span className={totals[item.id] === SECTION_LIMITS[item.id] ? styles.full : ""}>{totals[item.id]} / {SECTION_LIMITS[item.id]} <ArchiveIcon name="plus" size={14} /></span></button>{totals[item.id] === 0 ? <button className={styles.addEmpty} onClick={() => browseSection(item.id)}><ArchiveIcon name="plus" size={15} />{item.id === "protagonist" ? "Choose your protagonist" : `Add ${item.label.toLowerCase()} cards`}</button> : <div className={deckView === "grid" ? styles.deckGrid : styles.deckRows}>{Object.values(selections[item.id]).map(({ card, qty }, index, entries) => <div key={card.id} className={`${styles.deckRow} ${deckView === "grid" ? styles.deckCard : ""}`} draggable={item.id !== "protagonist"} onDragStart={() => setDragged(card.id)} onDragEnd={() => setDragged(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged && item.id !== "protagonist") moveCard(item.id, dragged, card.id); setDragged(null); }}>
              {deckView === "grid" ? <div className={styles.deckArt}><CardDisplay card={card} onClick={openCardDetails} /></div> : <img src={getCardImagePath(card)} alt="" loading="lazy" />}<span className={styles.cost}>{card.cost || "—"}</span><button className={styles.rowName} onClick={() => openCardDetails(card)} title={card.name}>{card.name}</button><div className={styles.rowControls}><button aria-label={`Remove ${card.name} from ${item.label}`} onClick={() => removeCard(item.id, card)}>−</button><span>{qty}</span><button aria-label={`Add ${card.name} to ${item.label}`} disabled={!canAdd(item.id, card)} onClick={() => addCard(item.id, card)}>+</button></div>{item.id !== "protagonist" && entries.length > 1 && <button className={styles.reorder} disabled={index === 0} aria-label={`Move ${card.name} up`} onClick={() => { if (item.id !== "protagonist" && index > 0) moveCard(item.id, card.id, entries[index - 1].card.id); }}>↑</button>}
            </div>)}</div>}</section>)}</div>
            <div className={styles.deckFooter}><span>Up to {COPIES_PER_CARD} copies per main deck card</span><button className={styles.analysisLink} onClick={() => { setView("stats"); setMobileView("browse"); }}><ArchiveIcon name="chart" size={15} /> View deck statistics <ArchiveIcon name="arrow" size={14} /></button></div>
          </aside>
        </div>
      </>}
      {detailCard && <CardDetailsModal card={detailCard} onClose={closeCardDetails} />}
    </div>
  </div>;
}
