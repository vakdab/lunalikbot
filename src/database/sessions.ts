import { KVStorage } from './kv';
import { RouletteSessionRecord } from './types';

export class SessionRepository {
  constructor(private readonly kv: KVStorage) {}

  async getUserSession(userId: number): Promise<RouletteSessionRecord | null> {
    const activeSessionId = await this.kv.get<string>(`user_active_session:${userId}`);
    if (!activeSessionId) return null;

    return this.kv.get<RouletteSessionRecord>(`session:${activeSessionId}`);
  }

  async setUserSession(userId: number, session: RouletteSessionRecord): Promise<void> {
    await this.kv.set(`session:${session.id}`, session, 3600 * 2); // 2 hours
    await this.kv.set(`user_active_session:${userId}`, session.id, 3600 * 2);
  }

  async clearUserSession(userId: number): Promise<void> {
    const activeSessionId = await this.kv.get<string>(`user_active_session:${userId}`);
    if (activeSessionId) {
      await this.kv.delete(`session:${activeSessionId}`);
      await this.kv.delete(`user_active_session:${userId}`);
    }
  }
}
