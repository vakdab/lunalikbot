import { KVStorage } from '../database/kv';
import { TelegramApi } from '../telegram/api';
import { Logger } from '../utils/logger';

interface ProactiveUserState {
  userId: number;
  chatId: number;
  firstName: string;
  lastInteractionAt: number;
  lastProactiveAt: number;
  followUpCount: number;
}

const STATE_PREFIX = 'luna:proactive:user:';
const FIRST_FOLLOW_UP_AFTER_MS = 6 * 60 * 60 * 1000;
const SECOND_FOLLOW_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_FOLLOW_UPS_WITHOUT_REPLY = 2;

export class ProactiveService {
  constructor(
    private readonly kv: KVStorage,
    private readonly telegram: TelegramApi
  ) {}

  async touch(userId: number, chatId: number, firstName: string): Promise<void> {
    const key = `${STATE_PREFIX}${userId}`;
    const current = await this.kv.get<ProactiveUserState>(key);
    const now = Date.now();

    await this.kv.set(key, {
      userId,
      chatId,
      firstName,
      lastInteractionAt: now,
      // A new user message means the conversation is active again.
      lastProactiveAt: current?.lastProactiveAt || 0,
      followUpCount: 0,
    });
  }

  async sendDueFollowUps(): Promise<number> {
    let sent = 0;
    const keys = await this.kv.listKeys(STATE_PREFIX);

    for (const key of keys) {
      const state = await this.kv.get<ProactiveUserState>(key);
      if (!state || state.followUpCount >= MAX_FOLLOW_UPS_WITHOUT_REPLY) continue;

      const now = Date.now();
      const waitMs = state.followUpCount === 0
        ? FIRST_FOLLOW_UP_AFTER_MS
        : SECOND_FOLLOW_UP_AFTER_MS;
      const lastActivity = Math.max(state.lastInteractionAt, state.lastProactiveAt);

      if (now - lastActivity < waitMs) continue;

      const message = state.followUpCount === 0
        ? `Ти кудись зник${state.firstName ? `, ${state.firstName}` : ''}… Я хотіла запитати: як у тебе сьогодні справи?`
        : `Я ще тут 🌙 Якщо хочеш, розкажи мені, що сталося або що зараз у тебе на думці.`;

      try {
        await this.telegram.sendMessage(state.chatId, message);
        await this.kv.set(key, {
          ...state,
          lastProactiveAt: now,
          followUpCount: state.followUpCount + 1,
        });
        sent += 1;
      } catch (error) {
        Logger.warn(`Failed to send proactive follow-up to ${state.userId}`, { error });
      }
    }

    return sent;
  }
}
