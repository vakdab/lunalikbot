import { KVStorage } from '../../database/kv';
import { DiaryEntry } from './types';
import { LunaEmotion } from '../../media/types';

export class LunaSoulDiary {
  constructor(private readonly kv?: KVStorage) {}

  async addEntry(userId: number, thought: string, emotion: LunaEmotion, intimacyLevel: number): Promise<void> {
    if (!this.kv) return;
    const key = `soul_diary:${userId}`;
    const diary = (await this.kv.get<DiaryEntry[]>(key)) || [];

    const now = new Date();
    const newEntry: DiaryEntry = {
      id: `diary_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: now.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
      thought,
      emotion,
      intimacyLevel,
    };

    diary.unshift(newEntry);
    if (diary.length > 15) diary.pop(); // Keep last 15 intimate entries

    await this.kv.set(key, diary, 3600 * 24 * 60);
  }

  async getRecentEntries(userId: number, limit: number = 5): Promise<DiaryEntry[]> {
    if (!this.kv) return [];
    const key = `soul_diary:${userId}`;
    const diary = (await this.kv.get<DiaryEntry[]>(key)) || [];
    return diary.slice(0, limit);
  }
}
