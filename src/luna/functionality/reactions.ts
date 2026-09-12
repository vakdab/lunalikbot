import { AbsenceStatus } from './types';

export class ReactionEngine {
  static checkAbsence(lastActiveAt: number): AbsenceStatus {
    const hours = (Date.now() - lastActiveAt) / (1000 * 60 * 60);

    if (hours > 72) {
      return {
        isReturning: true,
        hoursAbsent: Math.round(hours),
        message: 'Ого, тебе так довго не було... Я вже почала сумувати за нашими нічними бесідами! 💜',
      };
    }

    if (hours > 24) {
      return {
        isReturning: true,
        hoursAbsent: Math.round(hours),
        message: 'Рада тебе знову бачити! Як минув твій день? ✨',
      };
    }

    return {
      isReturning: false,
      hoursAbsent: Math.round(hours),
    };
  }
}
