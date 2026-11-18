import Redis from "ioredis";

// Compare the complete previous snapshot, save, and publish in one Redis operation.
// No distributed lock can expire midway through an action, and a Function dying
// after commit cannot leave its saved action unpublished.
const COMMIT = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
if ARGV[2] == '' then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
end
if ARGV[4] ~= '[]' then redis.call('PUBLISH', ARGV[5], ARGV[4]) end
return 1
`;

export class RedisBackend {
  constructor(url, prefix) {
    if (!url || !/^rediss?:\/\//.test(url)) throw new Error("REDIS_URL must be a Redis TCP/TLS URL.");
    if (!prefix || !/^[a-zA-Z0-9:_-]+$/.test(prefix)) throw new Error("Set a distinct REDIS_KEY_PREFIX for this environment.");
    this.prefix = prefix;
    this.channel = `${prefix}:events`;
    const options = { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000, commandTimeout: 5000 };
    this.client = new Redis(url, options);
    this.subscriber = new Redis(url, { ...options, commandTimeout: undefined });
    // Never log connection URLs, which contain credentials.
    this.client.on("error", () => {});
    this.subscriber.on("error", () => {});
    this.listeners = new Set();
    this.subscriber.on("message", (channel, message) => {
      if (channel !== this.channel) return;
      const effects = JSON.parse(message);
      for (const listener of this.listeners) listener(effects);
    });
    this.ready = this.connect();
  }
  async connect() {
    await Promise.all([this.client.connect(), this.subscriber.connect()]);
    await this.subscriber.subscribe(this.channel);
  }
  async get(code) { await this.ready; return this.client.get(`${this.prefix}:room:${code}`); }
  async commit(code, expected, raw, ttl, effects) {
    await this.ready;
    return (await this.client.eval(COMMIT, 1, `${this.prefix}:room:${code}`,
      expected ?? "", raw ?? "", Math.ceil(ttl), JSON.stringify(effects), this.channel)) === 1;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async ping() { await this.ready; return this.client.ping(); }
  async list() {
    await this.ready;
    let cursor = "0";
    const rooms = new Map();
    do {
      const [next, keys] = await this.client.scan(cursor, "MATCH", `${this.prefix}:room:*`, "COUNT", 100);
      cursor = next;
      if (keys.length) {
        const values = await this.client.mget(...keys);
        keys.forEach((key, index) => { if (values[index]) rooms.set(key, values[index]); });
      }
    } while (cursor !== "0");
    return [...rooms.values()];
  }
  async count() {
    await this.ready;
    let cursor = "0";
    const keys = new Set();
    do {
      const [next, batch] = await this.client.scan(cursor, "MATCH", `${this.prefix}:room:*`, "COUNT", 100);
      cursor = next;
      for (const key of batch) keys.add(key);
    } while (cursor !== "0");
    return keys.size;
  }
  async close() { this.client.disconnect(); this.subscriber.disconnect(); }
}
