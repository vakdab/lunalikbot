import { ActiveSession, QueueUser } from './types';
import { Logger } from '../utils/logger';

export class RouletteHubDO {
  private queue: QueueUser[] = [];
  private activeSessions: Map<string, ActiveSession> = new Map();
  private userToSession: Map<number, string> = new Map();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/join' && request.method === 'POST') {
        const body: { userId: number; chatId: number; lastPartnerId?: number } = await request.json();
        const result = this.handleJoin(body.userId, body.chatId, body.lastPartnerId);
        return Response.json(result);
      }

      if (path === '/leave' && request.method === 'POST') {
        const body: { userId: number } = await request.json();
        const result = this.handleLeave(body.userId);
        return Response.json(result);
      }

      if (path === '/session' && request.method === 'GET') {
        const userId = parseInt(url.searchParams.get('userId') || '0', 10);
        const session = this.getSessionForUser(userId);
        return Response.json({ session });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      Logger.error('DurableObject request error', err);
      return Response.json({ error: String(err) }, { status: 500 });
    }
  }

  private handleJoin(
    userId: number,
    chatId: number,
    lastPartnerId?: number
  ): { matched: boolean; session?: ActiveSession; partnerChatId?: number } {
    // 1. Remove if already in session or queue
    this.handleLeave(userId);

    // 2. Look for eligible candidate in queue (cannot match with self or immediate last partner)
    const matchIndex = this.queue.findIndex(
      (candidate) => candidate.userId !== userId && candidate.userId !== lastPartnerId
    );

    if (matchIndex !== -1) {
      const partner = this.queue.splice(matchIndex, 1)[0];
      const sessionId = `rs_${Date.now()}_${userId}_${partner.userId}`;

      const session: ActiveSession = {
        sessionId,
        userA: userId,
        chatA: chatId,
        userB: partner.userId,
        chatB: partner.chatId,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      this.activeSessions.set(sessionId, session);
      this.userToSession.set(userId, sessionId);
      this.userToSession.set(partner.userId, sessionId);

      Logger.info(`Roulette matched user ${userId} with user ${partner.userId}`);
      return { matched: true, session, partnerChatId: partner.chatId };
    }

    // 3. Put into queue
    this.queue.push({
      userId,
      chatId,
      joinedAt: Date.now(),
      lastPartnerId,
    });

    Logger.info(`User ${userId} queued in Roulette. Total in queue: ${this.queue.length}`);
    return { matched: false };
  }

  private handleLeave(
    userId: number
  ): { leftQueue: boolean; closedSession?: ActiveSession; partnerChatId?: number } {
    // Remove from queue
    const queueIdx = this.queue.findIndex((u) => u.userId === userId);
    let leftQueue = false;
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
      leftQueue = true;
    }

    // Close session if active
    const sessionId = this.userToSession.get(userId);
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        this.activeSessions.delete(sessionId);
        this.userToSession.delete(session.userA);
        this.userToSession.delete(session.userB);

        const partnerChatId = session.userA === userId ? session.chatB : session.chatA;
        return { leftQueue, closedSession: session, partnerChatId };
      }
    }

    return { leftQueue };
  }

  private getSessionForUser(userId: number): ActiveSession | null {
    const sessionId = this.userToSession.get(userId);
    if (!sessionId) return null;
    return this.activeSessions.get(sessionId) || null;
  }
}
