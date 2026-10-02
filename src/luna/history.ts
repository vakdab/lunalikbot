import { KVStorage } from '../database/kv';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

export interface ConversationContext {
  summary: string;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// KV is used as a durable short-term transcript. Keep enough context for a
// genuinely continuous chat, while bounding the value and the prompt size.
const MAX_STORED_TURNS = 40;
const MAX_CONTEXT_TURNS = 24;
const MAX_CONTEXT_CHARS = 18_000;
const HISTORY_TTL_SECONDS = 30 * 24 * 60 * 60;

type StoredConversation = {
  summary?: string;
  turns: ConversationTurn[];
};

/** Short-term dialogue context. Mem0 stores durable facts; KV stores the transcript. */
export class ConversationHistory {
  constructor(private readonly kv: KVStorage) {}

  private key(chatId: number, userId: number): string {
    return `conversation:${chatId}:${userId}`;
  }

  async getContext(chatId: number, userId: number): Promise<ConversationContext> {
    const stored = await this.kv.get<StoredConversation | ConversationTurn[]>(this.key(chatId, userId));
    if (!stored) return { summary: '', turns: [] };

    // Read old array-only records written by previous versions without losing them.
    const turns = Array.isArray(stored) ? stored : stored.turns || [];
    const summary = Array.isArray(stored) ? '' : stored.summary || '';
    const selected: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let chars = 0;

    for (const turn of turns.slice(-MAX_CONTEXT_TURNS).reverse()) {
      const content = String(turn.content || '').trim();
      if (!content) continue;
      if (selected.length > 0 && chars + content.length > MAX_CONTEXT_CHARS) break;
      selected.unshift({ role: turn.role, content });
      chars += content.length;
    }

    return { summary, turns: selected };
  }

  async get(chatId: number, userId: number): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    return (await this.getContext(chatId, userId)).turns;
  }

  async append(
    chatId: number,
    userId: number,
    userText: string,
    assistantText: string
  ): Promise<void> {
    const key = this.key(chatId, userId);
    const stored = await this.kv.get<StoredConversation | ConversationTurn[]>(key);
    const previous: StoredConversation = Array.isArray(stored)
      ? { turns: stored }
      : stored || { turns: [] };
    const now = Date.now();
    const addedTurns: ConversationTurn[] = [
      { role: 'user', content: userText.trim(), at: now },
      { role: 'assistant', content: assistantText.trim(), at: now },
    ];
    const next: StoredConversation = {
      summary: previous.summary,
      turns: [...(previous.turns || []), ...addedTurns].slice(-MAX_STORED_TURNS),
    };

    await this.kv.set(key, next, HISTORY_TTL_SECONDS);
  }
}
