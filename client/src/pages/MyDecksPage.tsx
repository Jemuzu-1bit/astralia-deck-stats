import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import DeckCard from "../components/DeckCard.tsx";
import type { Deck } from "../types/Deck";
import {
  listDecks,
  deleteDeck,
  exportDeck,
  importDeck,
  createDeck,
  updateDeck,
} from "../services/deckService";
import DeckCreationModal from "../components/DeckCreationModal";
import ModalDialog from "../components/ModalDialog";
import styles from "./MyDecksPage.module.scss";
import modalStyles from "../components/ModalDialog.module.scss";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { createCloudDeck, deleteCloudDeck, importLocalDecks, listCloudDecks, updateCloudDeck } from "../services/cloudDeckService";

export default function MyDecksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [localDecks, setLocalDecks] = useState<Deck[]>(() => listDecks());
  const [importingLocal, setImportingLocal] = useState(false);

  const refresh = () => {
    setLocalDecks(listDecks());
    setReloadVersion((value) => value + 1);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setPageError(error.message);
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setAuthReady(true);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

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
    return initialDeck
      ? updateDeck({ ...input, id: initialDeck.id, updatedAt: initialDeck.updatedAt })
      : createDeck(input);
  };

  const signIn = async (register: boolean) => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const { data, error } = register
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      setAuthMessage(error?.message ?? (register && !data.session
        ? "Check your email to confirm your account, then sign in."
        : null));
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not connect to sign in.");
    } finally {
      setAuthBusy(false);
    }
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

  return (
    <div className={styles.pageRoot}>
      <div className={styles.pageHeader}>
        <Link to="/" className={styles.homeButton} aria-label="Home">
          <svg
            className={styles.homeIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.homeLabel}>Home</span>
        </Link>
        <h1>My Decks</h1>
        <Link to="/help" className={styles.helpLink}>Guide</Link>
      </div>
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}
      >
        <button
          className={styles.importButton}
          onClick={() => setShowImport(true)}
        >
          Import Deck
        </button>
      </div>
      {supabase && <section className={styles.accountPanel} aria-label="Deck account">
        {user ? <>
          <span>Cloud decks · {user.email}</span>
          <button type="button" onClick={() => void supabase?.auth.signOut()}>Sign out</button>
          {localDecks.length > 0 && <button type="button" disabled={importingLocal} onClick={async () => {
            setImportingLocal(true);
            setPageError(null);
            try {
              const count = await importLocalDecks(localDecks);
              setAuthMessage(`${count} deck${count === 1 ? "" : "s"} copied from this browser. Local copies were kept.`);
              refresh();
            } catch (error) {
              setPageError(error instanceof Error ? error.message : "Could not copy local decks.");
            } finally { setImportingLocal(false); }
          }}>{importingLocal ? "Copying..." : `Copy local decks (${localDecks.length})`}</button>}
        </> : <>
          <span>Decks on this device · Sign in to save them online</span>
          <form onSubmit={(event) => { event.preventDefault(); void signIn(false); }}>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required aria-label="Email" />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={6} required aria-label="Password" />
            <button type="submit" disabled={authBusy}>Sign in</button>
            <button type="button" disabled={authBusy || !email || password.length < 6} onClick={() => void signIn(true)}>Create account</button>
          </form>
        </>}
        {authMessage && <p role="status">{authMessage}</p>}
      </section>}
      {!supabase && <p className={styles.notice}>Decks are saved on this device. Configure Supabase to enable cloud accounts.</p>}
      {pageError && <p role="alert" className={styles.error}>{pageError}</p>}
      {loading && <p className={styles.notice}>Loading decks...</p>}
      <div className={styles.deckSlots}>
        {decks.map((d) => (
          <DeckCard
            key={d.id}
            deck={d}
            onEdit={(deck) => setEditingDeck(deck)}
            onDelete={(deck) => {
              setDeckToDelete(deck);
              setShowDelete(true);
            }}
            onShare={handleShare}
          />
        ))}
        <DeckCard isAddButton onAddSaved={() => refresh()} saveDeck={saveDeck} />
      </div>

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
