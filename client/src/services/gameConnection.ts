import { io, type Socket } from "socket.io-client";

export interface GameCounter {
  kind: "emoji" | "name" | "customEmoji" | "status";
  label: string;
  emoji?: string;
  value: number;
}

export interface GameCard {
  uid: string;
  id: string;
  frazzle: number;
  flipped?: boolean;
  faceDown?: boolean;
  targetUid?: string;
  targetExpiresAt?: number;
  targetKind?: "target" | "attack" | "block";
  atk?: number;
  hp?: number;
  counters?: GameCounter[];
  revealed?: boolean;
  isProtagonist?: boolean;
  ownerRole?: "host" | "guest";
}

export type GameZone = "hand" | "deck" | "persona" | "graveyard" | "oblivion" | "action" | "battle" | "protagonist";
export type DeckAction = "shuffle" | "draw" | "discard" | "oblivion";
export type RequestedDeckAction = DeckAction | "look" | "search";
export interface DeckRequest {
  id: string;
  fromRole: "host" | "guest";
  fromName: string;
  action: RequestedDeckAction;
  count: number | null;
}
export type DeckRequestResult = DeckRequest & { accepted: boolean };

export interface GameTable {
  hand: GameCard[];
  deck: GameCard[];
  persona: GameCard[];
  graveyard: GameCard[];
  oblivion: GameCard[];
  action: GameCard[];
  battle: GameCard[][];
  protagonist: GameCard[];
  fragments: boolean[];
}

export interface LobbyPlayerState {
  socketId: string | null;
  name: string;
  role: "host" | "guest";
  connected?: boolean;
  deckId: string | null;
  faction: string | null;
  protagonistId?: string | null;
  deckName?: string | null;
  personaCards?: string[] | null;
  graveyardCards?: string[];
  oblivionCards?: string[];
  mainDeckCards?: Array<{ id: string; qty: number }> | null;
  handCards?: string[];
  deckCards?: string[];
  handCount?: number;
  deckCount?: number;
  table?: GameTable;
}
export interface LobbyState {
  host: LobbyPlayerState | null;
  guest: LobbyPlayerState | null;
  started: boolean;
  code?: string;
  viewerRole?: "host" | "guest" | "spectator" | null;
  spectatorCount?: number;
  deckRequest?: DeckRequest | null;
  deckRequestResult?: DeckRequestResult | null;
}
type StateListener = (state: LobbyState) => void;
type ErrorListener = (message: string) => void;
type SessionListener = (code: string) => void;

interface StoredSession {
  code: string;
  role: "host" | "guest";
  token: string;
}

const SESSION_PREFIX = "astralia.gameSession.";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function loadSession(code: string): StoredSession | null {
  try {
    const saved = localStorage.getItem(`${SESSION_PREFIX}${normalizeCode(code)}`);
    if (!saved) return null;
    const session = JSON.parse(saved) as Partial<StoredSession>;
    if (!session.token || !session.code || (session.role !== "host" && session.role !== "guest")) return null;
    return { code: normalizeCode(session.code), role: session.role, token: session.token };
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession) {
  try { localStorage.setItem(`${SESSION_PREFIX}${session.code}`, JSON.stringify(session)); } catch { /* storage is optional */ }
}

function removeSession(code: string) {
  try { localStorage.removeItem(`${SESSION_PREFIX}${normalizeCode(code)}`); } catch { /* storage is optional */ }
}

class GameConnection {
  private socket: Socket | null = null;
  private state: LobbyState = { host: null, guest: null, started: false };
  private listeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private connectionListeners = new Set<() => void>();
  private sessionListeners = new Set<SessionListener>();
  private resumeCode: string | null = null;
  private watchCode: string | null = null;

  connect(code?: string) {
    if (code) { this.resumeCode = normalizeCode(code); this.watchCode = null; }
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      else if (code) this.emitResume();
      return;
    }
    const url = import.meta.env.VITE_SERVER_URL || undefined;
    this.socket = io(url, { autoConnect: false, transports: ["websocket", "polling"] });
    this.socket.on("connect", () => {
      if (this.watchCode) this.emitWatch();
      else this.emitResume();
      this.connectionListeners.forEach((listener) => listener());
    });
    this.socket.on("lobby:joined", (payload: StoredSession | { code: string; role: "spectator" }) => {
      if (payload.role === "spectator") {
        this.watchCode = normalizeCode(payload.code);
        this.resumeCode = null;
        this.sessionListeners.forEach((listener) => listener(this.watchCode!));
        return;
      }
      const session = { code: normalizeCode(payload.code), role: payload.role, token: payload.token };
      this.watchCode = null;
      this.resumeCode = session.code;
      saveSession(session);
      this.sessionListeners.forEach((listener) => listener(session.code));
    });
    this.socket.on("lobby:state", (state: LobbyState) => {
      this.state = state;
      this.listeners.forEach((listener) => listener(state));
    });
    this.socket.on("lobby:error", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    this.socket.on("lobby:joinError", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    this.socket.on("lobby:resumeError", (message: string) => {
      if (this.resumeCode) removeSession(this.resumeCode);
      this.resumeCode = null;
      this.errorListeners.forEach((listener) => listener(message));
    });
    this.socket.on("lobby:closed", (message: string) => {
      this.resumeCode = null;
      this.watchCode = null;
      this.state = { host: null, guest: null, started: false };
      this.listeners.forEach((listener) => listener(this.state));
      this.errorListeners.forEach((listener) => listener(message));
    });
    this.socket.connect();
  }
  private emitResume() {
    if (!this.resumeCode) return;
    const session = loadSession(this.resumeCode);
    if (session) this.socket?.emit("lobby:resume", { code: session.code, token: session.token });
  }
  private emitWatch() {
    if (this.watchCode) this.socket?.emit("lobby:watch", { code: this.watchCode });
  }
  onState(listener: StateListener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  onError(listener: ErrorListener) { this.errorListeners.add(listener); return () => { this.errorListeners.delete(listener); }; }
  onConnect(listener: () => void) { this.connectionListeners.add(listener); return () => { this.connectionListeners.delete(listener); }; }
  onSession(listener: SessionListener) { this.sessionListeners.add(listener); return () => { this.sessionListeners.delete(listener); }; }
  getCurrentState() { return this.state; }
  getSession(code: string) { return loadSession(code); }
  getSocketId() { return this.socket?.id ?? null; }
  isConnected() { return Boolean(this.socket?.connected); }
  runWhenConnected(callback: () => void) {
    if (this.isConnected()) { callback(); return () => undefined; }
    const unsubscribe = this.onConnect(() => { unsubscribe(); callback(); });
    return unsubscribe;
  }
  host(name: string) { this.resumeCode = null; this.watchCode = null; this.socket?.emit("lobby:host", name); }
  join(name: string, code: string) {
    this.watchCode = null;
    const normalizedCode = normalizeCode(code);
    const session = loadSession(normalizedCode);
    if (session) {
      this.resumeCode = normalizedCode;
      this.emitResume();
    } else this.socket?.emit("lobby:join", { name, code: normalizedCode });
  }
  resume(code: string) { this.connect(code); }
  watch(code: string) {
    this.watchCode = normalizeCode(code);
    this.resumeCode = null;
    this.connect();
    if (this.socket?.connected) this.emitWatch();
  }
  setName(name: string) { this.socket?.emit("lobby:setName", name); }
  setFaction(faction: string | null) { this.socket?.emit("lobby:setFaction", faction); }
  setDeck(deckId: string, deckName: string, faction: string, protagonistId: string | null, personaCards: string[], mainDeckCards: Array<{ id: string; qty: number }>) {
    this.socket?.emit("lobby:setDeck", { deckId, deckName, faction, protagonistId, personaCards, mainDeckCards });
  }
  setHand(cards: string[]) { this.socket?.emit("lobby:setHand", cards); }
  setDeckCards(cards: string[]) { this.socket?.emit("lobby:setDeckCards", cards); }
  setPersonaCards(cards: string[]) { this.socket?.emit("lobby:setPersonaCards", cards); }
  setGraveyardCards(cards: string[]) { this.socket?.emit("lobby:setGraveyardCards", cards); }
  setOblivionCards(cards: string[]) { this.socket?.emit("lobby:setOblivionCards", cards); }
  setCardFrazzle(uid: string, value: 1 | 2) { this.socket?.emit("game:setFrazzle", { target: "card", uid, value }); }
  adjustCardFrazzle(uid: string, delta: -1 | 1) { this.socket?.emit("game:setFrazzle", { target: "card", uid, delta }); }
  setCardStat(uid: string, stat: "atk" | "hp", value: number) { this.socket?.emit("game:setStat", { uid, stat, value }); }
  removeCardStat(uid: string, stat: "atk" | "hp") { this.socket?.emit("game:setStat", { uid, stat, remove: true }); }
  adjustCardStat(uid: string, stat: "atk" | "hp", delta: -1 | 1) { this.socket?.emit("game:setStat", { uid, stat, delta }); }
  adjustCardCounter(uid: string, counter: Pick<GameCounter, "kind" | "label" | "emoji">, delta: -1 | 1) {
    this.socket?.emit("game:adjustCounter", { uid, ...counter, delta });
  }
  removeCardCounter(uid: string, counter: Pick<GameCounter, "kind" | "label" | "emoji">) {
    this.socket?.emit("game:adjustCounter", { uid, ...counter, remove: true });
  }
  attackCard(uid: string, targetUid: string) { this.socket?.emit("game:attack", { uid, targetUid }); }
  blockCard(uid: string, targetUid: string) { this.socket?.emit("game:block", { uid, targetUid }); }
  updateFragments(action: "add" | "remove" | "spend" | "recover" | "spendAll" | "recoverAll") {
    this.socket?.emit("game:updateFragments", { action });
  }
  setFragmentSpent(index: number, spent: boolean) {
    this.socket?.emit("game:updateFragments", { action: "set", index, spent });
  }
  playAction(uid: string) { this.socket?.emit("game:playAction", { uid }); }
  moveCard(uid: string, to: GameZone, options?: { position?: "top" | "bottom"; slot?: number }) {
    this.socket?.emit("game:moveCard", { uid, to, ...options });
  }
  giveCardControl(uid: string) { this.socket?.emit("game:giveCardControl", { uid }); }
  attachCard(uid: string, targetUid: string) { this.socket?.emit("game:attachCard", { uid, targetUid }); }
  swapSlotCard(uid: string) { this.socket?.emit("game:swapSlotCard", { uid }); }
  deckAction(action: DeckAction, count?: number) { this.socket?.emit("game:deckAction", { action, count }); }
  requestDeckAction(action: RequestedDeckAction, count?: number) { this.socket?.emit("game:requestDeckAction", { action, count }); }
  respondDeckAction(id: string, accepted: boolean) { this.socket?.emit("game:respondDeckAction", { id, accepted }); }
  cancelDeckAction(id: string) { this.socket?.emit("game:cancelDeckAction", { id }); }
  setCardRevealed(uid: string, revealed: boolean) { this.socket?.emit("game:revealCard", { uid, revealed }); }
  flipCard(uid: string) { this.socket?.emit("game:flipCard", { uid }); }
  setCardFaceDown(uid: string, faceDown: boolean) { this.socket?.emit("game:setFaceDown", { uid, faceDown }); }
  setCardTarget(uid: string, targetUid: string | null) { this.socket?.emit("game:setTarget", { uid, targetUid }); }
  triggerShuffle() { this.socket?.emit("lobby:shuffle"); }
  startRequest() { this.socket?.emit("lobby:startRequest"); }
  leave() {
    const code = this.state.code || this.resumeCode;
    const wasSpectator = this.state.viewerRole === "spectator" || Boolean(this.watchCode);
    this.socket?.emit("lobby:leave");
    this.socket?.disconnect();
    this.socket = null;
    if (code && !wasSpectator) removeSession(code);
    this.resumeCode = null;
    this.watchCode = null;
    this.state = { host: null, guest: null, started: false };
  }
}

export const gameConnection = new GameConnection();
