import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PublicDeck } from "../domain/publicDecks";
import type { Card } from "../types/Card";
import { getCardFaces } from "../services/cardDataService";
import { useModalFocus } from "../hooks/useModalFocus";
import CardDetailsModal from "./CardDetailsModal";
import CardDisplay from "./CardDisplay";
import DeckDiscussion from "./DeckDiscussion";
import styles from "./PublicDeckCollection.module.scss";

export default function PublicDeckPreview({ deck, onClose, onImport, importDisabled, importing, error, imported, children }: {
  deck: PublicDeck; onClose: () => void; onImport: () => void; importDisabled: boolean;
  importing: boolean; error: string | null; imported: { id: string; name: string } | null;
  children: ReactNode;
}) {
  const [catalog, setCatalog] = useState<Map<string, Card>>(new Map());
  const [detail, setDetail] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  const { protagonist, persona, deck: mainDeck, sideboard } = deck;
  useModalFocus(modal, Boolean(detail));
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    const ids = [...new Set([...(protagonist ? [protagonist] : []), ...persona, ...mainDeck.map(entry => entry.id), ...(sideboard ?? []).map(entry => entry.id)])];
    void Promise.all(ids.map(async id => [id, (await getCardFaces(id)).front] as const)).then(entries => {
      if (active) setCatalog(new Map(entries.filter((entry): entry is readonly [string, Card] => Boolean(entry[1]))));
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [protagonist, persona, mainDeck, sideboard]);
  const sections = [
    { name: "Protagonist", entries: protagonist ? [{ id: protagonist, qty: 1 }] : [] },
    { name: "Persona", entries: persona.map(id => ({ id, qty: 1 })) },
    { name: "Main deck", entries: mainDeck },
    ...(sideboard?.length ? [{ name: "Sideboard", entries: sideboard }] : []),
  ];
  return <div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={modal} className={styles.preview} role="dialog" aria-modal="true" aria-labelledby="public-deck-title" tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (detail) setDetail(null); else onClose(); } }}>
      <header><div><h2 id="public-deck-title">{deck.name}</h2><Link className={styles.author} to={`/players/${deck.ownerId}`} onClick={onClose}>By {deck.author?.name || "Player"} →</Link></div><button onClick={onClose} aria-label="Close deck preview">Close</button></header>
      {children}
      <section className={styles.description} aria-label="Deck description"><h3>About this deck</h3><p>{deck.description || "The creator has not added a description yet."}</p></section>
      {loading && <p role="status">Loading cards...</p>}
      {loadError && <p role="alert">Card details could not be loaded. Card IDs are shown below.</p>}
      <div className={styles.sections}>{sections.map(section => <section key={section.name}>
        <h3>{section.name} <span>{section.entries.reduce((sum, entry) => sum + entry.qty, 0)}</span></h3>
        {section.entries.length === 0 && <p>No cards</p>}
        <ul className={styles.cardGrid}>{section.entries.map((entry, index) => {
          const card = catalog.get(entry.id);
          return <li key={`${entry.id}-${index}`} className={styles.cardItem}>
            <div className={styles.cardArt}>
              {card ? <CardDisplay card={card} onClick={setDetail} /> : <div className={styles.cardPlaceholder}>{loading ? "Loading..." : "Card unavailable"}</div>}
              <span className={styles.quantity} aria-label={`${entry.qty} copies`}>{entry.qty}×</span>
            </div>
            <span className={styles.cardName}>{card?.name || entry.id}</span>
          </li>;
        })}</ul>
      </section>)}</div>
      <p>Import a private copy to your collection. Custom backgrounds are not copied.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {imported && <p role="status" className={styles.success}>“{imported.name}” imported. <Link to={`/my-decks?edit=${encodeURIComponent(imported.id)}`}>Open my copy →</Link></p>}
      <button className={styles.import} disabled={importDisabled} onClick={onImport}>{importing ? "Importing..." : "Import deck"}</button>
      <DeckDiscussion deckId={deck.id} ownerId={deck.ownerId} />
      {detail && <CardDetailsModal card={detail} onClose={() => setDetail(null)} />}
    </div>
  </div>;
}
