export const D1_SCHEMA_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  language_code TEXT DEFAULT 'uk',
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0,
  relationship_points INTEGER DEFAULT 0,
  relationship_tier TEXT DEFAULT 'stranger',
  is_banned INTEGER DEFAULT 0,
  roulette_chats INTEGER DEFAULT 0,
  roulette_reports INTEGER DEFAULT 0
);

-- Sessions table
CREATE TABLE IF NOT EXISTS roulette_sessions (
  id TEXT PRIMARY KEY,
  user_a INTEGER NOT NULL,
  user_b INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0,
  status TEXT NOT NULL
);

-- Telegram File IDs Cache table
CREATE TABLE IF NOT EXISTS media_cache (
  emotion TEXT PRIMARY KEY,
  telegram_file_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export class D1Client {
  constructor(private readonly db?: D1Database) {}

  get isAvailable(): boolean {
    return !!this.db;
  }

  async run(query: string, ...params: any[]): Promise<D1Result> {
    if (!this.db) {
      throw new Error('D1 database binding "DB" is not configured.');
    }
    return this.db.prepare(query).bind(...params).run();
  }

  async first<T>(query: string, ...params: any[]): Promise<T | null> {
    if (!this.db) {
      throw new Error('D1 database binding "DB" is not configured.');
    }
    return this.db.prepare(query).bind(...params).first<T>();
  }

  async all<T>(query: string, ...params: any[]): Promise<T[]> {
    if (!this.db) {
      throw new Error('D1 database binding "DB" is not configured.');
    }
    const result = await this.db.prepare(query).bind(...params).all<T>();
    return result.results || [];
  }
}
