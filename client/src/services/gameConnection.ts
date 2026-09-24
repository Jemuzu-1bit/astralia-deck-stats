import { io, type Socket } from "socket.io-client";

export interface GameCard {
  uid: string;
  id: string;
  rotation: number;
}

export type GameZone = "hand" | "deck" | "persona" | "graveyard" | "oblivion" | "battle";

export interface GameTable {
  hand: GameCard[];
  deck: GameCard[];
  persona: GameCard[];
  graveyard: GameCard[];
  oblivion: GameCard[];
  battle: Array<GameCard | null>;
}

export interface LobbyPlayerState {
  socketId: string;
  name: string;
  role: "host" | "guest";
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

class GameConnection {
  private socket: Socket | null = null;
  private state: LobbyState = { host: null, guest: null, started: false };
  private listeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private connectionListeners = new Set<() => void>();

  connect() {
    if (this.socket) return;
    const url = import.meta.env.VITE_SERVER_URL || undefined;
    this.socket = io(url, { autoConnect: true, transports: ["websocket", "polling"] });
    this.socket.on("connect", () => this.connectionListeners.forEach((listener) => listener()));
    this.socket.on("lobby:state", (state: LobbyState) => {
      this.state = state;
      this.listeners.forEach((listener) => listener(state));
    });
    this.socket.on("lobby:error", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    this.socket.on("lobby:joinError", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
  }
  onState(listener: StateListener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  onError(listener: ErrorListener) { this.errorListeners.add(listener); return () => { this.errorListeners.delete(listener); }; }
  onConnect(listener: () => void) { this.connectionListeners.add(listener); return () => { this.connectionListeners.delete(listener); }; }
  getCurrentState() { return this.state; }
  getSocketId() { return this.socket?.id ?? null; }
  isConnected() { return Boolean(this.socket?.connected); }
  runWhenConnected(callback: () => void) { if (this.isConnected()) callback(); else return this.onConnect(callback); return () => undefined; }
  host(name: string) { this.socket?.emit("lobby:host", name); }
  join(name: string, code: string) { this.socket?.emit("lobby:join", { name, code }); }
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
  rotateCard(uid: string, degrees: 90 | 180) { this.socket?.emit("game:rotateCard", { uid, degrees }); }
  moveCard(uid: string, to: GameZone, options?: { position?: "top" | "bottom"; slot?: number }) {
    this.socket?.emit("game:moveCard", { uid, to, ...options });
  }
  triggerShuffle() { this.socket?.emit("lobby:shuffle"); }
  startRequest() { this.socket?.emit("lobby:startRequest"); }
  leave() { this.socket?.emit("lobby:leave"); this.socket?.disconnect(); this.socket = null; this.state = { host: null, guest: null, started: false }; }
}

export const gameConnection = new GameConnection();
