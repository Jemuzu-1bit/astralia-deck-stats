import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { runRoomCommand, stateEffects } from "./roomCommands.js";
import { roomExpiresAt } from "./roomLifecycle.js";

export function encodeRoom(room) {
  return JSON.stringify({ ...room, spectators: [...room.spectators] });
}

export function decodeRoom(raw) {
  if (!raw) return null;
  const room = JSON.parse(raw);
  room.spectators = new Set(room.spectators);
  return room;
}

export class RoomStore {
  constructor(backend, { now = Date.now } = {}) {
    this.backend = backend;
    this.now = now;
  }

  async execute(code, actor, event, payload, commandId) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const raw = await this.backend.get(code);
      const room = decodeRoom(raw);
      const key = commandId && actor.data.sessionToken ? `${actor.data.sessionToken}:${commandId}` : null;
      if (key && room?.commands?.includes(key)) return { data: actor.data, duplicate: true };
      const result = runRoomCommand(room, actor, event, payload, code, this.now());
      let next = result.room;
      const ttl = next ? roomExpiresAt(next) - this.now() : 0;
      if (ttl <= 0) next = null;
      let effects = result.effects;
      if (next) {
        if (key) next.commands = [...(next.commands || []), key].slice(-512);
        // Heartbeats/maintenance that change nothing need neither a write nor a broadcast.
        if (encodeRoom(next) === raw && effects.length === 0) return result;
        next.revision = (room?.revision || 0) + 1;
        if (result.stateChanged) effects = [...effects, ...stateEffects(next)];
      }
      const serialized = next ? encodeRoom(next) : null;
      if (serialized === raw && effects.length === 0) return result;
      if (await this.backend.commit(code, raw, serialized, Math.max(1, ttl), effects)) return result;
      await delay(Math.min(25, attempt + 1) + Math.random() * 5);
    }
    throw new Error("Room is busy. Please try again.");
  }
}

// Development/test storage. Production on Vercel must explicitly use Redis.
export class MemoryBackend {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.rooms = new Map();
    this.events = new EventEmitter();
  }
  async get(code) {
    const entry = this.rooms.get(code);
    if (entry && entry.expiresAt <= this.now()) this.rooms.delete(code);
    return this.rooms.get(code)?.raw ?? null;
  }
  async commit(code, expected, raw, ttl, effects) {
    // No await between the comparison and write: also atomic in the local test backend.
    const entry = this.rooms.get(code);
    const current = entry && entry.expiresAt > this.now() ? entry.raw : null;
    if (current !== expected) return false;
    if (raw === null) this.rooms.delete(code);
    else this.rooms.set(code, { raw, expiresAt: this.now() + ttl });
    if (effects.length) this.events.emit("effects", effects);
    return true;
  }
  subscribe(listener) { this.events.on("effects", listener); return () => this.events.off("effects", listener); }
  async ping() { return "PONG"; }
  async count() {
    for (const [code, entry] of this.rooms) if (entry.expiresAt <= this.now()) this.rooms.delete(code);
    return this.rooms.size;
  }
  async close() {}
}
