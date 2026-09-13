import { KVStorage } from '../../database/kv';
import { Logger } from '../../utils/logger';
import { Mem0AddOptions } from './types';

const MEM0_V3_URL = 'https://api.mem0.ai/v3';
const MEM0_V1_URL = 'https://api.mem0.ai/v1';

export class MemorySaver {
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

  async addMemory(options: Mem0AddOptions): Promise<boolean> {
    const { userId, messages, agentId = 'luna', metadata } = options;

    if (!this.apiKey) return this.saveToKVFallback(userId, messages);

    try {
      // Mem0's current additive pipeline is V3. Processing is asynchronous and
      // normally returns 202 with an event_id, which still means the request was accepted.
      const response = await fetch(`${MEM0_V3_URL}/memories/add/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages,
          user_id: String(userId),
          agent_id: agentId,
          metadata: {
            ...metadata,
            source: 'soul_of_waifu_luna',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        Logger.warn(`Mem0 V3 add memory failed with status ${response.status}: ${await response.text()}`);
        return this.saveToKVFallback(userId, messages);
      }

      Logger.info(`Saved memory to Mem0 (user: ${userId}, agent: ${agentId})`);
      return true;
    } catch (err) {
      Logger.error(`Error saving memory to Mem0 for user ${userId}`, err);
      return this.saveToKVFallback(userId, messages);
    }
  }

  async deleteMemoryById(memoryId: string): Promise<boolean> {
    if (!this.apiKey) return true;

    try {
      const res = await fetch(`${MEM0_V1_URL}/memories/${encodeURIComponent(memoryId)}/`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (err) {
      Logger.error(`Failed to delete memory ${memoryId}`, err);
      return false;
    }
  }

  async clearUserMemories(userId: number | string, agentId: string = 'luna'): Promise<boolean> {
    if (this.kv) await this.kv.delete(`memories:${userId}`);
    if (!this.apiKey) return true;

    try {
      const params = new URLSearchParams({
        user_id: String(userId),
        agent_id: agentId,
      });
      if (this.orgId) params.set('org_id', this.orgId);
      if (this.projectId) params.set('project_id', this.projectId);

      const res = await fetch(`${MEM0_V1_URL}/memories/?${params.toString()}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (err) {
      Logger.error(`Failed to clear Mem0 memories for user ${userId}`, err);
      return false;
    }
  }

  private async saveToKVFallback(
    userId: number | string,
    messages: Array<{ role: string; content: string }>
  ): Promise<boolean> {
    if (!this.kv) return false;

    try {
      const existing = (await this.kv.get<string[]>(`memories:${userId}`)) || [];
      const userMsg = messages.find((message) => message.role === 'user')?.content;
      if (userMsg && userMsg.length > 8 && !userMsg.startsWith('/')) {
        const snippet = userMsg.slice(0, 120);
        if (!existing.includes(snippet)) {
          existing.unshift(snippet);
          if (existing.length > 20) existing.pop();
          await this.kv.set(`memories:${userId}`, existing, 3600 * 24 * 30);
        }
      }
      return true;
    } catch (err) {
      Logger.error('KV memory save fallback error', err);
      return false;
    }
  }
}
