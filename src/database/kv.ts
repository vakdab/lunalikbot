import { Logger } from '../utils/logger';

export class KVStorage {
  constructor(private readonly kv?: KVNamespace) {}

  get isAvailable(): boolean {
    return !!this.kv;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.kv) return null;
    try {
      const data = await this.kv.get(key, 'json');
      return data as T;
    } catch (err) {
      Logger.error(`KV get error for key ${key}`, err);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.kv) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.kv.put(key, serialized, { expirationTtl: ttlSeconds });
      } else {
        await this.kv.put(key, serialized);
      }
    } catch (err) {
      Logger.error(`KV set error for key ${key}`, err);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.kv) return;
    try {
      await this.kv.delete(key);
    } catch (err) {
      Logger.error(`KV delete error for key ${key}`, err);
    }
  }

  async listKeys(prefix: string): Promise<string[]> {
    if (!this.kv) return [];
    try {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.kv.list({ prefix, cursor, limit: 1000 });
        keys.push(...page.keys.map((key) => key.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return keys;
    } catch (err) {
      Logger.error(`KV list error for prefix ${prefix}`, err);
      return [];
    }
  }

  async checkRateLimit(userId: number, limit: number = 30): Promise<boolean> {
    if (!this.kv) return true; // Fail open if KV not bound
    const minuteBucket = Math.floor(Date.now() / 60000);
    const key = `ratelimit:${userId}:${minuteBucket}`;

    try {
      const current = await this.kv.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= limit) return false;

      await this.kv.put(key, String(count + 1), { expirationTtl: 65 });
      return true;
    } catch (err) {
      Logger.warn(`KV rate limit check failed for user ${userId}`, { err });
      return true;
    }
  }
}
