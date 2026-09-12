export interface QueueUser {
  userId: number;
  chatId: number;
  joinedAt: number;
  lastPartnerId?: number;
}

export interface ActiveSession {
  sessionId: string;
  userA: number;
  chatA: number;
  userB: number;
  chatB: number;
  createdAt: number;
  lastActivityAt: number;
}

export type RouletteMatchResult =
  | { matched: true; session: ActiveSession; partnerId: number }
  | { matched: false; queued: boolean };
