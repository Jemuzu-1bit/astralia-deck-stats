import { useEffect, useState } from "react";
import DeckCard from "../components/DeckCard.tsx";
import type { Deck } from "../types/Deck";
import {
  listDecks,
  deleteDeck,
  exportDeck,
  importDeck,
  createDeck,
} from "../services/deckService";
import DeckCreationModal from "../components/DeckCreationModal";
import ModalDialog from "../components/ModalDialog";
import styles from "./MyDecksPage.module.scss";
import modalStyles from "../components/ModalDialog.module.scss";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function MyDecksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = () => setDecks(listDecks());

  useEffect(() => {
    refresh();
  }, []);

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
    const code = await exportDeck(deck);
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
      const saved = createDeck(imported);
      setDecks((currentDecks) => [saved, ...currentDecks]);
      closeImport();
      setImportCode("");
    } catch {
      setImportError("Invalid or unsupported deck code");
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
        <DeckCard isAddButton onAddSaved={() => refresh()} />
      </div>

      {editingDeck && (
        <DeckCreationModal
          initialDeck={editingDeck.id === "temp" ? undefined : editingDeck}
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
            onClick: () => {
              if (deckToDelete) {
                deleteDeck(deckToDelete.id);
                refresh();
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
