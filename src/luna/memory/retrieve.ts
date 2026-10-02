import { KVStorage } from '../../database/kv';
import { Logger } from '../../utils/logger';
import { Mem0MemoryItem, Mem0SearchOptions } from './types';

const MEM0_V3_URL = 'https://api.mem0.ai/v3';

export class MemoryRetriever {
  constructor(
    private readonly apiKey?: string,
    private readonly kv?: KVStorage,
    private readonly orgId?: string,
    private readonly projectId?: string
  ) {}

  private getHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
  }

  async searchRelevant(options: Mem0SearchOptions): Promise<string[]> {
    const { query, userId, agentId = 'luna', limit = 5, threshold } = options;

    if (!this.apiKey) {
      Logger.warn(`Mem0 is not configured; no long-term memories available for user ${userId}`);
      return [];
    }

    try {
      const response = await fetch(`${MEM0_V3_URL}/memories/search/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query,
          // V3 requires entity IDs inside filters, not at the top level.
          filters: {
            AND: [{ user_id: String(userId) }, { agent_id: agentId }],
          },
          top_k: Math.max(1, Math.min(limit, 1000)),
          ...(threshold === undefined ? {} : { threshold }),
        }),
      });

      if (!response.ok) {
        Logger.warn(`Mem0 V3 search returned status ${response.status}: ${await response.text()}`);
        return [];
      }

      const data = (await response.json()) as { results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const results = Array.isArray(data) ? data : data.results || [];
      return results
        .map((item) => item.memory || item.text)
        .filter((memory): memory is string => typeof memory === 'string' && memory.length > 0);
    } catch (err) {
      Logger.error('Failed to search Mem0 memories', err);
      return [];
    }
  }

  async getAllUserMemories(userId: number | string, agentId: string = 'luna'): Promise<Mem0MemoryItem[]> {
    if (!this.apiKey) return [];

    try {
      // V3 get-all is POST with a filter body and a paginated response envelope.
      const response = await fetch(`${MEM0_V3_URL}/memories/?page=1&page_size=200`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          filters: {
            AND: [{ user_id: String(userId) }, { agent_id: agentId }],
          },
        }),
      });

      if (!response.ok) {
        Logger.warn(`Mem0 V3 get memories returned status ${response.status}: ${await response.text()}`);
        return [];
      }

      const data = (await response.json()) as { results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const rawList = Array.isArray(data) ? data : data.results || [];
      return rawList.map((item) => ({
        id: String(item.id || crypto.randomUUID()),
        memory: String(item.memory || item.text || ''),
        user_id: String(item.user_id || userId),
        agent_id: String(item.agent_id || agentId),
        metadata: item.metadata as Mem0MemoryItem['metadata'],
        created_at: item.created_at as string | undefined,
        updated_at: item.updated_at as string | undefined,
      })).filter((item) => item.memory.length > 0);
    } catch (err) {
      Logger.error('Failed to fetch all memories from Mem0', err);
      return [];
    }
  }

}
