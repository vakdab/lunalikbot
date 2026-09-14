import { KVStorage } from '../database/kv';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

const MAX_TURNS = 12;
const HISTORY_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Short-term chat context. Mem0 stores durable facts; this stores the recent dialogue. */
export class ConversationHistory {
  constructor(private readonly kv: KVStorage) {}

  private key(chatId: number, userId: number): string {
    return `conversation:${chatId}:${userId}`;
  }

  async get(chatId: number, userId: number): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const turns = await this.kv.get<ConversationTurn[]>(this.key(chatId, userId));
    if (!turns) return [];
    return turns.slice(-MAX_TURNS).map(({ role, content }) => ({ role, content }));
  }

  async append(
    chatId: number,
    userId: number,
    userText: string,
    assistantText: string
  ): Promise<void> {
    const key = this.key(chatId, userId);
    const previous = (await this.kv.get<ConversationTurn[]>(key)) || [];
    const now = Date.now();
    const next = [
      ...previous,
      { role: 'user' as const, content: userText, at: now },
      { role: 'assistant' as const, content: assistantText, at: now },
    ].slice(-MAX_TURNS);

    await this.kv.set(key, next, HISTORY_TTL_SECONDS);
  }
}
