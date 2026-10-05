import { Logger } from '../utils/logger';

interface TencentMemoryConfig {
  endpoint?: string;
  apiKey?: string;
  serviceId?: string;
  teamId?: string;
  agentId?: string;
  timeoutMs?: number;
}

interface AtomicSearchItem {
  id: string;
  content: string;
  score?: number;
  type?: string;
}

interface TencentEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

/**
 * Small Cloudflare-compatible adapter for TencentDB Agent Memory MemoryCore.
 *
 * The full MemoryCore runtime stays outside the Worker. The Worker only calls
 * its HTTP v3 data plane, which keeps L0 capture and L1 retrieval isolated by
 * team, agent and Telegram user IDs. If the gateway is unavailable, callers
 * fall back to the existing KV/Mem0 pipeline.
 */
export class TencentMemoryService {
  private readonly endpoint: string;
  private readonly configured: boolean;
  private readonly timeoutMs: number;

  constructor(private readonly config: TencentMemoryConfig) {
    this.endpoint = (config.endpoint || '').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 5000;
    this.configured = Boolean(
      this.endpoint && config.apiKey && config.serviceId && config.teamId && config.agentId
    );
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  private identity(userId: number | string, sessionId?: string): Record<string, string> {
    return {
      team_id: this.config.teamId as string,
      agent_id: this.config.agentId as string,
      user_id: String(userId),
      ...(sessionId ? { session_id: sessionId } : {}),
    };
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.configured) throw new Error('Tencent MemoryCore is not configured');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'x-tdai-service-id': this.config.serviceId as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json() as TencentEnvelope<T>;
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || `MemoryCore HTTP ${response.status}`);
      }
      return payload.data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  sessionId(chatId: number | string): string {
    return `telegram:${chatId}`;
  }

  async recall(userId: number | string, query: string, limit = 8): Promise<string[]> {
    if (!this.configured || !query.trim()) return [];
    try {
      const data = await this.post<{ items?: AtomicSearchItem[] }>('/v3/atomic/search', {
        ...this.identity(userId),
        query: query.trim(),
        limit,
      });
      return (data?.items || [])
        .filter((item) => item.content?.trim())
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((item) => item.content.trim());
    } catch (error) {
      Logger.warn('Tencent MemoryCore recall failed, using fallback memory', { error });
      return [];
    }
  }

  async captureTurn(
    userId: number | string,
    chatId: number | string,
    userText: string,
    assistantText: string
  ): Promise<boolean> {
    if (!this.configured) return false;
    try {
      await this.post('/v3/conversation/add', {
        ...this.identity(userId, this.sessionId(chatId)),
        messages: [
          { role: 'user', content: userText, timestamp: new Date().toISOString() },
          { role: 'assistant', content: assistantText, timestamp: new Date().toISOString() },
        ],
      });
      return true;
    } catch (error) {
      Logger.warn('Tencent MemoryCore capture failed, using fallback memory', { error });
      return false;
    }
  }

  async clearSession(userId: number | string, chatId: number | string): Promise<boolean> {
    if (!this.configured) return false;
    try {
      await this.post('/v3/conversation/delete', {
        ...this.identity(userId),
        session_ids: [this.sessionId(chatId)],
      });
      return true;
    } catch (error) {
      Logger.warn('Tencent MemoryCore session clear failed', { error });
      return false;
    }
  }
}
