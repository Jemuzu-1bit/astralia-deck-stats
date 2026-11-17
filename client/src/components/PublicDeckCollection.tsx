import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import type { PublicDeck } from "../domain/publicDecks";
import { listPublicDecks, fetchPublicDeckCopy } from "../services/publicDeckService";
import { createCloudDeck } from "../services/cloudDeckService";
import { createDeck } from "../services/deckService";
import { CHRONICLES } from "../data/chronicles";
import { FACTIONS } from "../domain/deckBuilder";
import { supabase } from "../services/supabaseClient";
import ArchiveIcon from "./ArchiveIcon";
import PublicDeckPreview from "./PublicDeckPreview";
import styles from "../pages/MyDecksPage.module.scss";
import cards from "./DeckCard.module.scss";
import community from "./PublicDeckCollection.module.scss";

export default function PublicDeckCollection({ ownerId }: { ownerId?: string }) {
  const { user, authReady } = useOutletContext<AuthSession>();
  const [search, setSearch] = useState("");
  const [faction, setFaction] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<{ id: string; name: string; cloud: boolean } | null>(null);
  const [selected, setSelected] = useState<PublicDeck | null>(null);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let current = true;
    setLoading(true);
    setError(null);
    setDecks([]);
    setHasMore(false);
    const timer = window.setTimeout(() => {
      void listPublicDecks({ search, faction, page, ownerId }).then(result => {
        if (current) { setDecks(result.decks); setHasMore(result.hasMore); }
      }).catch(() => {
        if (current) setError("Could not load public decks. Please try again.");
      }).finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [search, faction, page, ownerId, reload]);

  const importPublicDeck = async (deck: PublicDeck) => {
    if (!authReady || pending.current) return;
    pending.current = true;
    setImporting(deck.id);
    setImportError(null);
    setImported(null);
    try {
      const input = await fetchPublicDeckCopy(deck.id);
      const saved = user ? await createCloudDeck(input) : createDeck(input);
      if (active.current) setImported({ id: saved.id, name: saved.name, cloud: Boolean(user) });
    } catch (error) {
      if (active.current) setImportError(error instanceof Error ? error.message : "Could not import this deck. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setImporting(null);
    }
  };

  if (!supabase) return <p className={styles.notice}>Public decks will be available when online storage is configured.</p>;
  return <section aria-label={ownerId ? "Published decks" : "Public deck collection"}>
    {ownerId && <h2>Published decks</h2>}
    <div className={styles.libraryToolbar}>
      <label className={styles.deckSearch}><ArchiveIcon name="search" size={17} /><input aria-label="Search public decks" placeholder="Search public decks…" value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      <select aria-label="Filter public decks by chronicle" value={faction} onChange={event => { setFaction(event.target.value); setPage(0); }}><option value="">All chronicles</option>{FACTIONS.map(value => <option key={value} value={value}>{CHRONICLES[value].name}</option>)}</select>
    </div>
    {!user && <p className={styles.notice}>Imports are saved on this device. Sign in with Discord to save them to your account.</p>}
    {imported && <p role="status" className={community.success}>“{imported.name}” imported as a private copy {imported.cloud ? "to your account" : "on this device"}. <Link to={`/my-decks?edit=${encodeURIComponent(imported.id)}`}>Open my copy →</Link></p>}
    {importError && <p role="alert" className={styles.error}>{importError}</p>}
    {loading && <p role="status" className={styles.notice}>Loading public decks...</p>}
    {error && <div role="alert" className={styles.error}><p>{error}</p><button className={styles.importButton} onClick={() => setReload(value => value + 1)}>Try again</button></div>}
    {!loading && !error && decks.length === 0 && <div className={styles.empty}><ArchiveIcon name="decks" size={34} /><h2>{search || faction ? "No matching decks" : "No published decks yet"}</h2><p>{search || faction ? "Try a different name or chronicle." : "Published strategies will appear here."}</p>{(search || faction) && <button onClick={() => { setSearch(""); setFaction(""); setPage(0); }}>Reset filters</button>}</div>}
    <div className={styles.deckSlots}>
      {decks.map(deck => {
        const chronicle = CHRONICLES[deck.faction];
        return <article key={deck.id} className={cards.card}>
          <button className={cards.cover} onClick={() => setSelected(deck)} aria-label={`View ${deck.name}`} style={{ backgroundImage: `linear-gradient(0deg, #1b1c21, #1b1c2110), url(${deck.backgroundImage || chronicle?.image || ""})` }}><span className={cards.status}>Public</span><span className={cards.faction} style={{ color: chronicle?.color }}>CHRONICLE OF {chronicle?.name.toUpperCase() ?? deck.faction.toUpperCase()}</span></button>
          <div className={cards.info}>
            <button className={cards.title} onClick={() => setSelected(deck)}>{deck.name}</button>
            <Link className={community.author} to={`/players/${deck.ownerId}`}>By {deck.author?.name || "Player"} <ArchiveIcon name="arrow" size={13} /></Link>
            <div className={cards.meta}><span>{deck.deck.reduce((sum, entry) => sum + entry.qty, 0)} cards · {deck.persona.length} persona</span><span>{new Date(deck.publishedAt ?? deck.updatedAt).toLocaleDateString()}</span></div>
            <div className={cards.actions}><button onClick={() => setSelected(deck)}>View deck</button><button disabled={!authReady || Boolean(importing)} onClick={() => void importPublicDeck(deck)}>{importing === deck.id ? "Importing..." : "Import deck"}</button></div>
          </div>
        </article>;
      })}
    </div>
    <nav className={community.pagination} aria-label="Public deck pages"><button className={styles.importButton} disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1}</span><button className={styles.importButton} disabled={!hasMore || loading} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    {selected && <PublicDeckPreview key={selected.id} deck={selected} onClose={() => setSelected(null)} onImport={() => void importPublicDeck(selected)} importDisabled={!authReady || Boolean(importing)} importing={importing === selected.id} error={importError} imported={imported} />}
  </section>;
}
