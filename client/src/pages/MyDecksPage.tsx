import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "../hooks/useAuthSession";
import DeckCard from "../components/DeckCard.tsx";
import type { Deck } from "../types/Deck";
import {
  listDecks,
  deleteDeck,
  exportDeck,
  importDeck,
  saveLocalDeck,
  mergeLocalDecks,
} from "../services/deckService";
import { parseDeckBackup, serializeDeckBackup } from "../services/deckBackup";
import DeckCreationModal from "../components/DeckCreationModal";
import ModalDialog from "../components/ModalDialog";
import styles from "./MyDecksPage.module.scss";
import modalStyles from "../components/ModalDialog.module.scss";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { createCloudDeck, deleteCloudDeck, importLocalDecks, listCloudDecks, updateCloudDeck, setDeckVisibility } from "../services/cloudDeckService";

import ArchiveIcon from "../components/ArchiveIcon";
import { FACTIONS } from "../domain/deckBuilder";
import { ChronicleSelect } from "../components/ChronicleLabel";

export default function MyDecksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [publishingDeck, setPublishingDeck] = useState<Deck | null>(null);
  const [publicationDescription, setPublicationDescription] = useState("");
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const [publicationMessage, setPublicationMessage] = useState<string | null>(null);
  const publicationPending = useRef(false);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { user, authReady } = useOutletContext<AuthSession>();
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [localDecks, setLocalDecks] = useState<Deck[]>(() => listDecks());
  const [importingLocal, setImportingLocal] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [faction, setFaction] = useState("");
  const [sort, setSort] = useState("recent");
  const params = new URLSearchParams(location.search);
  const creatingDeck = params.has("new");
  const requestedFaction = params.get("faction") ?? "";
  const visibleDecks = decks.filter(deck => (!faction || deck.faction === faction) && deck.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt);

  useEffect(() => {
    const editId = new URLSearchParams(location.search).get("edit");
    if (!editId || !authReady || loading) return;
    const deck = decks.find(item => item.id === editId);
    if (deck) { setEditingDeck(deck); navigate("/my-decks", { replace: true }); }
  }, [location.search, decks, authReady, loading, navigate]);

  const refresh = () => {
    setLocalDecks(listDecks());
    setReloadVersion((value) => value + 1);
  };

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    setLoading(true);
    setPageError(null);
    if (!user) {
      setDecks(listDecks());
      setLoading(false);
    } else {
      setDecks([]);
      void listCloudDecks().then((result) => {
        if (active) setDecks(result);
      }).catch((error: unknown) => {
        if (active) {
          setDecks([]);
          setPageError(error instanceof Error ? error.message : "Could not load your decks.");
        }
      }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [user, authReady, reloadVersion]);

  const saveDeck = async (input: Omit<Deck, "id" | "updatedAt">, initialDeck?: Deck): Promise<Deck> => {
    if (user) return initialDeck
      ? updateCloudDeck({ ...input, id: initialDeck.id, updatedAt: initialDeck.updatedAt, revision: initialDeck.revision })
      : createCloudDeck(input);
    return saveLocalDeck(input, initialDeck);
  };

  useEffect(() => {
    if (!new URLSearchParams(location.search).get("deck")) return;
    setImportCode(new URL(`/my-decks${location.search}`, window.location.origin).toString());
    setImportError(null);
    setShowImport(true);
  }, [location.search]);

  const closeImport = () => {
    setShowImport(false);
    setImportError(null);
    if (new URLSearchParams(location.search).has("deck")) navigate("/my-decks", { replace: true });
  };

  const handleShare = async (deck: Deck) => {
    let code: string;
    try { code = await exportDeck(deck); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Could not export this deck."); return; }
    setShareCode(code);
    setShareTitle(deck.name || "Untitled Deck");
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    setShowShare(true);
  };

  const [showShare, setShowShare] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [showDelete, setShowDelete] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

  const processImport = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setImportError("Please paste a deck code.");
      return;
    }
    try {
      const imported = await importDeck(trimmed);
      const saved = await saveDeck(imported);
      setDecks((currentDecks) => [saved, ...currentDecks]);
      refresh();
      closeImport();
      setImportCode("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import this deck.");
    }
  };

  const downloadBrowserDecks = () => {
    const blob = new Blob([serializeDeckBackup(localDecks)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `astralia-decks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importBackupFile = async (file: File) => {
    setImportingBackup(true);
    setBackupMessage(null);
    setPageError(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Backup file is too large (maximum 25 MB).");
      const imported = parseDeckBackup(await file.text());
      const count = user ? await importLocalDecks(imported) : mergeLocalDecks(imported);
      setBackupMessage(`${count} deck${count === 1 ? "" : "s"} imported. Existing decks and the backup file were kept.`);
      refresh();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not import the backup.");
      refresh();
    } finally {
      setImportingBackup(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>YOUR COLLECTION</span><h1>My decks <span>{decks.length}</span></h1><p>A home for every strategy. Keep building.</p></div>
        <div className={styles.headerActions}><button className={styles.importButton} onClick={() => setShowImport(true)}>Import deck</button><button className={styles.newButton} disabled={!authReady} onClick={() => navigate("/my-decks?new=1")}><ArchiveIcon name="plus" size={17} /> New deck</button></div>
      </header>
      <p className={styles.notice}><Link to="/public-decks">Explore public decks →</Link>{!user && " Sign in with Discord and copy your local decks to publish them."}</p>
      {publicationMessage && <p role="status" className={styles.notice}>{publicationMessage}</p>}
      <details className={styles.backupPanel}><summary>Backups &amp; transfers</summary>
      <div className={styles.backupActions}>
        <button type="button" className={styles.importButton} disabled={!authReady || importingBackup}
          onClick={() => backupInput.current?.click()}>
          {importingBackup ? "Importing..." : "Import backup"}
        </button>
        {localDecks.length > 0 && <button type="button" className={styles.importButton}
          onClick={downloadBrowserDecks}>Download browser decks</button>}
        <input ref={backupInput} type="file" accept=".json,application/json" hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void importBackupFile(file);
          }} />
      </div>
      <p className={styles.backupHint}>Moving from the old Render site? Download your browser decks there, then import the backup here.</p>
      </details>
      {backupMessage && <p role="status" className={styles.notice}>{backupMessage}</p>}
      {supabase && <section className={styles.accountPanel} aria-label="Deck storage">
        {user ? <>
          <span>Cloud decks</span>
          {localDecks.length > 0 && <button type="button" disabled={importingLocal} onClick={async () => {
            setImportingLocal(true);
            setPageError(null);
            try {
              const count = await importLocalDecks(localDecks);
              setTransferMessage(`${count} deck${count === 1 ? "" : "s"} copied from this browser. Local copies were kept.`);
              refresh();
            } catch (error) {
              setPageError(error instanceof Error ? error.message : "Could not copy local decks.");
            } finally { setImportingLocal(false); }
          }}>{importingLocal ? "Copying..." : `Copy local decks (${localDecks.length})`}</button>}
        </> : <span>Decks on this device</span>}
        {user && transferMessage && <p role="status">{transferMessage}</p>}
      </section>}
      {!supabase && <p className={styles.notice}>Decks are saved on this device. Download a backup to keep a copy.</p>}
      {pageError && <p role="alert" className={styles.error}>{pageError}</p>}
      {loading && <p className={styles.notice}>Loading decks...</p>}
      <div className={styles.libraryToolbar}>
        <label className={styles.deckSearch}><ArchiveIcon name="search" size={17} /><input aria-label="Search decks" placeholder="Search your decks…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <ChronicleSelect aria-label="Filter decks by chronicle" value={faction} emptyLabel="All chronicles" onChange={event => setFaction(event.target.value)} />
        <select aria-label="Sort decks" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently updated</option><option value="name">Name</option></select>
      </div>
      {!loading && visibleDecks.length === 0 && <div className={styles.empty}><ArchiveIcon name="decks" size={34} /><h2>{decks.length ? "No matching decks" : "Your next great deck starts here."}</h2><p>{decks.length ? "Try a different name or chronicle." : "Choose your chronicle, discover your cards, and start building."}</p>{decks.length > 0 && <button onClick={() => { setSearch(""); setFaction(""); }}>Reset filters</button>}</div>}
      <div className={styles.deckSlots}>
        {visibleDecks.map((d) => (
          <DeckCard
            key={d.id}
            deck={d}
            onEdit={(deck) => setEditingDeck(deck)}
            onDelete={(deck) => {
              setDeckToDelete(deck);
              setShowDelete(true);
            }}
            onShare={handleShare}
            onPublish={user ? (deck) => { setPublicationError(null); setPublicationDescription(deck.description ?? ""); setPublishingDeck(deck); } : undefined}
          />
        ))}
        <button className={styles.createTile} disabled={!authReady} onClick={() => navigate("/my-decks?new=1")}><span><ArchiveIcon name="plus" size={26} /></span><strong>Create a new deck</strong><small>Your next chapter awaits</small></button>
      </div>

      {creatingDeck && authReady && <DeckCreationModal initialFaction={FACTIONS.includes(requestedFaction as typeof FACTIONS[number]) ? requestedFaction : undefined} saveDeck={saveDeck} onClose={() => navigate("/my-decks", { replace: true })} onSaved={() => refresh()} />}

      {editingDeck && (
        <DeckCreationModal
          initialDeck={editingDeck.id === "temp" ? undefined : editingDeck}
          saveDeck={saveDeck}
          onClose={() => setEditingDeck(null)}
          onSaved={() => {
            setEditingDeck(null);
            refresh();
          }}
        />
      )}

      {publishingDeck && <ModalDialog
        title={publishingDeck.visibility === "public" ? "Unpublish deck" : "Publish deck"}
        ariaId="publish-title"
        onClose={() => { if (!publicationPending.current) setPublishingDeck(null); }}
        secondary={{ label: "Cancel", disabled: publicationBusy, onClick: () => setPublishingDeck(null) }}
        primary={{ label: publicationBusy ? "Saving..." : publishingDeck.visibility === "public" ? "Unpublish" : "Publish", disabled: publicationBusy, onClick: async () => {
          if (publicationPending.current) return;
          publicationPending.current = true;
          setPublicationBusy(true);
          setPublicationError(null);
          try {
            const visibility = publishingDeck.visibility === "public" ? "private" : "public";
            const saved = await setDeckVisibility(publishingDeck, visibility, visibility === "public" ? publicationDescription : undefined);
            setDecks(current => current.map(deck => deck.id === saved.id ? saved : deck));
            setPublicationMessage(visibility === "public" ? "Deck published. Other players can now view and import it." : "Deck is private again.");
            setPublishingDeck(null);
          } catch (error) {
            setPublicationError(error instanceof Error ? error.message : "Could not change deck visibility. Close this dialog and reload to try again.");
          } finally { publicationPending.current = false; setPublicationBusy(false); }
        } }}>
        <p>{publishingDeck.visibility === "public"
          ? "This deck will disappear from the public collection. Copies already imported by other players will remain theirs."
          : "Everyone will be able to view and import this deck and see your player profile: name, avatar, bio, favorite chronicle and website. Saved edits to this deck will also be public."}</p>
        {publishingDeck.visibility !== "public" && <label className={styles.publicationDescription}>Deck description (optional)<textarea rows={5} maxLength={5000} value={publicationDescription} disabled={publicationBusy} onChange={event => setPublicationDescription(event.target.value)} placeholder="Introduce your strategy to other players." /><span>{publicationDescription.length}/5000 · You can also edit this in the deck builder.</span></label>}
        {publicationError && <p role="alert" className={styles.error}>{publicationError}</p>}
      </ModalDialog>}

      {showShare && (
        <ModalDialog
          title={`Share: ${shareTitle}`}
          ariaId="shareTitle"
          onClose={() => setShowShare(false)}
          secondary={{ label: "Close", onClick: () => setShowShare(false) }}
        >
          <div style={{ paddingTop: 8 }}>
            <div style={{ color: copyStatus === "copied" ? "#9ee6b4" : "#ffb4b4", fontWeight: 700, marginBottom: 8 }}>
              {copyStatus === "copied" ? "Deck link copied to clipboard." : "Copy the deck link below."}
            </div>
            <div style={{ marginBottom: 8 }}>Open this official link, or paste it into Import Deck here.</div>
            <textarea className={modalStyles.codeInput} rows={3} readOnly value={shareCode} onFocus={(event) => event.target.select()} />
          </div>
        </ModalDialog>
      )}

      {showImport && (
        <ModalDialog
          title="Import Deck"
          ariaId="importTitle"
          onClose={closeImport}
          secondary={{
            label: "Cancel",
            onClick: closeImport,
          }}
          primary={{
            label: "Import",
            onClick: () => processImport(importCode),
          }}
        >
          <textarea
            className={modalStyles.codeInput}
            rows={3}
            placeholder="Paste code..."
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
          />
          {importError && (
            <div className={modalStyles.errorText}>{importError}</div>
          )}
        </ModalDialog>
      )}

      {showDelete && deckToDelete && (
        <ModalDialog
          title={`Delete: ${deckToDelete.name}`}
          ariaId="deleteTitle"
          onClose={() => {
            setShowDelete(false);
            setDeckToDelete(null);
          }}
          secondary={{
            label: "Cancel",
            onClick: () => {
              setShowDelete(false);
              setDeckToDelete(null);
            },
          }}
          primary={{
            label: "Delete",
            onClick: async () => {
              if (deckToDelete) {
                try {
                  if (user) await deleteCloudDeck(deckToDelete.id);
                  else deleteDeck(deckToDelete.id);
                  refresh();
                } catch (error) {
                  setPageError(error instanceof Error ? error.message : "Could not delete this deck.");
                  return;
                }
              }
              setShowDelete(false);
              setDeckToDelete(null);
            },
          }}
        >
          <div>
            Are you sure you want to delete this deck? This action cannot be
            undone.
          </div>
        </ModalDialog>
      )}
    </div>
  );

}
