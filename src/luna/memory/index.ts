import { MemoryRetriever } from './retrieve';
import { MemorySaver } from './save';
import { KVStorage } from '../../database/kv';

export * from './types';
export * from './retrieve';
export * from './save';

export class MemoryService {
  public readonly retriever: MemoryRetriever;
  public readonly saver: MemorySaver;

  constructor(apiKey?: string, kv?: KVStorage, orgId?: string, projectId?: string) {
    this.retriever = new MemoryRetriever(apiKey, kv, orgId, projectId);
    this.saver = new MemorySaver(apiKey, kv, orgId, projectId);
  }

  async getRelevantMemories(userId: number | string, query: string, limit?: number): Promise<string[]> {
    return this.retriever.searchRelevant({
      userId,
      query,
      agentId: 'luna',
      limit: limit || 5,
    });
  }

  async saveExchange(
    userId: number | string,
    userText: string,
    assistantText: string
  ): Promise<boolean> {
    return this.saver.addMemory({
      userId,
      agentId: 'luna',
      messages: [
        { role: 'user', content: userText },
        { role: 'assistant', content: assistantText },
      ],
    });
  }
}
