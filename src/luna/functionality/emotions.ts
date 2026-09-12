import { KVStorage } from '../../database/kv';
import { LunaEmotion } from '../../media/types';
import { EmotionalState } from './types';

export class EmotionEngine {
  constructor(private readonly kv?: KVStorage) {}

  async getUserLunaEmotion(userId: number): Promise<LunaEmotion> {
    if (!this.kv) return 'idle';
    const state = await this.kv.get<EmotionalState>(`luna_emotion:${userId}`);
    return state?.currentEmotion || 'idle';
  }

  async setEmotion(userId: number, emotion: LunaEmotion, intensity: number = 3): Promise<void> {
    if (!this.kv) return;
    const state: EmotionalState = {
      currentEmotion: emotion,
      intensity,
      lastUpdated: Date.now(),
    };
    await this.kv.set(`luna_emotion:${userId}`, state, 3600 * 24); // 24h
  }
}
