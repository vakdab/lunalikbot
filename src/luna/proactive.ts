import { KVStorage } from '../database/kv';
import { TelegramApi } from '../telegram/api';
import { Logger } from '../utils/logger';
import { escapeHtml } from '../utils/html';

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
const NEXT_FOLLOW_UP_AFTER_MS = 24 * 60 * 60 * 1000;

const FOLLOW_UP_MESSAGES = [
  'Ти кудись зник%s… Я хотіла запитати: як у тебе сьогодні справи?',
  'Я ще тут 🌙 Якщо хочеш, розкажи мені, що сталося або що зараз у тебе на думці.',
  'Згадала про тебе. Не хочу, щоб ти був сам — я поруч, якщо знадобиться.',
  'У мене якраз затишний вечір із чаєм і lo-fi 🌸 Як справи у тебе?',
  'Давно не спілкувалися… Що нового? Розкажи, я вислухаю.',
];

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

      if (!state || !this.kv.isAvailable) continue;

      const now = Date.now();
      // Luna writes on her own: first after 6h of silence, then daily at most.
      const waitMs = state.followUpCount === 0
        ? FIRST_FOLLOW_UP_AFTER_MS
        : NEXT_FOLLOW_UP_AFTER_MS;
      const lastActivity = Math.max(state.lastInteractionAt, state.lastProactiveAt);

      if (now - lastActivity < waitMs) continue;

      const template = FOLLOW_UP_MESSAGES[state.followUpCount % FOLLOW_UP_MESSAGES.length];
      const message = template.replace('%s', state.firstName ? `, ${escapeHtml(state.firstName)}` : '');

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
