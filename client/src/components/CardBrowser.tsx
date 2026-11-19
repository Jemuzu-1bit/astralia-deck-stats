import { useState, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";
import type { CardFiltersState } from "../hooks/useCardFilters";
import { filterCards, type DeckSection } from "../domain/deckBuilder";
import { getCardFilterValues } from "./cardFilterValues";
import CardDisplay from "./CardDisplay";
import type { CardViewMode } from "./CardViewToggle";
import ArchiveIcon from "./ArchiveIcon";
import type { CollectionCardDrag } from "./deckCollectionDrag";
import styles from "./CardBrowser.module.scss";

interface Props {
  options: AugCard[];
  filters: CardFiltersState;
  onOpenCard: (card: Card) => void;
  onAdd?: (card: Card) => void;
  onRemove?: (card: Card) => void;
  quantity?: (card: Card) => number;
  canAdd?: (card: Card) => boolean;
  loading?: boolean;
  error?: string | null;
  viewMode?: CardViewMode;
  gridZoom?: number;
  dragSection?: DeckSection;
}

function CollectionCardArt({ card, section, quantity, viewMode, onOpenCard }: {
  card: Card;
  section?: DeckSection;
  quantity: number;
  viewMode: CardViewMode;
  onOpenCard: Props["onOpenCard"];
}) {
  const collectionCard: CollectionCardDrag | undefined = section && { card, section };
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `collection:${card.id}`,
    data: { collectionCard },
    disabled: !section,
  });

  return <div
    ref={section ? setNodeRef : undefined}
    className={styles.art}
    data-draggable={section ? true : undefined}
    data-dragging={isDragging || undefined}
    {...listeners}
  >
    <CardDisplay card={card} onClick={onOpenCard} enableFlip={viewMode === "grid"} />
    {quantity > 0 && viewMode === "grid" && <span className={styles.badge}>{quantity} in deck</span>}
  </div>;
}

export default function CardBrowser({ options, filters, onOpenCard, onAdd, onRemove, quantity, canAdd, loading, error, viewMode = "grid", gridZoom, dragSection }: Props) {
  const [sort, setSort] = useState("cost");
  const [pageSize, setPageSize] = useState(60);
  const [advanced, setAdvanced] = useState(false);
  const gridStyle = viewMode === "grid" && gridZoom !== undefined
    ? { "--card-grid-scale": gridZoom / 100 } as CSSProperties
    : undefined;
  const resultsLayout = viewMode === "list" ? styles.list : styles.grid;
  const values = getCardFilterValues(options);
  const filtered = filterCards(options, filters).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : (Number(a.cost) || 0) - (Number(b.cost) || 0) || a.name.localeCompare(b.name));
  const filterGroups = [
    { label: "Type", values: values.types, selected: filters.selectedTypes, set: filters.setSelectedTypes },
    { label: "Cost", values: values.costs, selected: filters.selectedCosts, set: filters.setSelectedCosts },
    { label: "Subtype", values: values.subtypes, selected: filters.selectedSubtypes, set: filters.setSelectedSubtypes },
    { label: "Keyword", values: values.keywords, selected: filters.selectedKeywords, set: filters.setSelectedKeywords },
    { label: "ATK", values: values.atks, selected: filters.selectedAtks, set: filters.setSelectedAtks },
    { label: "HP", values: values.hps, selected: filters.selectedHps, set: filters.setSelectedHps },
  ];
  const filterCount = filterGroups.reduce((sum, group) => sum + group.selected.length, 0);
  return <div className={styles.browser}>
    <div className={styles.searchRow}><label className={styles.search}><ArchiveIcon name="search" size={18} /><input aria-label="Search cards" placeholder="Search cards by name or ID…" value={filters.searchText} onChange={event => { filters.setSearchText(event.target.value); setPageSize(60); }} />{filters.searchText && <button aria-label="Clear card search" onClick={() => filters.setSearchText("")}><ArchiveIcon name="close" size={15} /></button>}</label><button className={styles.filterToggle} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Filters{filterCount > 0 ? ` (${filterCount})` : ""}</button></div>
    <div className={styles.filters}>{filterGroups.slice(0, 2).map(group => <label key={group.label}><span>{group.label}</span><select aria-label={`Filter by ${group.label.toLowerCase()}`} value={group.selected[0] ?? ""} onChange={event => { group.set(event.target.value ? [event.target.value] : []); setPageSize(60); }}><option value="">All {group.label.toLowerCase()}s</option>{group.values.map(value => <option key={value}>{value}</option>)}</select></label>)}<button className={styles.reset} onClick={() => { filters.clearFilters(); setPageSize(60); }}>Reset filters</button></div>
    {advanced && <div className={styles.advanced}>{filterGroups.slice(2).map(group => <div key={group.label}><span>{group.label}</span><div>{group.values.length === 0 ? <small>No options</small> : group.values.map(value => <button key={value} aria-pressed={group.selected.includes(value)} className={group.selected.includes(value) ? styles.activeChip : ""} onClick={() => group.set(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>{value}</button>)}</div></div>)}</div>}
    <div className={styles.results}><span aria-live="polite">{loading ? "Loading cards…" : `${filtered.length} cards`}</span><label>Sort by <select aria-label="Sort cards" value={sort} onChange={event => setSort(event.target.value)}><option value="cost">Cost, then name</option><option value="name">Name</option></select></label></div>
    {error ? <div className={styles.empty} role="alert">{error}</div> : !loading && filtered.length === 0 ? <div className={styles.empty}><ArchiveIcon name="search" size={30} /><h3>No cards found</h3><p>Try a different search or reset your filters.</p><button onClick={filters.clearFilters}>Reset filters</button></div> : <div className={gridStyle ? `${resultsLayout} ${styles.zoomGrid}` : resultsLayout} style={gridStyle}>{filtered.slice(0, pageSize).map(card => {
      const qty = quantity?.(card) ?? 0;
      const canAddCard = canAdd?.(card) ?? true;
      return <article
        className={`${styles.card} ${qty > 0 ? styles.selected : ""}`}
        key={card.id}
        onDragStartCapture={onAdd ? event => event.preventDefault() : undefined}
      >
        <CollectionCardArt card={card} section={canAddCard ? dragSection : undefined} quantity={qty} viewMode={viewMode} onOpenCard={onOpenCard} />
        <button className={styles.cardName} onClick={() => onOpenCard(card)} title={card.name}>{card.name}</button>
        <div className={styles.cardMeta}><span>{card.type}</span><span>{card.cost || "—"} cost</span></div>
        {onAdd && <div className={styles.quantity}><button aria-label={`Remove ${card.name}`} disabled={qty === 0} onClick={() => onRemove?.(card)}>−</button><span aria-label={`${qty} copies`}>{qty}</span><button aria-label={`Add ${card.name}`} disabled={!canAddCard} onClick={() => onAdd(card)}>+</button></div>}
      </article>;
    })}</div>}
    {filtered.length > pageSize && <button className={styles.loadMore} onClick={() => setPageSize(size => size + 60)}>Show more cards ({filtered.length - pageSize} remaining)</button>}
  </div>;
}
