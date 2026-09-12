export interface UserProfile {
  id: number; // Telegram User ID
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
  relationshipPoints: number; // 0..1000
  relationshipTier: 'stranger' | 'acquaintance' | 'friend' | 'close_friend' | 'soulmate';
  isBanned: boolean;
  rouletteStats: {
    totalChats: number;
    rating: number;
    reportsCount: number;
  };
}

export interface RouletteSessionRecord {
  id: string;
  userA: number;
  userB: number;
  startedAt: number;
  lastMessageAt: number;
  messageCount: number;
  status: 'active' | 'closed';
}
