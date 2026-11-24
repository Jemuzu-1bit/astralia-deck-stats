import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import { PUBLIC_DECK_SORTS, type PublicDeck, type PublicDeckSort } from "../domain/publicDecks";
import {
  listPublicDecks, fetchPublicDeckCopy, importCloudPublicDeck, recordLocalPublicDeckImport,
  recordPublicDeckView, setPublicDeckLike,
} from "../services/publicDeckService";
import { createDeck } from "../services/deckService";
import { getChronicle } from "../data/chronicles";
import ChronicleLabel, { ChronicleSelect } from "./ChronicleLabel";
import { supabase } from "../services/supabaseClient";
import ArchiveIcon from "./ArchiveIcon";
import PublicDeckMetrics from "./PublicDeckMetrics";
import PublicDeckPreview from "./PublicDeckPreview";
import styles from "../pages/MyDecksPage.module.scss";
import cards from "./DeckCard.module.scss";
import community from "./PublicDeckCollection.module.scss";
import profile from "../pages/ProfilePage.module.scss";

export default function PublicDeckCollection({ ownerId, featuredDeckId }: { ownerId?: string; featuredDeckId?: string }) {
  const { user, authReady } = useOutletContext<AuthSession>();
  const { hash } = useLocation();
  const userId = user?.id;
  const [search, setSearch] = useState("");
  const [faction, setFaction] = useState("");
  const [sort, setSort] = useState<PublicDeckSort>("newest");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [featured, setFeatured] = useState<PublicDeck | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<{ id: string; name: string; cloud: boolean } | null>(null);
  const [selected, setSelected] = useState<PublicDeck | null>(null);
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<{ id: string; message: string } | null>(null);
  const pending = useRef(false);
  const active = useRef(true);
  const previousQuery = useRef("");
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setSelected(null); setLikeError(null); }, [userId]);

  useEffect(() => {
    if (!ownerId || !featuredDeckId) return;
    let current = true;
    void listPublicDecks({ ownerId, deckId: featuredDeckId }).then(result => {
      if (current) setFeatured(result.decks[0] ?? null);
    }).catch(() => { if (current) setFeatured(null); });
    return () => { current = false; };
  }, [ownerId, featuredDeckId, userId, reload]);

  const featuredDeck = featured?.id === featuredDeckId ? featured : null;
  const hasFeaturedDeck = Boolean(featuredDeck);
  useEffect(() => {
    if (hasFeaturedDeck && hash === "#featured-deck") document.getElementById("featured-deck")?.scrollIntoView();
  }, [hasFeaturedDeck, hash]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let current = true;
    const query = JSON.stringify([search, faction, page, ownerId, sort, userId]);
    const queryChanged = previousQuery.current !== query;
    if (queryChanged) {
      previousQuery.current = query;
      setLoading(true);
      setDecks([]);
      setHasMore(false);
    }
    setError(null);
    const timer = window.setTimeout(() => {
      void listPublicDecks({ search, faction, page, ownerId, sort }).then(result => {
        if (current) { setDecks(result.decks); setHasMore(result.hasMore); }
      }).catch(() => {
        if (current) setError("Could not load public decks. Please try again.");
      }).finally(() => { if (current) setLoading(false); });
    }, queryChanged ? 250 : 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, [search, faction, page, ownerId, sort, userId, reload]);

  const updateEngagement = (id: string, update: (deck: PublicDeck) => PublicDeck) => {
    if (!active.current) return;
    setDecks(items => items.map(deck => deck.id === id ? update(deck) : deck));
    setFeatured(deck => deck?.id === id ? update(deck) : deck);
    setSelected(deck => deck?.id === id ? update(deck) : deck);
    setReload(value => value + 1);
  };

  const viewDeck = (deck: PublicDeck) => {
    setSelected(deck);
    if (userId === deck.ownerId) return;
    void recordPublicDeckView(deck.id).then(viewCount => {
      updateEngagement(deck.id, current => ({ ...current, viewCount: Math.max(current.viewCount, viewCount) }));
    }).catch(() => {
      // Keep the preview available during a counter request failure.
    });
  };

  const likeDeck = async (deck: PublicDeck) => {
    if (!userId || userId === deck.ownerId || liking) return;
    const likedByViewer = !deck.likedByViewer;
    setLiking(true);
    setLikeError(null);
    try {
      const likeCount = await setPublicDeckLike(deck.id, likedByViewer);
      updateEngagement(deck.id, current => ({ ...current, likeCount, likedByViewer }));
    } catch {
      if (active.current) setLikeError({ id: deck.id, message: "Could not update your like. Please try again." });
    } finally {
      if (active.current) setLiking(false);
    }
  };

  const importPublicDeck = async (deck: PublicDeck) => {
    if (!authReady || pending.current) return;
    pending.current = true;
    setImporting(deck.id);
    setImportError(null);
    setImported(null);
    try {
      if (userId) {
        const { id, name, importCount } = await importCloudPublicDeck(deck.id);
        if (active.current) setImported({ id, name, cloud: true });
        if (userId !== deck.ownerId) {
          updateEngagement(deck.id, current => ({ ...current, importCount: Math.max(current.importCount, importCount) }));
        }
      } else {
        const saved = createDeck(await fetchPublicDeckCopy(deck.id));
        if (active.current) setImported({ id: saved.id, name: saved.name, cloud: false });
        try {
          const importCount = await recordLocalPublicDeckImport(deck.id, saved.id);
          updateEngagement(deck.id, current => ({ ...current, importCount: Math.max(current.importCount, importCount) }));
        } catch {
          if (active.current) setImportError("Your copy was saved, but the public import count could not be updated.");
        }
      }
    } catch (error) {
      if (active.current) setImportError(error instanceof Error ? error.message : "Could not import this deck. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setImporting(null);
    }
  };

  if (!supabase) return <p className={styles.notice}>Public decks will be available when online storage is configured.</p>;
  return <section aria-label={ownerId ? "Published decks" : "Public deck collection"}>
    {featuredDeck && <div id="featured-deck" className={`${profile.card} ${profile.featuredDeck}`}>
      <div><small>Featured public deck</small><h2>{featuredDeck.name}</h2></div>
      <button type="button" className={profile.secondary} onClick={() => viewDeck(featuredDeck)}>View deck</button>
    </div>}
    {ownerId && <h2>Published decks</h2>}
    <div className={styles.libraryToolbar}>
      <label className={styles.deckSearch}><ArchiveIcon name="search" size={17} /><input aria-label="Search public decks" placeholder="Search public decks…" value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      <ChronicleSelect aria-label="Filter public decks by chronicle" value={faction} emptyLabel="All chronicles" onChange={event => { setFaction(event.target.value); setPage(0); }} />
      <select aria-label="Sort public decks" value={sort} onChange={event => { setSort(event.target.value as PublicDeckSort); setPage(0); }}>
        {Object.entries(PUBLIC_DECK_SORTS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
      </select>
    </div>
    {authReady && !userId && <p className={styles.notice}>Imports are saved on this device. Sign in with Discord to like decks and save imports to your account.</p>}
    {imported && <p role="status" className={community.success}>“{imported.name}” imported as a private copy {imported.cloud ? "to your account" : "on this device"}. <Link to={`/my-decks?edit=${encodeURIComponent(imported.id)}`}>Open my copy →</Link></p>}
    {importError && <p role="alert" className={styles.error}>{importError}</p>}
    {loading && <p role="status" className={styles.notice}>Loading public decks...</p>}
    {error && <div role="alert" className={styles.error}><p>{error}</p><button className={styles.importButton} onClick={() => { setLoading(true); setReload(value => value + 1); }}>Try again</button></div>}
    {!loading && !error && decks.length === 0 && <div className={styles.empty}><ArchiveIcon name="decks" size={34} /><h2>{search || faction ? "No matching decks" : "No published decks yet"}</h2><p>{search || faction ? "Try a different name or chronicle." : "Published strategies will appear here."}</p>{(search || faction) && <button onClick={() => { setSearch(""); setFaction(""); setPage(0); }}>Reset filters</button>}</div>}
    <div className={styles.deckSlots}>
      {decks.map(deck => {
        const chronicle = getChronicle(deck.faction);
        return <article key={deck.id} className={cards.card}>
          <button className={cards.cover} onClick={() => viewDeck(deck)} aria-label={`View ${deck.name}`} aria-description={chronicle ? `Chronicle of ${chronicle.name}` : undefined} style={{ backgroundImage: `linear-gradient(0deg, #1b1c21 6%, #1b1c21db 26%, #1b1c2110 85%), url(${deck.backgroundImage || chronicle?.image || ""})` }}>
            <span className={cards.status}>Public</span>
            <ChronicleLabel faction={deck.faction} fullName className={cards.faction} />
          </button>
          <div className={cards.info}>
            <button className={cards.title} onClick={() => viewDeck(deck)}>{deck.name}</button>
            <Link className={community.author} to={`/players/${deck.ownerId}`}>By {deck.author?.name || "Player"} <ArchiveIcon name="arrow" size={13} /></Link>
            <div className={cards.meta}><span>{deck.deck.reduce((sum, entry) => sum + entry.qty, 0)} cards · {deck.persona.length} persona</span><span>{new Date(deck.publishedAt ?? deck.updatedAt).toLocaleDateString()}</span></div>
            <PublicDeckMetrics deck={deck} onLike={userId && userId !== deck.ownerId ? () => void likeDeck(deck) : undefined} likeDisabled={liking} error={likeError?.id === deck.id ? likeError.message : undefined} />
            <div className={cards.actions}><button onClick={() => viewDeck(deck)}>View deck</button><button disabled={!authReady || Boolean(importing)} onClick={() => void importPublicDeck(deck)}>{importing === deck.id ? "Importing..." : "Import deck"}</button></div>
          </div>
        </article>;
      })}
    </div>
    <nav className={community.pagination} aria-label="Public deck pages"><button className={styles.importButton} disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1}</span><button className={styles.importButton} disabled={!hasMore || loading} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    {selected && <PublicDeckPreview key={selected.id} deck={selected} onClose={() => setSelected(null)} onImport={() => void importPublicDeck(selected)} importDisabled={!authReady || Boolean(importing)} importing={importing === selected.id} error={importError} imported={imported}>
      <PublicDeckMetrics deck={selected} onLike={userId && userId !== selected.ownerId ? () => void likeDeck(selected) : undefined} likeDisabled={liking} error={likeError?.id === selected.id ? likeError.message : undefined} />
    </PublicDeckPreview>}
  </section>;
}
