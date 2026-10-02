import { KVStorage } from '../database/kv';
import { LunaEmotion } from '../media/types';
import { Logger } from '../utils/logger';

export type MemoryCategory = 'name' | 'preference' | 'project' | 'habit' | 'goal' | 'event' | 'relationship' | 'interaction';

export interface LunaMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  mentions: number;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
}

export interface LunaReflection {
  id: string;
  createdAt: number;
  summary: string;
  emotion: LunaEmotion;
  memoryIds: string[];
}

export interface EmotionalState {
  mood: number;
  energy: number;
  curiosity: number;
  confidence: number;
  affection: number;
  stress: number;
  updatedAt: number;
}

export interface PersonalityState {
  humor: number;
  warmth: number;
  brevity: number;
  curiosity: number;
  preferredAddress?: string;
  interactionCount: number;
  updatedAt: number;
}

export interface LunaProfileState {
  memories: LunaMemory[];
  reflections: LunaReflection[];
  emotional: EmotionalState;
  personality: PersonalityState;
  proactiveEnabled: boolean;
  lastConsolidatedAt: number;
}

const PROFILE_PREFIX = 'luna:profile:';
const DEFAULT_EMOTIONAL: EmotionalState = {
  mood: 0.62,
  energy: 0.72,
  curiosity: 0.58,
  confidence: 0.72,
  affection: 0.56,
  stress: 0.12,
  updatedAt: 0,
};
const DEFAULT_PERSONALITY: PersonalityState = {
  humor: 0.42,
  warmth: 0.72,
  brevity: 0.48,
  curiosity: 0.55,
  interactionCount: 0,
  updatedAt: 0,
};
const DAY = 24 * 60 * 60 * 1000;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tokens(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((token) => token.length > 2));
}

function overlap(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(left.size, right.size);
}

function extractMemories(text: string): Array<{ category: MemoryCategory; content: string; importance: number }> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 6 || clean.length > 500) return [];
  const candidates: Array<{ category: MemoryCategory; content: string; importance: number }> = [];
  const add = (category: MemoryCategory, importance: number) => candidates.push({ category, content: clean, importance });

  if (/\b(мене звати|моє ім'я|моє ім’я|називай мене|звертайся до мене)\b/i.test(clean)) add('name', 5);
  if (/\b(люблю|подобається|подобаються|не люблю|ненавиджу|улюблен|улюблена|улюблене)\b/i.test(clean)) add('preference', 4);
  if (/\b(мій проєкт|мій проект|працюю над|роблю|розробляю|навчаюся|вчуся)\b/i.test(clean)) add('project', 4);
  if (/\b(хочу|планую|мрію|моя ціль|моє завдання|потрібно до)\b/i.test(clean)) add('goal', 4);
  if (/\b(зазвичай|щодня|кожного дня|звик|звичка|встаю|лягаю)\b/i.test(clean)) add('habit', 3);
  if (/\b(завтра|сьогодні|наступного тижня|важлива подія|день народження|зустріч)\b/i.test(clean)) add('event', 3);
  if (/\b(моя мама|мій тато|моя дівчина|мій хлопець|мій друг|моя подруга|колег[аи])\b/i.test(clean)) add('relationship', 3);
  if (/\b(мені подобається коли|відповідай|пиши мені|не пиши|без емодзі|з емодзі)\b/i.test(clean)) add('interaction', 4);

  return candidates.slice(0, 2);
}

export class LunaStateService {
  constructor(private readonly kv: KVStorage) {}

  private key(userId: number | string): string {
    return `${PROFILE_PREFIX}${userId}`;
  }

  async get(userId: number | string): Promise<LunaProfileState> {
    const saved = await this.kv.get<Partial<LunaProfileState>>(this.key(userId));
    return {
      memories: saved?.memories || [],
      reflections: saved?.reflections || [],
      emotional: { ...DEFAULT_EMOTIONAL, ...(saved?.emotional || {}) },
      personality: { ...DEFAULT_PERSONALITY, ...(saved?.personality || {}) },
      proactiveEnabled: saved?.proactiveEnabled !== false,
      lastConsolidatedAt: saved?.lastConsolidatedAt || 0,
    };
  }

  private async save(userId: number | string, state: LunaProfileState): Promise<void> {
    await this.kv.set(this.key(userId), state, 180 * DAY);
  }

  async getRelevantMemories(userId: number | string, query: string, limit = 8): Promise<LunaMemory[]> {
    const state = await this.get(userId);
    const now = Date.now();
    return state.memories
      .map((memory) => ({
        memory,
        score: overlap(memory.content, query) * 4 + memory.importance * 0.35 + Math.max(0, 1 - (now - memory.lastSeenAt) / (180 * DAY)),
      }))
      .filter((item) => overlap(item.memory.content, query) > 0 || item.memory.importance >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  }

  async recordTurn(userId: number | string, userText: string, emotion: LunaEmotion): Promise<void> {
    const state = await this.get(userId);
    const now = Date.now();
    const candidates = extractMemories(userText);

    for (const candidate of candidates) {
      const existing = state.memories.find((memory) => memory.category === candidate.category && overlap(memory.content, candidate.content) >= 0.55);
      if (existing) {
        existing.content = candidate.content;
        existing.importance = Math.min(5, Math.max(existing.importance, candidate.importance) + (existing.mentions >= 2 ? 1 : 0));
        existing.mentions += 1;
        existing.updatedAt = now;
        existing.lastSeenAt = now;
      } else {
        state.memories.push({ id: crypto.randomUUID(), content: candidate.content, category: candidate.category, importance: candidate.importance, mentions: 1, createdAt: now, updatedAt: now, lastSeenAt: now });
      }
    }

    const previous = state.emotional;
    const target = emotion === 'sad' ? { mood: 0.25, stress: 0.65, energy: 0.35 } :
      emotion === 'angry' ? { mood: 0.35, stress: 0.72, energy: 0.5 } :
      emotion === 'happy' || emotion === 'love' ? { mood: 0.85, stress: 0.08, energy: 0.8 } :
      emotion === 'sleepy' ? { mood: 0.52, stress: 0.2, energy: 0.25 } :
      { mood: 0.62, stress: 0.18, energy: 0.65 };
    state.emotional = {
      ...previous,
      mood: clamp(previous.mood * 0.75 + target.mood * 0.25),
      stress: clamp(previous.stress * 0.75 + target.stress * 0.25),
      energy: clamp(previous.energy * 0.8 + target.energy * 0.2),
      curiosity: clamp(previous.curiosity + (userText.includes('?') ? 0.02 : 0)),
      confidence: clamp(previous.confidence * 0.98 + 0.72 * 0.02),
      affection: clamp(previous.affection + (emotion === 'love' ? 0.03 : 0)),
      updatedAt: now,
    };

    const personality = state.personality;
    personality.interactionCount += 1;
    personality.updatedAt = now;
    personality.humor = clamp(personality.humor + (/(жарт|сміш|прикол)/i.test(userText) ? 0.015 : 0));
    personality.brevity = clamp(personality.brevity + (userText.length < 40 ? 0.01 : -0.003));
    personality.curiosity = clamp(personality.curiosity + (userText.includes('?') ? 0.008 : 0));
    const address = userText.match(/(?:називай мене|звертайся до мене)\s+([^,.!?]+)/i);
    if (address?.[1]) personality.preferredAddress = address[1].trim().slice(0, 80);

    if (candidates.length > 0 || userText.length > 240 || ['sad', 'angry', 'confused'].includes(emotion)) {
      state.reflections.unshift({
        id: crypto.randomUUID(),
        createdAt: now,
        summary: `Важливе у розмові: ${userText.slice(0, 240)}. Емоційний тон: ${emotion}.`,
        emotion,
        memoryIds: state.memories.slice(-candidates.length).map((memory) => memory.id),
      });
      state.reflections = state.reflections.slice(0, 30);
    }

    await this.save(userId, state);
  }

  async consolidate(userId: number | string): Promise<void> {
    const state = await this.get(userId);
    const now = Date.now();
    const merged: LunaMemory[] = [];
    for (const memory of state.memories.sort((a, b) => b.importance - a.importance || b.lastSeenAt - a.lastSeenAt)) {
      const duplicate = merged.find((item) => item.category === memory.category && overlap(item.content, memory.content) >= 0.65);
      if (duplicate) {
        duplicate.mentions += memory.mentions;
        duplicate.importance = Math.min(5, Math.max(duplicate.importance, memory.importance) + 1);
        duplicate.lastSeenAt = Math.max(duplicate.lastSeenAt, memory.lastSeenAt);
      } else if (now - memory.lastSeenAt < 180 * DAY || memory.importance >= 4) {
        merged.push(memory);
      }
    }
    state.memories = merged.slice(0, 100);
    state.lastConsolidatedAt = now;
    await this.save(userId, state);
  }

  async consolidateAll(): Promise<number> {
    if (!this.kv.isAvailable) return 0;
    const keys = await this.kv.listKeys(PROFILE_PREFIX);
    let count = 0;
    for (const key of keys) {
      const userId = key.slice(PROFILE_PREFIX.length);
      try {
        await this.consolidate(userId);
        count += 1;
      } catch (error) {
        Logger.warn(`Memory consolidation failed for ${userId}`, { error });
      }
    }
    return count;
  }

  async listMemories(userId: number | string): Promise<LunaMemory[]> {
    return (await this.get(userId)).memories.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  async deleteMemory(userId: number | string, memoryId: string): Promise<boolean> {
    const state = await this.get(userId);
    const before = state.memories.length;
    state.memories = state.memories.filter((memory) => memory.id !== memoryId);
    if (state.memories.length === before) return false;
    await this.save(userId, state);
    return true;
  }

  async clearMemories(userId: number | string): Promise<void> {
    const state = await this.get(userId);
    state.memories = [];
    state.reflections = [];
    await this.save(userId, state);
  }

  async setProactiveEnabled(userId: number | string, enabled: boolean): Promise<void> {
    const state = await this.get(userId);
    state.proactiveEnabled = enabled;
    await this.save(userId, state);
  }

  async isProactiveEnabled(userId: number | string): Promise<boolean> {
    return (await this.get(userId)).proactiveEnabled;
  }
}
