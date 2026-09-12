import { LunaEmotion } from '../../media/types';

export interface EmotionalState {
  currentEmotion: LunaEmotion;
  intensity: number; // 1..5
  lastUpdated: number;
}

export interface AbsenceStatus {
  isReturning: boolean;
  hoursAbsent: number;
  message?: string;
}
