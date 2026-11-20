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
export interface GameActivity {
  id: number;
  timestamp: number;
  turn: number;
  actorRole: "host" | "guest";
  actorName: string;
  text: string;
}

export interface LobbyState {
  visibility?: "public" | "private";
  roomName?: string;
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
  activityLog?: GameActivity[];
  deckRequest?: DeckRequest | null;
  deckRequestResult?: DeckRequestResult | null;
}
export interface PublicRoom {
  code: string;
  roomName: string;
  hostName: string;
  playerCount: number;
  spectatorCount: number;
  started: boolean;
  createdAt: number;
}
type StateListener = (state: LobbyState) => void;
type ErrorListener = (message: string) => void;
type SessionListener = (code: string) => void;
export type GameConnectionStatus = "idle" | "recovering" | "ready";

interface StoredSession {
  code: string;
  role: "host" | "guest";
  token: string;
}

const SESSION_PREFIX = "astralia.gameSession.";
const VERCEL_SOCKET_PATH = "/api/game/socket.io";
const ROTATE_AFTER_MS = 255000;
const ROTATION_RETRY_MS = 3000;

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
  private readonly url: string | undefined;
  private readonly path: string;
  private readonly rotateAfterMs: number | undefined;
  constructor(endpoint: { url?: string; path?: string; rotateAfterMs?: number } = {}) {
    this.url = endpoint.url || import.meta.env?.VITE_SERVER_URL || undefined;
    this.path = endpoint.path || import.meta.env?.VITE_SOCKET_PATH || "/socket.io";
    this.rotateAfterMs = endpoint.rotateAfterMs ?? (this.path === VERCEL_SOCKET_PATH ? ROTATE_AFTER_MS : undefined);
  }
  private socket: Socket | null = null;
  private connectedAt = 0;
  private rotationTimer: ReturnType<typeof setTimeout> | null = null;
  private rotation: { next: Socket; transferring: boolean } | null = null;
  private state: LobbyState = { host: null, guest: null, started: false };
  private listeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private connectionListeners = new Set<() => void>();
  private sessionListeners = new Set<SessionListener>();
  private statusListeners = new Set<(status: GameConnectionStatus) => void>();
  private status: GameConnectionStatus = "idle";
  private resumeCode: string | null = null;
  private watchCode: string | null = null;
  private sessionReady = false;
  private pendingActions: Array<{ id: string; event: string; data: unknown; code: string }> = [];
  private inFlight: { id: string } | null = null;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;
  private activeSession: StoredSession | null = null;

  private setStatus(status: GameConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
  private stopRecovery() {
    if (this.recoveryTimer !== null) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
  }
  private sessionJoined() {
    this.stopRecovery();
    this.sessionReady = true;
    this.setStatus("ready");
    if (this.syncTimer === null) this.syncTimer = setInterval(() => this.syncSession(), 15000);
    this.scheduleRotation();
  }
  private stopSession() {
    this.stopRecovery();
    this.stopRotation();
    if (this.syncTimer !== null) clearInterval(this.syncTimer);
    this.syncTimer = null;
    this.sessionReady = false;
    this.activeSession = null;
    this.inFlight = null;
    this.setStatus("idle");
  }
  private clearRoom() {
    this.resumeCode = null;
    this.watchCode = null;
    this.pendingActions = [];
    this.stopSession();
    this.publishState({ host: null, guest: null, started: false });
  }
  private syncSession() {
    const socket = this.socket;
    if (!socket?.connected || !this.sessionReady || this.syncing || this.rotation?.transferring
      || (!this.resumeCode && !this.watchCode)) return;
    this.syncing = true;
    socket.timeout(5000).emit("lobby:sync", undefined, (error: Error | null, response?: { ok: boolean }) => {
      if (this.socket !== socket) return;
      this.syncing = false;
      if (this.rotation?.transferring) return;
      if (error && (this.resumeCode || this.watchCode)) {
        // An open WebSocket alone does not prove the game server is responding.
        socket.disconnect();
        socket.connect();
      } else if (!response?.ok) this.setStatus("recovering");
      else if (this.sessionReady) this.setStatus("ready");
    });
  }

  private createSocket(reconnection = true) {
    return io(this.url, {
      path: this.path, addTrailingSlash: !this.path.startsWith("/api/"),
      autoConnect: false, transports: ["websocket"], forceNew: true, reconnection,
    });
  }
  private publishState(state: LobbyState) {
    if (state.instanceId && state.instanceId === this.state.instanceId
      && state.revision !== undefined && this.state.revision !== undefined
      && state.revision <= this.state.revision) return;
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
  private stopRotation() {
    if (this.rotationTimer !== null) clearTimeout(this.rotationTimer);
    this.rotationTimer = null;
    const rotation = this.rotation;
    this.rotation = null;
    rotation?.next.disconnect();
  }
  private scheduleRotation(minimumDelay = 0) {
    if (this.rotationTimer !== null) clearTimeout(this.rotationTimer);
    this.rotationTimer = null;
    if (this.rotateAfterMs === undefined || !this.socket?.connected || !this.sessionReady
      || this.rotation || (!this.resumeCode && !this.watchCode)) return;
    const delay = Math.max(minimumDelay, this.rotateAfterMs - (performance.now() - this.connectedAt));
    this.rotationTimer = setTimeout(() => { this.rotationTimer = null; void this.rotateSocket(); }, delay);
  }
  private async rotateSocket() {
    const socket = this.socket;
    const from = socket?.id;
    const code = this.resumeCode || this.watchCode;
    const role = this.activeSession?.role ?? (this.watchCode ? "spectator" : null);
    if (!socket || !from || !code || !role || !this.sessionReady || this.rotation) return;

    const next = this.createSocket(false);
    const rotation = { next, transferring: false };
    this.rotation = rotation;
    let latest: LobbyState | undefined;
    let invalidation: { message?: string } | undefined;
    let handoffSent = false;
    const bufferState = (state: LobbyState) => {
      if (state.code === code && state.viewerRole === role
        && (!latest || (state.revision ?? 0) > (latest.revision ?? 0))) latest = state;
    };
    const closed = (message: string) => { invalidation = { message }; };
    const replaced = () => { invalidation = {}; };
    next.on("lobby:state", bufferState);
    next.on("lobby:closed", closed);
    next.on("lobby:replaced", replaced);

    try {
      const opened = await new Promise<boolean>((resolve) => {
        const finish = (connected: boolean) => {
          clearTimeout(timer);
          next.off("connect", connectedListener);
          next.off("connect_error", errorListener);
          resolve(connected);
        };
        const connectedListener = () => finish(true);
        const errorListener = () => finish(false);
        const timer = setTimeout(errorListener, 6000);
        next.once("connect", connectedListener).once("connect_error", errorListener).connect();
      });
      if (!opened || !next.id || this.rotation !== rotation || socket.id !== from || !this.sessionReady) return;
      const connectedAt = performance.now();
      const token = crypto.randomUUID();
      rotation.transferring = true;
      // Socket.IO preserves packet order. The old server queues preparation after any in-flight move.
      const prepared = await socket.timeout(4000).emitWithAck("lobby:prepareHandoff", { to: next.id, token }).catch(() => null);
      if (!prepared?.handoff || !next.connected || this.rotation !== rotation) return;

      handoffSent = true;
      const payload = { code, from, token };
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!next.connected || invalidation || this.rotation !== rotation) return;
        const result = await next.timeout(3000).emitWithAck("lobby:handoff", payload).catch(() => null);
        if (!result?.ok || !result.state) continue;
        bufferState(result.state);
        if (!latest || invalidation || !next.connected || this.rotation !== rotation) return;

        this.rotation = null;
        this.socket = next;
        this.connectedAt = connectedAt;
        this.inFlight = null;
        this.syncing = false;
        next.off("lobby:state", bufferState).off("lobby:closed", closed).off("lobby:replaced", replaced);
        next.io.reconnection(true);
        this.listenToSocket(next);
        socket.removeAllListeners().disconnect();
        this.publishState(latest);
        this.sessionJoined();
        this.flushActions();
        return;
      }
    } finally {
      if (this.rotation === rotation) {
        // If a confirmation was lost, verify the old socket still owns its place before using it again.
        const original = handoffSent && socket.connected && !invalidation
          ? await socket.timeout(3000).emitWithAck("lobby:sync", undefined).catch(() => null)
          : null;
        if (this.rotation === rotation) {
          this.rotation = null;
          next.removeAllListeners().disconnect();
          if (invalidation) {
            const message = invalidation.message;
            this.clearRoom();
            if (message) this.errorListeners.forEach((listener) => listener(message));
          } else if (!socket.connected || (handoffSent && !original?.ok)) {
            this.sessionReady = false;
            this.setStatus("recovering");
            if (!socket.connected) socket.connect();
            else if (this.watchCode) this.emitWatch();
            else this.emitResume();
          } else {
            this.flushActions();
            this.scheduleRotation(ROTATION_RETRY_MS);
          }
        }
      }
    }
  }
  connect(code?: string) {
    if (code) { this.resumeCode = normalizeCode(code); this.watchCode = null; }
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      else if (code && !this.rotation?.transferring) this.emitResume();
      return;
    }
    const socket = this.createSocket();
    this.socket = socket;
    this.listenToSocket(socket);
    socket.connect();
  }
  private listenToSocket(socket: Socket) {
    socket.on("connect", () => {
      this.connectedAt = performance.now();
      this.sessionReady = false;
      if (this.watchCode) this.emitWatch();
      else if (this.resumeCode) this.emitResume();
      else this.sessionReady = true;
      this.connectionListeners.forEach((listener) => listener());
    });
    socket.on("disconnect", () => {
      if (this.rotation?.transferring) {
        // Give the replacement the remaining time to finish without racing an automatic resume.
        socket.disconnect();
        return;
      }
      this.stopRotation();
      this.stopRecovery();
      this.sessionReady = false;
      if (this.resumeCode || this.watchCode) this.setStatus("recovering");
    });
    socket.on("lobby:joined", (payload: StoredSession | { code: string; role: "spectator" }) => {
      if (payload.role === "spectator") {
        this.watchCode = normalizeCode(payload.code);
        this.resumeCode = null;
        this.sessionJoined();
        this.sessionListeners.forEach((listener) => listener(this.watchCode!));
        return;
      }
      const session = { code: normalizeCode(payload.code), role: payload.role, token: payload.token };
      this.watchCode = null;
      this.resumeCode = session.code;
      saveSession(session);
      this.activeSession = session;
      this.sessionJoined();
      this.flushActions();
      this.sessionListeners.forEach((listener) => listener(session.code));
    });
    socket.on("lobby:state", (state: LobbyState) => this.publishState(state));
    socket.on("lobby:error", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    socket.on("lobby:joinError", (message: string) => this.errorListeners.forEach((listener) => listener(message)));
    socket.on("lobby:resumeError", (message: string) => {
      if (this.resumeCode) removeSession(this.resumeCode);
      this.clearRoom();
      this.errorListeners.forEach((listener) => listener(message));
    });
    socket.on("lobby:closed", (message: string) => {
      this.clearRoom();
      this.errorListeners.forEach((listener) => listener(message));
    });
    socket.on("lobby:replaced", () => {
      // Keep localStorage: the replacement tab uses the same valid session token.
      this.clearRoom();
    });
  }
  private sendAction(event: string, data?: unknown) {
    if (!this.resumeCode) return;
    this.pendingActions.push({ id: crypto.randomUUID(), event, data, code: this.resumeCode });
    this.flushActions();
  }
  private flushActions() {
    if (this.inFlight || this.rotation?.transferring || !this.sessionReady || !this.socket?.connected) return;
    const action = this.pendingActions[0];
    if (!action) return;
    if (action.code !== this.resumeCode) {
      this.pendingActions.shift();
      this.flushActions();
      return;
    }
    const socket = this.socket;
    const attempt = { id: action.id };
    this.inFlight = attempt;
    socket.timeout(10000).emit(action.event, { __commandId: action.id, data: action.data },
      (error: Error | null, response?: { ok: boolean }) => {
        if (this.inFlight !== attempt) return;
        this.inFlight = null;
        if (!error && response?.ok) {
          if (this.sessionReady) this.setStatus("ready");
          if (this.pendingActions[0]?.id === attempt.id) this.pendingActions.shift();
          this.flushActions();
        } else if (socket.connected && this.sessionReady && !this.rotation?.transferring) {
          this.setStatus("recovering");
          if (error) this.emitResume();
          else setTimeout(() => this.flushActions(), 2000);
        }
      });
  }
  private emitResume() {
    if (!this.resumeCode || !this.socket?.connected) return;
    const session = this.activeSession?.code === this.resumeCode ? this.activeSession : loadSession(this.resumeCode);
    if (!session) return;
    this.beginRecovery(() => this.emitResume());
    this.socket.emit("lobby:resume", { code: session.code, token: session.token });
  }
  private emitWatch() {
    if (!this.watchCode || !this.socket?.connected) return;
    this.sessionReady = false;
    this.setStatus("recovering");
    this.socket.emit("lobby:watch", { code: this.watchCode });
  }
  private beginRecovery(retry: () => void) {
    this.stopRotation();
    this.stopRecovery();
    this.sessionReady = false;
    this.setStatus("recovering");
    // A failed resume or a lost joined notification must not freeze the queue.
    this.recoveryTimer = setTimeout(retry, 3000);
  }
  onState(listener: StateListener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  onError(listener: ErrorListener) { this.errorListeners.add(listener); return () => { this.errorListeners.delete(listener); }; }
  onConnect(listener: () => void) { this.connectionListeners.add(listener); return () => { this.connectionListeners.delete(listener); }; }
  onSession(listener: SessionListener) { this.sessionListeners.add(listener); return () => { this.sessionListeners.delete(listener); }; }
  onStatus(listener: (status: GameConnectionStatus) => void) { this.statusListeners.add(listener); return () => { this.statusListeners.delete(listener); }; }
  getStatus() { return this.status; }
  getCurrentState() { return this.state; }
  getSession(code: string) { return loadSession(code); }
  getSocketId() { return this.socket?.id ?? null; }
  isConnected() { return Boolean(this.socket?.connected); }
  runWhenConnected(callback: () => void) {
    if (this.isConnected()) { callback(); return () => undefined; }
    const unsubscribe = this.onConnect(() => { unsubscribe(); callback(); });
    return unsubscribe;
  }
  host(name: string, options?: { visibility: "public" | "private"; roomName: string }) {
    this.resumeCode = null; this.watchCode = null;
    this.socket?.emit("lobby:host", options ? { name, ...options } : name);
  }
  listPublicRooms(): Promise<PublicRoom[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) { reject(new Error("Connecting to the game server. Please try again.")); return; }
      this.socket.timeout(8000).emit("lobby:list", undefined, (error: Error | null, response?: { ok: boolean; rooms?: PublicRoom[] }) => {
        if (error || !response?.ok || !response.rooms) reject(new Error("Could not load public rooms. Please try again."));
        else resolve(response.rooms);
      });
    });
  }
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
    if (this.socket?.connected && !this.rotation?.transferring) this.emitWatch();
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
  swapSlotCard(uid: string, targetUid?: string) { this.sendAction("game:swapSlotCard", { uid, targetUid }); }
  deckAction(action: RequestedDeckAction, count?: number) { this.sendAction("game:deckAction", { action, count }); }
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
    const sockets = [this.socket, this.rotation?.next];
    this.rotation = null;
    for (const socket of sockets) {
      if (!socket) continue;
      socket.removeAllListeners();
      if (socket.connected) socket.timeout(3000).emit("lobby:leave", undefined, () => socket.disconnect());
      else socket.disconnect();
    }
    this.socket = null;
    this.stopSession();
    this.syncing = false;
    if (code && !wasSpectator) removeSession(code);
    this.resumeCode = null;
    this.watchCode = null;
    this.sessionReady = false;
    this.pendingActions = [];
    this.state = { host: null, guest: null, started: false };
  }
}

export const gameConnection = new GameConnection();
