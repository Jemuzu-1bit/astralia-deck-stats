import { useEffect, useRef, useState } from "react";
import type { DeckAction, GameCounter, GameZone } from "../../services/gameConnection";
import { getCardImagePath } from "../../services/cardImageService";
import type { Card } from "../../types/Card";
import { normalizeShortcut, useGameShortcuts } from "../gameShortcuts";
import { COUNTER_PRESETS, STATUS_COUNTERS, KEYWORD_EMOJIS, COUNTED_DECK_ACTIONS, isSingleEmoji, type CardStat, type CardMenuPanel, type CountedDeckAction, type CounterChoice } from "./model";
import styles from "../OnlineGamePage.module.scss";

export function Inspector({ card, onClose }: { card: Card | null; onClose: () => void }) {
  return <aside className={`${styles.inspector} ${card ? styles.inspectorOpen : ""}`} aria-label="Card inspection">
    <div className={styles.inspectorHeader}>
      <h2>Card inspection</h2>
      <button type="button" onClick={onClose} aria-label="Close card inspection">Close</button>
    </div>
    {card ? <div className={styles.inspectorContent}>
      <img src={getCardImagePath(card, "full")} alt={card.name} />
      <h3>{card.name}</h3>
      <p>{[card.type, card.subtype].filter(Boolean).join(" · ")}</p>
      <p>{[
        card.cost && `Cost ${card.cost}`,
        card.atk && `ATK ${card.atk}`,
        card.hp && `HP ${card.hp}`,
      ].filter(Boolean).join(" · ")}</p>
      {card.description && <div className={styles.inspectorDescription}>{card.description}</div>}
      {card.keywords && <p className={styles.inspectorKeywords}>{card.keywords}</p>}
    </div> : <p className={styles.inspectorHint}>Hover over a visible card to inspect it here.</p>}
  </aside>;
}

export function ContextMenu({ x, y, initialPanel, revealState, faceDown, statValues, counters, controlLabel, onPlayAction, onAdjustFrazzle, onSetStat, onRemoveStat, onCounterAdjust, onCounterRemove, onSwapWithMain, onStartAttach, onChooseTarget, onClearTarget, onFlip, onToggleFaceDown, onGiveControl, onMove, onToggleReveal, onClose }: {
  x: number;
  y: number;
  initialPanel?: CardMenuPanel;
  revealState?: boolean;
  faceDown?: boolean;
  statValues?: Partial<Record<CardStat, number>>;
  counters?: GameCounter[];
  controlLabel?: string;
  onPlayAction?: () => void;
  onAdjustFrazzle?: (delta: -1 | 1) => void;
  onSetStat?: (stat: CardStat, value: number) => void;
  onRemoveStat?: (stat: CardStat) => void;
  onCounterAdjust?: (counter: CounterChoice, delta: -1 | 1) => void;
  onCounterRemove?: (counter: CounterChoice) => void;
  onSwapWithMain?: () => void;
  onStartAttach?: () => void;
  onChooseTarget?: () => void;
  onClearTarget?: () => void;
  onFlip?: () => void;
  onToggleFaceDown?: () => void;
  onGiveControl?: () => void;
  onMove?: (zone: GameZone, position?: "top" | "bottom") => void;
  onToggleReveal?: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { card: CARD_KEYS, counter: COUNTER_KEYS } = useGameShortcuts();
  const [selectedStat, setSelectedStat] = useState<CardStat | null>(initialPanel === "atk" || initialPanel === "hp" ? initialPanel : null);
  const [showCounters, setShowCounters] = useState(initialPanel === "counters");
  const [counterName, setCounterName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [amount, setAmount] = useState(String(initialPanel === "atk" || initialPanel === "hp" ? statValues?.[initialPanel] ?? 0 : 0));
  const statValue = Number(amount);
  const validStatValue = Number.isInteger(statValue) && statValue >= 0 && statValue <= 999;
  const normalizedCounterName = counterName.trim().replace(/\s+/g, " ");
  const emojiValue = selectedEmoji.trim();
  const validKeywordCounter = normalizedCounterName.length > 0 && normalizedCounterName.length <= 24
    && (!emojiValue || isSingleEmoji(emojiValue));
  const selectStat = (stat: CardStat) => {
    setSelectedStat(stat);
    setAmount(String(statValues?.[stat] ?? 0));
  };
  useEffect(() => { if (showCounters) menuRef.current?.focus(); }, [showCounters]);
  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div ref={menuRef} tabIndex={showCounters ? -1 : undefined} className={`${styles.contextMenu} ${selectedStat || showCounters ? styles.deckMenu : ""}`} role="menu" style={{ left: Math.max(8, Math.min(x, window.innerWidth - 235)), top: Math.max(8, Math.min(y, window.innerHeight - (selectedStat ? 175 : showCounters ? 340 : onMove ? 410 : 150))) }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
    if (!showCounters || event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
    const key = normalizeShortcut(event.nativeEvent);
    const index = Array.from({ length: 7 }, (_, i) => COUNTER_KEYS[`preset${i + 1}` as keyof typeof COUNTER_KEYS]).indexOf(key || "");
    if (index < 0) return;
    event.preventDefault();
    onCounterAdjust?.(COUNTER_PRESETS[index], 1);
  }}>
    {selectedStat ? <form onSubmit={(event) => { event.preventDefault(); if (validStatValue) onSetStat?.(selectedStat, statValue); }}>
      <button type="button" onClick={() => setSelectedStat(null)}>← Actions</button>
      <label htmlFor="card-stat-value">Set {selectedStat.toUpperCase()}</label>
      <input
        id="card-stat-value"
        type="number"
        min={0}
        max={999}
        step={1}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        autoFocus
      />
      <button type="submit" disabled={!validStatValue}>Confirm</button>
    </form> : showCounters ? <div className={styles.counterMenu}>
      <button type="button" onClick={() => setShowCounters(false)}>← Actions</button>
      <small>Use the key shown to increase number counters. Each status marker can appear once; right click it to remove it.</small>
      {Boolean(counters?.length) && <div className={styles.counterMenuCurrent}>
        <strong>On this card</strong>
        {counters?.map((counter) => <div key={`${counter.kind}:${counter.label.toLocaleLowerCase()}:${counter.emoji || ""}`} tabIndex={0} role="group" aria-label={counter.kind === "status" ? `${counter.label}: ${COUNTER_KEYS.remove} removes it` : `${counter.label}: ${COUNTER_KEYS.increase} adds one, ${COUNTER_KEYS.decrease} removes one, ${COUNTER_KEYS.remove} removes all`} title={counter.kind === "status" ? `Focus this marker, then use ${COUNTER_KEYS.remove} to remove it` : `Focus this counter, then use ${COUNTER_KEYS.increase}, ${COUNTER_KEYS.decrease} or ${COUNTER_KEYS.remove}`} onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const key = normalizeShortcut(event.nativeEvent);
          if (key === COUNTER_KEYS.increase || key === COUNTER_KEYS.decrease) { event.preventDefault(); event.stopPropagation(); if (counter.kind !== "status" || key === COUNTER_KEYS.decrease) onCounterAdjust?.(counter, key === COUNTER_KEYS.increase ? 1 : -1); }
          if (key === COUNTER_KEYS.remove) { event.preventDefault(); event.stopPropagation(); onCounterRemove?.(counter); }
        }}>
          <span title={counter.label}>{counter.emoji || counter.label}{counter.kind !== "status" && ` · ${counter.value}`}</span>
          <button type="button" aria-label={`Remove one ${counter.label} counter`} onClick={() => onCounterAdjust?.(counter, -1)}>−</button>
          {counter.kind !== "status" && <button type="button" aria-label={`Add one ${counter.label} counter`} onClick={() => onCounterAdjust?.(counter, 1)}>+</button>}
          <button type="button" aria-label={`Remove all ${counter.label} counters`} onClick={() => onCounterRemove?.(counter)}>Remove</button>
        </div>)}
      </div>}
      <strong>Game counters</strong>
      <div className={styles.counterChoices}>
        {COUNTER_PRESETS.map((counter, index) => <button
          key={counter.emoji}
          type="button"
          title={`${counter.label} counter`}
          onClick={() => onCounterAdjust?.(counter, 1)}
        >{counter.emoji} {counter.label} <kbd>{COUNTER_KEYS[`preset${index + 1}` as keyof typeof COUNTER_KEYS]}</kbd></button>)}
      </div>
      <strong>Status markers</strong>
      <div className={styles.counterChoices}>
        {STATUS_COUNTERS.map((counter) => <button
          key={counter.label}
          type="button"
          disabled={counters?.some((current) => current.kind === "status" && current.label === counter.label)}
          onClick={() => onCounterAdjust?.(counter, 1)}
        >{counter.short} {counter.label}</button>)}
      </div>
      <strong>Custom keyword counter</strong>
      <div className={styles.keywordEmojiPicker} role="group" aria-label="Choose an emoji for the keyword counter">
        {KEYWORD_EMOJIS.map(({ emoji, label }) => <button
          key={emoji}
          type="button"
          title={`${label} emoji`}
          aria-label={`Choose ${label} emoji`}
          aria-pressed={emojiValue === emoji}
          onClick={() => setSelectedEmoji(emoji)}
        >{emoji}</button>)}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (validKeywordCounter) onCounterAdjust?.({
          kind: emojiValue ? "customEmoji" : "name",
          label: normalizedCounterName,
          ...(emojiValue ? { emoji: emojiValue } : {}),
        }, 1);
      }}>
        <label htmlFor="custom-counter-name">Keyword or counter name</label>
        <input id="custom-counter-name" type="text" maxLength={24} value={counterName} onChange={(event) => setCounterName(event.target.value)} placeholder="e.g. Flying" />
        <label htmlFor="custom-counter-emoji">Emoji (optional)</label>
        <input id="custom-counter-emoji" type="text" maxLength={32} value={selectedEmoji} onChange={(event) => setSelectedEmoji(event.target.value)} placeholder="Select above or enter one emoji" />
        {emojiValue && !isSingleEmoji(emojiValue) && <small role="alert">Enter one emoji only.</small>}
        <button type="submit" disabled={!validKeywordCounter}>Add counter</button>
      </form>
    </div> : <>
    {onAdjustFrazzle && <>
      <button type="button" role="menuitem" onClick={() => onAdjustFrazzle(1)}>Add Frazzle <kbd>{CARD_KEYS.frazzleAdd}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onAdjustFrazzle(-1)}>Remove Frazzle <kbd>{CARD_KEYS.frazzleRemove}</kbd></button>
    </>}
    {onSetStat && <>
      <button type="button" role="menuitem" onClick={() => statValues?.atk !== undefined ? onRemoveStat?.("atk") : selectStat("atk")}>{statValues?.atk !== undefined ? "Remove ATK" : "Set ATK"} <kbd>{CARD_KEYS.atk}</kbd></button>
      <button type="button" role="menuitem" onClick={() => statValues?.hp !== undefined ? onRemoveStat?.("hp") : selectStat("hp")}>{statValues?.hp !== undefined ? "Remove HP" : "Set HP"} <kbd>{CARD_KEYS.hp}</kbd></button>
    </>}
    {onCounterAdjust && <button type="button" role="menuitem" onClick={() => setShowCounters(true)}>Counters & markers{counters?.length ? ` · ${counters.length}` : ""}… <kbd>{CARD_KEYS.counters}</kbd></button>}
    {onPlayAction && <button type="button" role="menuitem" onClick={onPlayAction}>Play action <kbd>{CARD_KEYS.play}</kbd></button>}
    {onSwapWithMain && <button type="button" role="menuitem" onClick={onSwapWithMain}>Swap with main card <kbd>{CARD_KEYS.swap}</kbd></button>}
    {onStartAttach && <button type="button" role="menuitem" onClick={onStartAttach}>Attach to... <kbd>{CARD_KEYS.attach}</kbd></button>}
    {onChooseTarget && <button type="button" role="menuitem" onClick={onChooseTarget}>Choose target... <kbd>{CARD_KEYS.target}</kbd></button>}
    {onClearTarget && <button type="button" role="menuitem" onClick={onClearTarget}>Clear target <kbd>{CARD_KEYS.clearTarget}</kbd></button>}
    {onFlip && <button type="button" role="menuitem" onClick={onFlip}>Flip card <kbd>{CARD_KEYS.flip}</kbd></button>}
    {onToggleFaceDown && <button type="button" role="menuitem" onClick={onToggleFaceDown}>{faceDown ? "Turn face up" : "Turn face down"} <kbd>{CARD_KEYS.faceDown}</kbd></button>}
    {onGiveControl && <button type="button" role="menuitem" onClick={onGiveControl}>{controlLabel} <kbd>{CARD_KEYS.control}</kbd></button>}
    {revealState !== undefined && <button type="button" role="menuitem" onClick={onToggleReveal}>{revealState ? "Hide card" : "Reveal card"} <kbd>{CARD_KEYS.reveal}</kbd></button>}
    {onMove && <>
      <hr />
      <button type="button" role="menuitem" onClick={() => onMove("deck", "top")}>Top of deck <kbd>{CARD_KEYS.deckTop}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("deck", "bottom")}>Bottom of deck <kbd>{CARD_KEYS.deckBottom}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("oblivion")}>Oblivion <kbd>{CARD_KEYS.oblivion}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("persona")}>Persona <kbd>{CARD_KEYS.persona}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("hand")}>Hand <kbd>{CARD_KEYS.hand}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onMove("graveyard")}>Graveyard <kbd>{CARD_KEYS.graveyard}</kbd></button>
    </>}
    </>}
  </div>;
}

export function DeckContextMenu({ x, y, initialAction, deckCount, requestMode, requestPending, onAction, onLook, onSearch, onClose }: {
  x: number;
  y: number;
  initialAction?: CountedDeckAction | null;
  deckCount: number;
  requestMode: boolean;
  requestPending: boolean;
  onAction: (action: DeckAction, count?: number) => void;
  onLook: (count: number) => void;
  onSearch: () => void;
  onClose: () => void;
}) {
  const [selectedAction, setSelectedAction] = useState<CountedDeckAction | null>(initialAction ?? null);
  const DECK_KEYS = useGameShortcuts().deck;
  const [amount, setAmount] = useState("1");
  const count = Number(amount);
  const validCount = !requestPending && Number.isInteger(count) && count >= 1 && count <= deckCount;
  const submitSelected = () => {
    if (!selectedAction || !validCount) return;
    if (selectedAction === "look") onLook(count);
    else onAction(selectedAction, count);
  };

  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div
    className={`${styles.contextMenu} ${styles.deckMenu}`}
    role="menu"
    style={{ left: Math.max(8, Math.min(x, window.innerWidth - 235)), top: Math.max(8, Math.min(y, window.innerHeight - (selectedAction ? 175 : 325))) }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {selectedAction ? <form onSubmit={(event) => { event.preventDefault(); submitSelected(); }}>
      <button type="button" onClick={() => setSelectedAction(null)}>← Actions</button>
      <label htmlFor="deck-action-count">{requestMode ? "Ask opponent to " : ""}{COUNTED_DECK_ACTIONS.find(({ action }) => action === selectedAction)?.label.toLowerCase()}</label>
      <input
        id="deck-action-count"
        type="number"
        min={1}
        max={deckCount}
        step={1}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        autoFocus
      />
      <button type="submit" disabled={!validCount}>Confirm</button>
    </form> : <>
      <button type="button" role="menuitem" onClick={() => onAction("shuffle")} disabled={deckCount === 0 || requestPending}>{requestMode ? "Ask opponent to shuffle" : "Shuffle"} <kbd>{DECK_KEYS.shuffle}</kbd></button>
      <button type="button" role="menuitem" onClick={() => onAction("draw", 1)} disabled={deckCount === 0 || requestPending}>{requestMode ? "Ask opponent to draw one" : "Draw one card"} <kbd>{DECK_KEYS.drawOne}</kbd></button>
      <hr />
      {COUNTED_DECK_ACTIONS.map(({ action, label }) => <button
        key={action}
        type="button"
        role="menuitem"
        disabled={deckCount === 0 || requestPending}
        onClick={() => setSelectedAction(action)}
      >{requestMode ? `Ask opponent to ${label.toLowerCase()}` : label} <kbd>{DECK_KEYS[action]}</kbd></button>)}
      <hr />
      <button type="button" role="menuitem" disabled={deckCount === 0 || requestPending} onClick={onSearch}>{requestMode ? "Ask opponent to search deck" : "Search deck"} <kbd>{DECK_KEYS.search}</kbd></button>
    </>}
  </div>;
}
