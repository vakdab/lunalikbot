import { IntimacyInfo, IntimacyTier, SoulCompanionState } from './types';
import { KVStorage } from '../../database/kv';

export const INTIMACY_TIERS: Record<IntimacyTier, IntimacyInfo> = {
  1: {
    tier: 1,
    title: 'Новий знайомий',
    badge: '🌱 Знайомство',
    minPoints: 0,
    maxPoints: 50,
    perks: ['Базове знайомство', 'Відповіді на запитання'],
    allowedNicknames: ['Мандрівник', 'Друг'],
  },
  2: {
    tier: 2,
    title: 'Теплий співрозмовник',
    badge: '🌿 Тепло',
    minPoints: 50,
    maxPoints: 150,
    perks: ['Запамʼятовування вподобань', 'Емоційні реакції'],
    allowedNicknames: ['Приятель', 'Співрозмовник'],
  },
  3: {
    tier: 3,
    title: 'Затишний друг',
    badge: '🌸 Дружба',
    minPoints: 150,
    maxPoints: 350,
    perks: ['Особисті історії', 'Нічні розмови', 'Діалог без формальностей'],
    allowedNicknames: ['Друже', 'Сонечко'],
  },
  4: {
    tier: 4,
    title: 'Близький довірник',
    badge: '💜 Близькість',
    minPoints: 350,
    maxPoints: 700,
    perks: ['Відверті думки', 'Щоденник Луни', 'Ніжні дії'],
    allowedNicknames: ['Мій хороший', 'Рідний'],
  },
  5: {
    tier: 5,
    title: 'Споріднена душа (Soul of Waifu)',
    badge: '✨ Споріднена душа',
    minPoints: 700,
    maxPoints: 9999,
    perks: ['Максимальна довіра', 'Ексклюзивні PNG', 'Особливий тон спілкування', 'Таємниці Луни'],
    allowedNicknames: ['Коханий', 'Моя споріднена душа', 'Мій Сенпай'],
  },
};

export class SoulIntimacyEngine {
  constructor(private readonly kv?: KVStorage) {}

  calculateTier(points: number): IntimacyTier {
    if (points >= 700) return 5;
    if (points >= 350) return 4;
    if (points >= 150) return 3;
    if (points >= 50) return 2;
    return 1;
  }

  async getSoulState(userId: number): Promise<SoulCompanionState> {
    const key = `soul_state:${userId}`;
    const cached = await this.kv?.get<SoulCompanionState>(key);

    if (cached) return cached;

    const todayStr = new Date().toISOString().slice(0, 10);
    const initial: SoulCompanionState = {
      userId,
      affectionPoints: 10,
      intimacyTier: 1,
      dailyStreak: 1,
      lastInteractionDate: todayStr,
      currentMood: 'serene',
      diary: [],
    };

    if (this.kv) {
      await this.kv.set(key, initial, 3600 * 24 * 30);
    }
    return initial;
  }

  async addAffection(
    userId: number,
    points: number = 2
  ): Promise<{ state: SoulCompanionState; tierUp: boolean }> {
    const state = await this.getSoulState(userId);
    const oldTier = state.intimacyTier;

    // Daily streak logic
    const todayStr = new Date().toISOString().slice(0, 10);
    if (state.lastInteractionDate !== todayStr) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (state.lastInteractionDate === yesterday) {
        state.dailyStreak += 1;
        points += 5; // Daily streak bonus
      } else {
        state.dailyStreak = 1;
      }
      state.lastInteractionDate = todayStr;
    }

    state.affectionPoints += points;
    state.intimacyTier = this.calculateTier(state.affectionPoints);

    const tierUp = state.intimacyTier > oldTier;

    if (this.kv) {
      await this.kv.set(`soul_state:${userId}`, state, 3600 * 24 * 30);
    }

    return { state, tierUp };
  }
}
