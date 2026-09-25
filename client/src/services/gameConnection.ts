import { io, type Socket } from "socket.io-client";

export interface GameCard {
  uid: string;
  id: string;
  frazzle: number;
  revealed?: boolean;
}

export type GameZone = "hand" | "deck" | "persona" | "graveyard" | "oblivion" | "battle";
export type DeckAction = "shuffle" | "draw" | "discard" | "oblivion";

export interface GameTable {
  hand: GameCard[];
  deck: GameCard[];
  persona: GameCard[];
  graveyard: GameCard[];
  oblivion: GameCard[];
  battle: Array<GameCard | null>;
  protagonistFrazzle: number;
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

  connect(code?: string) {
    if (code) this.resumeCode = normalizeCode(code);
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      else if (code) this.emitResume();
      return;
    }
    const url = import.meta.env.VITE_SERVER_URL || undefined;
    this.socket = io(url, { autoConnect: false, transports: ["websocket", "polling"] });
    this.socket.on("connect", () => {
      this.emitResume();
      this.connectionListeners.forEach((listener) => listener());
    });
    this.socket.on("lobby:joined", (payload: StoredSession) => {
      const session = { code: normalizeCode(payload.code), role: payload.role, token: payload.token };
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
    this.socket.connect();
  }
  private emitResume() {
    if (!this.resumeCode) return;
    const session = loadSession(this.resumeCode);
    if (session) this.socket?.emit("lobby:resume", { code: session.code, token: session.token });
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
  host(name: string) { this.resumeCode = null; this.socket?.emit("lobby:host", name); }
  join(name: string, code: string) {
    const normalizedCode = normalizeCode(code);
    const session = loadSession(normalizedCode);
    if (session) {
      this.resumeCode = normalizedCode;
      this.emitResume();
    } else this.socket?.emit("lobby:join", { name, code: normalizedCode });
  }
  resume(code: string) { this.connect(code); }
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
  setProtagonistFrazzle(value: 1 | 2) { this.socket?.emit("game:setFrazzle", { target: "protagonist", value }); }
  adjustProtagonistFrazzle(delta: -1 | 1) { this.socket?.emit("game:setFrazzle", { target: "protagonist", delta }); }
  moveCard(uid: string, to: GameZone, options?: { position?: "top" | "bottom"; slot?: number }) {
    this.socket?.emit("game:moveCard", { uid, to, ...options });
  }
  deckAction(action: DeckAction, count?: number) { this.socket?.emit("game:deckAction", { action, count }); }
  setCardRevealed(uid: string, revealed: boolean) { this.socket?.emit("game:revealCard", { uid, revealed }); }
  triggerShuffle() { this.socket?.emit("lobby:shuffle"); }
  startRequest() { this.socket?.emit("lobby:startRequest"); }
  leave() {
    const code = this.state.code || this.resumeCode;
    this.socket?.emit("lobby:leave");
    this.socket?.disconnect();
    this.socket = null;
    if (code) removeSession(code);
    this.resumeCode = null;
    this.state = { host: null, guest: null, started: false };
  }
}

export const gameConnection = new GameConnection();
