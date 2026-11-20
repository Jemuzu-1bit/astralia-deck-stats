import { useRef, useState, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";
import type { CardFiltersState } from "../hooks/useCardFilters";
import { filterCards, SECTION_LABELS, type DeckSection } from "../domain/deckBuilder";
import { getCardFilterValues } from "./cardFilterValues";
import CardDisplay from "./CardDisplay";
import type { CardViewMode } from "./CardViewToggle";
import ArchiveIcon from "./ArchiveIcon";
import type { CollectionCardDrag } from "./deckCollectionDrag";
import styles from "./CardBrowser.module.scss";

export interface CardDestination {
  section: DeckSection;
  quantity: number;
  disabledReason?: string;
}

interface Props {
  options: AugCard[];
  filters: CardFiltersState;
  onOpenCard: (card: Card) => void;
  destinations?: (card: Card) => CardDestination[];
  onAdd?: (section: DeckSection, card: Card) => void;
  onRemove?: (section: DeckSection, card: Card) => void;
  loading?: boolean;
  error?: string | null;
  viewMode?: CardViewMode;
  gridZoom?: number;
}

const quantityLabels: Record<DeckSection, string> = { protagonist: "selected", persona: "in Persona", deck: "in Main", sideboard: "in Side" };

function CollectionCardArt({ card, destinations, quantities, viewMode, onOpenCard }: {
  card: Card;
  destinations: DeckSection[];
  quantities: CardDestination[];
  viewMode: CardViewMode;
  onOpenCard: Props["onOpenCard"];
}) {
  const draggable = destinations.length > 0;
  const collectionCard: CollectionCardDrag = { card, destinations };
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `collection:${card.id}`,
    data: { collectionCard },
    disabled: !draggable,
  });

  return <div
    ref={draggable ? setNodeRef : undefined}
    className={styles.art}
    data-draggable={draggable || undefined}
    data-dragging={isDragging || undefined}
    {...listeners}
  >
    <CardDisplay card={card} onClick={onOpenCard} enableFlip={viewMode === "grid"} />
    {viewMode === "grid" && quantities.length > 0 && <span className={styles.badge}>
      {quantities.map(target => <span key={target.section}>{target.quantity} {quantityLabels[target.section]}</span>)}
    </span>}
  </div>;
}

export default function CardBrowser({ options, filters, onOpenCard, destinations, onAdd, onRemove, loading, error, viewMode = "grid", gridZoom }: Props) {
  const [sort, setSort] = useState("cost");
  const [pageSize, setPageSize] = useState(60);
  const [advanced, setAdvanced] = useState(false);
  const [destinationMenu, setDestinationMenu] = useState<{ cardId: string; action: "add" | "remove" } | null>(null);
  const destinationTrigger = useRef<HTMLButtonElement>(null);
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
      const cardDestinations = destinations?.(card) ?? [];
      const assigned = cardDestinations.filter(target => target.quantity > 0);
      const addable = cardDestinations.filter(target => !target.disabledReason);
      const openAction = destinationMenu?.cardId === card.id ? destinationMenu.action : undefined;
      const chooseDestination = (action: "add" | "remove", trigger: HTMLButtonElement) => {
        const available = action === "add" ? addable : assigned;
        if (available.length === 1) {
          setDestinationMenu(null);
          (action === "add" ? onAdd : onRemove)?.(available[0].section, card);
          return;
        }
        destinationTrigger.current = trigger;
        setDestinationMenu(openAction === action ? null : { cardId: card.id, action });
      };
      return <article
        className={`${styles.card} ${assigned.length ? styles.selected : ""}`}
        key={card.id}
        onDragStartCapture={onAdd ? event => event.preventDefault() : undefined}
      >
        <CollectionCardArt card={card} destinations={addable.map(target => target.section)} quantities={assigned} viewMode={viewMode} onOpenCard={onOpenCard} />
        <button className={styles.cardName} onClick={() => onOpenCard(card)} title={card.name}>{card.name}</button>
        <div className={styles.cardMeta}><span>{onAdd && cardDestinations[0]?.section === "persona" ? `${card.type} · Persona` : card.type}</span><span>{card.cost || "—"} cost</span></div>
        {onAdd && cardDestinations.length > 0 && <div className={styles.cardActions}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDestinationMenu(current => current?.cardId === card.id ? null : current);
          }}
          onKeyDown={event => {
            if (event.key !== "Escape" || !openAction) return;
            event.stopPropagation();
            destinationTrigger.current?.focus();
            setDestinationMenu(null);
          }}>
          <div className={styles.quantity}>
            <button type="button" aria-label={`Remove ${card.name}`} aria-expanded={assigned.length > 1 ? openAction === "remove" : undefined}
              disabled={!onRemove || assigned.length === 0} onClick={event => chooseDestination("remove", event.currentTarget)}>−</button>
            <span aria-live="polite" aria-label={assigned.map(target => `${target.quantity} ${quantityLabels[target.section]}`).join(", ") || "0 copies"}>
              {viewMode === "list" && assigned.length ? assigned.map(target => <span key={target.section}>{target.quantity} {quantityLabels[target.section]}</span>)
                : assigned.reduce((total, target) => total + target.quantity, 0)}
            </span>
            <button type="button" aria-label={`Add ${card.name}`} aria-expanded={addable.length > 1 ? openAction === "add" : undefined}
              disabled={addable.length === 0} title={addable.length === 0 ? cardDestinations[0].disabledReason : undefined}
              onClick={event => chooseDestination("add", event.currentTarget)}>+</button>
          </div>
          {openAction && <div className={styles.destinations} role="group" aria-label={openAction === "add" ? `Add ${card.name} to` : `Remove ${card.name} from`}>
            {(openAction === "add" ? addable : assigned).map(target => <button key={target.section} type="button"
              onClick={() => {
                (openAction === "add" ? onAdd : onRemove)?.(target.section, card);
                destinationTrigger.current?.focus();
                setDestinationMenu(null);
              }}>
              {SECTION_LABELS[target.section]}
            </button>)}
          </div>}
        </div>}
      </article>;
    })}</div>}
    {filtered.length > pageSize && <button className={styles.loadMore} onClick={() => setPageSize(size => size + 60)}>Show more cards ({filtered.length - pageSize} remaining)</button>}
  </div>;
}
