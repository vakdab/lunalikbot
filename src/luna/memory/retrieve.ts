import { KVStorage } from '../../database/kv';
import { Logger } from '../../utils/logger';
import { Mem0MemoryItem, Mem0SearchOptions } from './types';

export class MemoryRetriever {
  private readonly baseUrl = 'https://api.mem0.ai/v1';

  constructor(
    private readonly apiKey?: string,
    private readonly kv?: KVStorage,
    private readonly orgId?: string,
    private readonly projectId?: string
  ) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
    if (this.orgId) headers['X-Org-Id'] = this.orgId;
    if (this.projectId) headers['X-Project-Id'] = this.projectId;
    return headers;
  }

  async searchRelevant(options: Mem0SearchOptions): Promise<string[]> {
    const { query, userId, agentId = 'luna', limit = 5 } = options;

    if (!this.apiKey) {
      return this.searchKVFallback(userId, query);
    }

    try {
      const response = await fetch(`${this.baseUrl}/memories/search/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query,
          user_id: String(userId),
          agent_id: agentId,
          top_k: limit,
        }),
      });

      if (!response.ok) {
        Logger.warn(`Mem0 search returned status ${response.status}`);
        return this.searchKVFallback(userId, query);
      }

      const data: any = await response.json();
      const results: any[] = Array.isArray(data) ? data : data.results || [];
      return results.map((r) => r.memory || r.text).filter(Boolean);
    } catch (err) {
      Logger.error('Failed to search Mem0 memories', err);
      return this.searchKVFallback(userId, query);
    }
  }

  async getAllUserMemories(userId: number | string, agentId: string = 'luna'): Promise<Mem0MemoryItem[]> {
    if (!this.apiKey) {
      const kvList = (await this.kv?.get<string[]>(`memories:${userId}`)) || [];
      return kvList.map((m, i) => ({
        id: `kv-${i}`,
        memory: m,
        user_id: String(userId),
        agent_id: agentId,
      }));
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/memories/?user_id=${userId}&agent_id=${agentId}`,
        {
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) return [];
      const data: any = await response.json();
      const rawList: any[] = Array.isArray(data) ? data : data.results || [];
      return rawList.map((item) => ({
        id: item.id || String(Math.random()),
        memory: item.memory || item.text,
        user_id: item.user_id || String(userId),
        agent_id: item.agent_id || agentId,
        metadata: item.metadata,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (err) {
      Logger.error('Failed to fetch all memories from Mem0', err);
      return [];
    }
  }

  private async searchKVFallback(userId: number | string, query: string): Promise<string[]> {
    if (!this.kv) return [];
    const memories = (await this.kv.get<string[]>(`memories:${userId}`)) || [];
    if (memories.length === 0) return [];

    const lowerQuery = query.toLowerCase();
    const matches = memories.filter((m) =>
      m.toLowerCase().split(' ').some((w) => w.length > 3 && lowerQuery.includes(w))
    );

    return (matches.length > 0 ? matches : memories).slice(0, 5);
  }
}
