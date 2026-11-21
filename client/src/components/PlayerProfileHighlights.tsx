import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { getCardFaces } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import { CLOUD_DECK_CHANGED } from "../services/cloudDeckService";
import { getPublishedDeckOptions } from "../services/publicDeckService";
import type { Card } from "../types/Card";
import ArchiveIcon from "./ArchiveIcon";
import CardDetailsModal from "./CardDetailsModal";
import styles from "../pages/ProfilePage.module.scss";

export function FavoriteCard({ id, compact = false }: { id: string; compact?: boolean }) {
  const [card, setCard] = useState<Card>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void getCardFaces(id).then(({ front }) => { if (active) setCard(front); }).catch(() => { /* Hide unavailable cards. */ });
    return () => { active = false; };
  }, [id]);
  if (!card) return null;

  const modal = open ? <CardDetailsModal card={card} onClose={() => setOpen(false)} /> : null;
  return <div className={compact ? styles.highlightCompact : styles.profileHighlight}>
    <button type="button" className={compact ? styles.highlightAction : styles.favoriteCard} title={compact ? card.name : undefined} onClick={() => setOpen(true)}>
      <img src={getCardImagePath(card)} loading="lazy" alt="" />
      <span><small>Favorite card</small><strong>{card.name}</strong></span>
    </button>
    {compact && modal ? createPortal(modal, document.body) : modal}
  </div>;
}

export function FeaturedDeckLabel({ name, ownerId, compact = false }: { name?: string; ownerId?: string; compact?: boolean }) {
  if (!name) return null;
  if (compact && ownerId) return <div className={styles.highlightCompact}>
    <Link className={styles.highlightAction} to={`/players/${ownerId}#featured-deck`} title={name}>
      <ArchiveIcon name="decks" size={17} /><span><small>Featured public deck</small><strong>{name}</strong></span>
    </Link>
  </div>;
  return <div className={styles.profileHighlight}>
    <small>Featured public deck</small>
    {ownerId ? <Link to={`/players/${ownerId}#featured-deck`}>{name}</Link> : <strong>{name}</strong>}
  </div>;
}

export function OwnFeaturedDeck({ id, ownerId, compact = false }: { id: string; ownerId: string; compact?: boolean }) {
  const [name, setName] = useState<string>();
  useEffect(() => {
    let request = 0;
    const refresh = () => {
      const current = ++request;
      void getPublishedDeckOptions(ownerId, id).then(([deck]) => {
        if (current === request) setName(deck?.name);
      }).catch(() => { if (current === request) setName(undefined); });
    };
    const deckChanged = (event: Event) => { if ((event as CustomEvent<string>).detail === id) refresh(); };
    refresh();
    window.addEventListener(CLOUD_DECK_CHANGED, deckChanged);
    window.addEventListener("focus", refresh);
    return () => {
      request++;
      window.removeEventListener(CLOUD_DECK_CHANGED, deckChanged);
      window.removeEventListener("focus", refresh);
    };
  }, [id, ownerId]);
  return <FeaturedDeckLabel name={name} ownerId={ownerId} compact={compact} />;
}
