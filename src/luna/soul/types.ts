import { LunaEmotion } from '../../media/types';

export type IntimacyTier = 1 | 2 | 3 | 4 | 5;

export interface IntimacyInfo {
  tier: IntimacyTier;
  title: string;
  badge: string;
  minPoints: number;
  maxPoints: number;
  perks: string[];
  allowedNicknames: string[];
}

export interface DiaryEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  thought: string;
  emotion: LunaEmotion;
  intimacyLevel: number;
}

export interface SoulCompanionState {
  userId: number;
  affectionPoints: number;
  intimacyTier: IntimacyTier;
  dailyStreak: number;
  lastInteractionDate: string;
  customNickname?: string;
  currentMood: 'serene' | 'playful' | 'thoughtful' | 'affectionate' | 'sleepy' | 'tsundere';
  diary: DiaryEntry[];
}
