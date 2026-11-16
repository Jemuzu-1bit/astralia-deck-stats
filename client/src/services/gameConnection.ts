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
  instanceId?: string;
  revision?: number;
  host: LobbyPlayerState | null;
  guest: LobbyPlayerState | null;
  started: boolean;
  turnRole?: "host" | "guest" | null;
  turnNumber?: number;
  startVotes?: { host: "host" | "guest" | null; guest: "host" | "guest" | null };
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

export class GameConnection {
  private readonly endpoint: { url?: string; path?: string };
  constructor(endpoint: { url?: string; path?: string } = {}) { this.endpoint = endpoint; }
  private socket: Socket | null = null;
  private state: LobbyState = { host: null, guest: null, started: false };
  private listeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private connectionListeners = new Set<() => void>();
  private sessionListeners = new Set<SessionListener>();
  private resumeCode: string | null = null;
  private watchCode: string | null = null;
  private sessionReady = false;
  private pendingActions: Array<{ id: string; event: string; data: unknown; code: string }> = [];
  private flushing = false;

  connect(code?: string) {
    if (code) { this.resumeCode = normalizeCode(code); this.watchCode = null; }
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      else if (code) this.emitResume();
      return;
    }
    const url = this.endpoint.url || import.meta.env?.VITE_SERVER_URL || undefined;
    const path = this.endpoint.path || import.meta.env?.VITE_SOCKET_PATH || "/socket.io";
    this.socket = io(url, { path, autoConnect: false, transports: ["websocket"] });
    this.socket.on("connect", () => {
      this.sessionReady = false;
      if (this.watchCode) this.emitWatch();
      else if (this.resumeCode) this.emitResume();
      else this.sessionReady = true;
      this.connectionListeners.forEach((listener) => listener());
    });
    this.socket.on("disconnect", () => { this.sessionReady = false; });
    this.socket.on("lobby:joined", (payload: StoredSession | { code: string; role: "spectator" }) => {
      if (payload.role === "spectator") {
        this.watchCode = normalizeCode(payload.code);
        this.resumeCode = null;
        this.sessionReady = true;
        this.sessionListeners.forEach((listener) => listener(this.watchCode!));
        return;
      }
      const session = { code: normalizeCode(payload.code), role: payload.role, token: payload.token };
      this.watchCode = null;
      this.resumeCode = session.code;
      saveSession(session);
      this.sessionReady = true;
      this.flushActions();
      this.sessionListeners.forEach((listener) => listener(session.code));
    });
    this.socket.on("lobby:state", (state: LobbyState) => {
      if (state.instanceId && state.instanceId === this.state.instanceId
        && state.revision !== undefined && this.state.revision !== undefined
        && state.revision <= this.state.revision) return;
      this.state = state;
      this.listeners.forEach((listener) => listener(state));
    });
    this.socket.on("lobby:error", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    this.socket.on("lobby:joinError", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    this.socket.on("lobby:resumeError", (message: string) => {
      if (this.resumeCode) removeSession(this.resumeCode);
      this.resumeCode = null;
      this.pendingActions = [];
      this.sessionReady = false;
      this.errorListeners.forEach((listener) => listener(message));
    });
    this.socket.on("lobby:closed", (message: string) => {
      this.resumeCode = null;
      this.watchCode = null;
      this.pendingActions = [];
      this.sessionReady = false;
      this.state = { host: null, guest: null, started: false };
      this.listeners.forEach((listener) => listener(this.state));
      this.errorListeners.forEach((listener) => listener(message));
    });
    this.socket.on("lobby:replaced", () => {
      // Keep localStorage: the replacement tab uses the same valid session token.
      this.resumeCode = null;
      this.watchCode = null;
      this.sessionReady = false;
      this.pendingActions = [];
    });
    this.socket.connect();
  }
  private sendAction(event: string, data?: unknown) {
    if (!this.resumeCode) return;
    this.pendingActions.push({ id: crypto.randomUUID(), event, data, code: this.resumeCode });
    this.flushActions();
  }
  private flushActions() {
    if (this.flushing || !this.sessionReady || !this.socket?.connected) return;
    const action = this.pendingActions[0];
    if (!action) return;
    if (action.code !== this.resumeCode) {
      this.pendingActions.shift();
      this.flushActions();
      return;
    }
    const socket = this.socket;
    this.flushing = true;
    socket.timeout(10000).emit(action.event, { __commandId: action.id, data: action.data },
      (error: Error | null, response?: { ok: boolean }) => {
        if (this.socket !== socket) return;
        this.flushing = false;
        if (!error && response?.ok) {
          if (this.pendingActions[0]?.id === action.id) this.pendingActions.shift();
          this.flushActions();
        } else if (socket.connected && this.sessionReady) {
          window.setTimeout(() => this.flushActions(), 2000);
        }
      });
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
  setName(name: string) { this.sendAction("lobby:setName", name); }
  setFaction(faction: string | null) { this.sendAction("lobby:setFaction", faction); }
  setDeck(deckId: string, deckName: string, faction: string, protagonistId: string | null, personaCards: string[], mainDeckCards: Array<{ id: string; qty: number }>) {
    this.sendAction("lobby:setDeck", { deckId, deckName, faction, protagonistId, personaCards, mainDeckCards });
  }
  setHand(cards: string[]) { this.sendAction("lobby:setHand", cards); }
  setDeckCards(cards: string[]) { this.sendAction("lobby:setDeckCards", cards); }
  setPersonaCards(cards: string[]) { this.sendAction("lobby:setPersonaCards", cards); }
  setGraveyardCards(cards: string[]) { this.sendAction("lobby:setGraveyardCards", cards); }
  setOblivionCards(cards: string[]) { this.sendAction("lobby:setOblivionCards", cards); }
  setCardFrazzle(uid: string, value: 1 | 2) { this.sendAction("game:setFrazzle", { target: "card", uid, value }); }
  adjustCardFrazzle(uid: string, delta: -1 | 1) { this.sendAction("game:setFrazzle", { target: "card", uid, delta }); }
  setCardStat(uid: string, stat: "atk" | "hp", value: number) { this.sendAction("game:setStat", { uid, stat, value }); }
  removeCardStat(uid: string, stat: "atk" | "hp") { this.sendAction("game:setStat", { uid, stat, remove: true }); }
  adjustCardStat(uid: string, stat: "atk" | "hp", delta: -1 | 1) { this.sendAction("game:setStat", { uid, stat, delta }); }
  adjustCardCounter(uid: string, counter: Pick<GameCounter, "kind" | "label" | "emoji">, delta: -1 | 1) {
    this.sendAction("game:adjustCounter", { uid, ...counter, delta });
  }
  removeCardCounter(uid: string, counter: Pick<GameCounter, "kind" | "label" | "emoji">) {
    this.sendAction("game:adjustCounter", { uid, ...counter, remove: true });
  }
  attackCard(uid: string, targetUid: string) { this.sendAction("game:attack", { uid, targetUid }); }
  blockCard(uid: string, targetUid: string) { this.sendAction("game:block", { uid, targetUid }); }
  updateFragments(action: "add" | "remove" | "spend" | "recover" | "spendAll" | "recoverAll") {
    this.sendAction("game:updateFragments", { action });
  }
  setFragmentSpent(index: number, spent: boolean) {
    this.sendAction("game:updateFragments", { action: "set", index, spent });
  }
  playAction(uid: string) { this.sendAction("game:playAction", { uid }); }
  moveCard(uid: string, to: GameZone, options?: { position?: "top" | "bottom"; slot?: number }) {
    this.sendAction("game:moveCard", { uid, to, ...options });
  }
  giveCardControl(uid: string) { this.sendAction("game:giveCardControl", { uid }); }
  attachCard(uid: string, targetUid: string) { this.sendAction("game:attachCard", { uid, targetUid }); }
  swapSlotCard(uid: string) { this.sendAction("game:swapSlotCard", { uid }); }
  deckAction(action: DeckAction, count?: number) { this.sendAction("game:deckAction", { action, count }); }
  requestDeckAction(action: RequestedDeckAction, count?: number) { this.sendAction("game:requestDeckAction", { action, count }); }
  respondDeckAction(id: string, accepted: boolean) { this.sendAction("game:respondDeckAction", { id, accepted }); }
  cancelDeckAction(id: string) { this.sendAction("game:cancelDeckAction", { id }); }
  setCardRevealed(uid: string, revealed: boolean) { this.sendAction("game:revealCard", { uid, revealed }); }
  flipCard(uid: string) { this.sendAction("game:flipCard", { uid }); }
  setCardFaceDown(uid: string, faceDown: boolean) { this.sendAction("game:setFaceDown", { uid, faceDown }); }
  setCardTarget(uid: string, targetUid: string | null) { this.sendAction("game:setTarget", { uid, targetUid }); }
  triggerShuffle() { this.sendAction("lobby:shuffle"); }
  startRequest() { this.sendAction("lobby:startRequest"); }
  chooseStarter(role: "host" | "guest") { this.sendAction("game:chooseStarter", role); }
  endTurn() { this.sendAction("game:endTurn"); }
  leave() {
    const code = this.state.code || this.resumeCode;
    const wasSpectator = this.state.viewerRole === "spectator" || Boolean(this.watchCode);
    const socket = this.socket;
    if (socket) {
      socket.removeAllListeners();
      if (socket.connected) socket.timeout(3000).emit("lobby:leave", undefined, () => socket.disconnect());
      else socket.disconnect();
    }
    this.socket = null;
    if (code && !wasSpectator) removeSession(code);
    this.resumeCode = null;
    this.watchCode = null;
    this.sessionReady = false;
    this.pendingActions = [];
    this.flushing = false;
    this.state = { host: null, guest: null, started: false };
  }
}

export const gameConnection = new GameConnection();
