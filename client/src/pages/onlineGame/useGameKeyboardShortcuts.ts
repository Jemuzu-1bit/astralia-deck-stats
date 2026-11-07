import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { gameConnection, type GameTable, type LobbyPlayerState, type LobbyState } from "../../services/gameConnection";
import type { Card } from "../../types/Card";
import { normalizeShortcut, type ShortcutBindings } from "../gameShortcuts";
import { findSlottedCard, tableCards, type CardMenuPanel, type CombatSelection, type CountedDeckAction, type OpenSlot, type OpenZone } from "./model";

type CardMenuState = { uid: string; x: number; y: number; isAction: boolean; canFlip: boolean; panel?: CardMenuPanel };
type DeckMenuState = { x: number; y: number; owner: "self" | "opponent"; action?: CountedDeckAction | null };

type KeyboardOptions = {
  rootRef: RefObject<HTMLDivElement | null>;
  pointerPosition: RefObject<{ x: number; y: number } | null>;
  isSpectator: boolean;
  state: LobbyState;
  me: LobbyPlayerState | null;
  opponent: LobbyPlayerState | null;
  myTable: GameTable;
  menu: CardMenuState | null;
  deckMenu: DeckMenuState | null;
  CARD_KEYS: ShortcutBindings["card"];
  DECK_KEYS: ShortcutBindings["deck"];
  FRAGMENT_KEYS: ShortcutBindings["fragment"];
  COUNTER_KEYS: ShortcutBindings["counter"];
  shortcutSettingsOpen: boolean;
  gameMenuOpen: boolean;
  setMenu: Dispatch<SetStateAction<CardMenuState | null>>;
  setDeckMenu: Dispatch<SetStateAction<DeckMenuState | null>>;
  setOpenZone: Dispatch<SetStateAction<OpenZone | null>>;
  setOpenSlot: Dispatch<SetStateAction<OpenSlot | null>>;
  setPeekedUids: Dispatch<SetStateAction<string[] | null>>;
  setDeckSearchQuery: Dispatch<SetStateAction<string | null>>;
  setInspectedCard: Dispatch<SetStateAction<Card | null>>;
  setAttachingUid: Dispatch<SetStateAction<string | null>>;
  setTargetingUid: Dispatch<SetStateAction<string | null>>;
  setCombatSelection: Dispatch<SetStateAction<CombatSelection | null>>;
};

export function useGameKeyboardShortcuts({ rootRef, pointerPosition, isSpectator, state, me, opponent, myTable, menu, deckMenu, CARD_KEYS, DECK_KEYS, FRAGMENT_KEYS, COUNTER_KEYS, shortcutSettingsOpen, gameMenuOpen, setMenu, setDeckMenu, setOpenZone, setOpenSlot, setPeekedUids, setDeckSearchQuery, setInspectedCard, setAttachingUid, setTargetingUid, setCombatSelection }: KeyboardOptions) {
  useEffect(() => {
    if (isSpectator || !state.started || !me?.table || shortcutSettingsOpen || gameMenuOpen) return;
    const onGameKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"))) return;
      const shortcut = normalizeShortcut(event);
      if (!shortcut) return;
      const pointer = pointerPosition.current;
      const hovered = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
      const counterElement = !menu && !deckMenu && hovered instanceof Element
        ? hovered.closest<HTMLElement>("[data-game-counter]") : null;
      if (counterElement && rootRef.current?.contains(counterElement)) {
        const delta = shortcut === COUNTER_KEYS.increase ? 1
          : shortcut === COUNTER_KEYS.decrease ? -1 : null;
        if (delta !== null) {
          const counterCard = tableCards(myTable).find((item) => item.uid === counterElement.dataset.counterUid);
          if (!counterCard || !findSlottedCard(myTable, counterCard.uid)) return;
          if (counterElement.dataset.gameCounter === "frazzle") gameConnection.adjustCardFrazzle(counterCard.uid, delta);
          else if (counterElement.dataset.gameCounter === "atk" || counterElement.dataset.gameCounter === "hp") {
            gameConnection.adjustCardStat(counterCard.uid, counterElement.dataset.gameCounter, delta);
          } else {
            const current = counterCard.counters?.find((item) => item.kind === counterElement.dataset.counterKind
              && item.label === counterElement.dataset.counterLabel && (item.emoji ?? "") === (counterElement.dataset.counterEmoji ?? ""));
            if (!current) return;
            if (current.kind !== "status" || delta === -1) gameConnection.adjustCardCounter(counterCard.uid, current, delta);
          }
          event.preventDefault();
          return;
        }
        if (shortcut === COUNTER_KEYS.remove && counterElement.dataset.gameCounter === "custom") {
          const counterCard = tableCards(myTable).find((item) => item.uid === counterElement.dataset.counterUid);
          const current = counterCard?.counters?.find((item) => item.kind === counterElement.dataset.counterKind
            && item.label === counterElement.dataset.counterLabel && (item.emoji ?? "") === (counterElement.dataset.counterEmoji ?? ""));
          if (counterCard && current && findSlottedCard(myTable, counterCard.uid)) {
            gameConnection.removeCardCounter(counterCard.uid, current);
            event.preventDefault();
            return;
          }
        }
      }
      const hoveredCard = hovered instanceof Element ? hovered.closest<HTMLElement>("[data-card-uid]")
        ?? (counterElement && rootRef.current
          ? [...rootRef.current.querySelectorAll<HTMLElement>("[data-card-uid]")].find((item) => item.dataset.cardUid === counterElement.dataset.counterUid) ?? null
          : null) : null;
      const focused = document.activeElement;
      const focusedCard = focused instanceof HTMLElement && focused.matches("[data-card-uid]:focus-visible") ? focused : null;
      const menuCardElement = menu && rootRef.current
        ? [...rootRef.current.querySelectorAll<HTMLElement>("[data-card-uid]")].find((item) => item.dataset.cardUid === menu.uid)
        : null;
      const element = menuCardElement ?? (deckMenu ? null : hoveredCard ?? focusedCard);
      const deckElement = deckMenu && rootRef.current
        ? rootRef.current.querySelector<HTMLElement>(`[data-deck-owner="${deckMenu.owner}"]`)
        : hovered instanceof Element ? hovered.closest<HTMLElement>("[data-deck-owner]") : null;
      const fragmentElement = !menu && !deckMenu
        ? hovered instanceof Element ? hovered.closest<HTMLElement>("[data-fragment-dock]")
          : focused instanceof HTMLElement && focused.matches(":focus-visible") ? focused.closest<HTMLElement>("[data-fragment-dock]") : null
        : null;
      if (fragmentElement && rootRef.current?.contains(fragmentElement)) {
        const fragments = myTable.fragments;
        const available = fragments.filter((spent) => !spent).length;
        const spent = fragments.length - available;
        const index = Array.from({ length: 10 }, (_, i) => FRAGMENT_KEYS[`toggle${i + 1}` as keyof typeof FRAGMENT_KEYS]).indexOf(shortcut);
        if (index >= 0 && index < fragments.length) {
          gameConnection.setFragmentSpent(index, !fragments[index]);
        } else if (shortcut === FRAGMENT_KEYS.add && fragments.length < 10) gameConnection.updateFragments("add");
        else if (shortcut === FRAGMENT_KEYS.remove && fragments.length > 0) gameConnection.updateFragments("remove");
        else if (shortcut === FRAGMENT_KEYS.spend && available > 0) gameConnection.updateFragments("spend");
        else if (shortcut === FRAGMENT_KEYS.recover && spent > 0) gameConnection.updateFragments("recover");
        else if (shortcut === FRAGMENT_KEYS.spendAll && available > 0) gameConnection.updateFragments("spendAll");
        else if (shortcut === FRAGMENT_KEYS.recoverAll && spent > 0) gameConnection.updateFragments("recoverAll");
        else return;
        event.preventDefault();
        return;
      }
      if (deckElement && (deckMenu || (!menuCardElement && !hoveredCard)) && rootRef.current?.contains(deckElement)) {
        const owner = deckElement.dataset.deckOwner === "opponent" ? "opponent" : "self";
        const deckCount = owner === "self" ? myTable.deck.length : opponent?.deckCount ?? 0;
        const pending = owner === "opponent" && (Boolean(state.deckRequest) || !opponent?.connected);
        if (deckCount === 0 || pending) return;
        let handled = true;
        let counted: CountedDeckAction | null = null;
        switch (shortcut) {
          case DECK_KEYS.shuffle:
            if (owner === "self") gameConnection.deckAction("shuffle");
            else gameConnection.requestDeckAction("shuffle");
            break;
          case DECK_KEYS.drawOne:
            if (owner === "self") gameConnection.deckAction("draw", 1);
            else gameConnection.requestDeckAction("draw", 1);
            break;
          case DECK_KEYS.draw: counted = "draw"; break;
          case DECK_KEYS.discard: counted = "discard"; break;
          case DECK_KEYS.look: counted = "look"; break;
          case DECK_KEYS.oblivion: counted = "oblivion"; break;
          case DECK_KEYS.search:
            if (owner === "self") {
              setDeckSearchQuery(""); setPeekedUids(null); setOpenZone(null); setOpenSlot(null);
            } else gameConnection.requestDeckAction("search");
            break;
          default: handled = false;
        }
        if (!handled) return;
        event.preventDefault();
        if (counted) {
          const rect = deckElement.getBoundingClientRect();
          setDeckMenu({ owner, x: deckMenu?.x ?? rect.right, y: deckMenu?.y ?? rect.top, action: counted });
        } else {
          setDeckMenu(null);
          if (owner === "self" && shortcut !== DECK_KEYS.search) {
            setOpenZone(null); setOpenSlot(null); setPeekedUids(null); setDeckSearchQuery(null);
          }
        }
        setInspectedCard(null);
        return;
      }
      if (!element || !rootRef.current?.contains(element)) return;
      const uid = element.dataset.cardUid;
      const card = tableCards(myTable).find((item) => item.uid === uid);
      if (!card) return;
      const slotted = findSlottedCard(myTable, card.uid);
      const inHand = myTable.hand.some((item) => item.uid === card.uid);
      const inDeck = myTable.deck.some((item) => item.uid === card.uid);
      const inAction = myTable.action.some((item) => item.uid === card.uid);
      const openPanel = (panel: CardMenuPanel) => {
        const rect = element.getBoundingClientRect();
        setMenu({ uid: card.uid, x: menu?.x ?? rect.right, y: menu?.y ?? rect.top,
          isAction: element.dataset.isAction === "true", canFlip: element.dataset.canFlip === "true", panel });
      };
      let handled = true;
      let keepMenu = false;
      switch (shortcut) {
        case CARD_KEYS.graveyard: gameConnection.moveCard(card.uid, "graveyard"); break;
        case CARD_KEYS.oblivion: gameConnection.moveCard(card.uid, "oblivion"); break;
        case CARD_KEYS.hand: gameConnection.moveCard(card.uid, "hand"); break;
        case CARD_KEYS.persona: gameConnection.moveCard(card.uid, "persona"); break;
        case CARD_KEYS.deckTop: gameConnection.moveCard(card.uid, "deck", { position: "top" }); break;
        case CARD_KEYS.deckBottom: gameConnection.moveCard(card.uid, "deck", { position: "bottom" }); break;
        case CARD_KEYS.frazzleAdd:
        case CARD_KEYS.frazzleRemove:
          if (slotted) gameConnection.adjustCardFrazzle(card.uid, shortcut === CARD_KEYS.frazzleAdd ? 1 : -1);
          else handled = false;
          break;
        case CARD_KEYS.atk:
        case CARD_KEYS.hp: {
          if (!slotted) { handled = false; break; }
          const stat = shortcut === CARD_KEYS.atk ? "atk" : "hp";
          if (slotted.card[stat] !== undefined) gameConnection.removeCardStat(card.uid, stat);
          else { openPanel(stat); keepMenu = true; }
          break;
        }
        case CARD_KEYS.counters:
          if (slotted) { openPanel("counters"); keepMenu = true; }
          else handled = false;
          break;
        case CARD_KEYS.attach:
          if (!inAction && (!slotted || (slotted.index === 0 && !slotted.card.isProtagonist))) {
            setAttachingUid(card.uid); setTargetingUid(null); setCombatSelection(null);
          } else handled = false;
          break;
        case CARD_KEYS.control:
          if (slotted && !slotted.card.isProtagonist && opponent?.table) {
            gameConnection.giveCardControl(card.uid); setAttachingUid(null); setTargetingUid(null); setCombatSelection(null);
          } else handled = false;
          break;
        case CARD_KEYS.flip:
          if (element.dataset.canFlip === "true") gameConnection.flipCard(card.uid);
          else handled = false;
          break;
        case CARD_KEYS.faceDown:
          if (inHand && shortcut === CARD_KEYS.reveal) gameConnection.setCardRevealed(card.uid, !card.revealed);
          else if (!inHand && !inDeck) gameConnection.setCardFaceDown(card.uid, !card.faceDown);
          else handled = false;
          break;
        case CARD_KEYS.reveal:
          if (inHand) gameConnection.setCardRevealed(card.uid, !card.revealed);
          else handled = false;
          break;
        case CARD_KEYS.target:
          setTargetingUid((current) => current === card.uid ? null : card.uid);
          setAttachingUid(null);
          setCombatSelection(null);
          break;
        case CARD_KEYS.clearTarget:
          if (card.targetUid && (card.targetExpiresAt ?? 0) > Date.now()) gameConnection.setCardTarget(card.uid, null);
          else handled = false;
          break;
        case CARD_KEYS.play:
          if (inHand && element.dataset.isAction === "true") gameConnection.playAction(card.uid);
          else if (shortcut === CARD_KEYS.swap && slotted && slotted.index > 0) gameConnection.swapSlotCard(card.uid);
          else handled = false;
          break;
        case CARD_KEYS.swap:
          if (slotted && slotted.index > 0) gameConnection.swapSlotCard(card.uid);
          else handled = false;
          break;
        default: handled = false;
      }
      if (handled) {
        event.preventDefault();
        if (!keepMenu) setMenu(null);
        setDeckMenu(null);
        setInspectedCard(null);
      }
    };
    window.addEventListener("keydown", onGameKeyDown);
    return () => window.removeEventListener("keydown", onGameKeyDown);
  }, [isSpectator, state.started, me?.table, myTable, opponent, state.deckRequest, menu, deckMenu, CARD_KEYS, DECK_KEYS, FRAGMENT_KEYS, COUNTER_KEYS, shortcutSettingsOpen, gameMenuOpen, pointerPosition, rootRef, setAttachingUid, setCombatSelection, setDeckMenu, setDeckSearchQuery, setInspectedCard, setMenu, setOpenSlot, setOpenZone, setPeekedUids, setTargetingUid]);
}
