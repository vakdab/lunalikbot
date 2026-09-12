import { ActiveSession } from './types';
import { Logger } from '../utils/logger';

export class RouletteClient {
  constructor(private readonly doNamespace?: DurableObjectNamespace) {}

  private getStub(): DurableObjectStub | null {
    if (!this.doNamespace) return null;
    const id = this.doNamespace.idFromName('GLOBAL_ROULETTE_HUB');
    return this.doNamespace.get(id);
  }

  async join(
    userId: number,
    chatId: number,
    lastPartnerId?: number
  ): Promise<{ matched: boolean; session?: ActiveSession; partnerChatId?: number }> {
    const stub = this.getStub();
    if (!stub) {
      Logger.warn('ROULETTE_HUB Durable Object binding not configured.');
      return { matched: false };
    }

    const res = await stub.fetch('http://do/join', {
      method: 'POST',
      body: JSON.stringify({ userId, chatId, lastPartnerId }),
      headers: { 'Content-Type': 'application/json' },
    });

    return (await res.json()) as any;
  }

  async leave(
    userId: number
  ): Promise<{ leftQueue: boolean; closedSession?: ActiveSession; partnerChatId?: number }> {
    const stub = this.getStub();
    if (!stub) return { leftQueue: false };

    const res = await stub.fetch('http://do/leave', {
      method: 'POST',
      body: JSON.stringify({ userId }),
      headers: { 'Content-Type': 'application/json' },
    });

    return (await res.json()) as any;
  }

  async getSession(userId: number): Promise<ActiveSession | null> {
    const stub = this.getStub();
    if (!stub) return null;

    const res = await stub.fetch(`http://do/session?userId=${userId}`);
    const data: any = await res.json();
    return data.session || null;
  }
}
