import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Card } from "../types/Card";
import { getAllCards } from "../services/cardDataService";
import { useCardFilters } from "../hooks/useCardFilters";
import { FACTIONS } from "../domain/deckBuilder";
import { CHRONICLES } from "../data/chronicles";
import CardBrowser from "../components/CardBrowser";
import CardDetailsModal from "../components/CardDetailsModal";
import styles from "./CardLibraryPage.module.scss";

export default function CardLibraryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [faction, setFaction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Card | null>(null);
  const filters = useCardFilters();
  const options = useMemo(() => faction ? cards.filter(card => card.faction.toLowerCase() === faction) : cards, [cards, faction]);
  useEffect(() => {
    let active = true;
    void getAllCards({ includePrintings: true }).then(cards => { if (active) setCards(cards); }).catch(() => { if (active) setError("Could not load the card library. Please reload to try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className={styles.page}>
    <header className={styles.header}><div><span>EXPLORE ASTRALIA</span><h1>Card library</h1><p>Find the next piece of your strategy.</p></div><Link to="/my-decks?new=1">+ Build a deck</Link></header>
    <div className={styles.factions} aria-label="Filter by chronicle"><button aria-pressed={!faction} onClick={() => setFaction("")}>All chronicles</button>{FACTIONS.map(value => <button key={value} aria-pressed={faction === value} onClick={() => setFaction(value)}><span style={{ background: CHRONICLES[value].color }} />{CHRONICLES[value].name}</button>)}</div>
    <CardBrowser options={options} filters={filters} loading={loading} error={error} onOpenCard={setDetail} autoLoadMore />
    {detail && <CardDetailsModal card={detail} onClose={() => setDetail(null)} />}
  </div>;
}
