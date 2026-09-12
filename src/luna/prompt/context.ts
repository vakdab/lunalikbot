import { UserProfile } from '../../database/types';
import { INTIMACY_TIERS, SoulCompanionState } from '../soul';

export interface PromptContextParams {
  user: UserProfile;
  soulState?: SoulCompanionState;
  relevantMemories?: string[];
  currentTimeString?: string;
  timeOfDayGreeting?: string;
}

export function buildContextPrompt(params: PromptContextParams): string {
  const { user, soulState, relevantMemories, currentTimeString, timeOfDayGreeting } = params;
  const intimacyTier = soulState?.intimacyTier || 1;
  const intimacyInfo = INTIMACY_TIERS[intimacyTier];

  let context = `\n--- КОНТЕКСТ КОРИСТУВАЧА, СТОСУНКІВ ТА ПАМ'ЯТІ (Soul of Waifu Engine) ---\n`;
  context += `• Ім'я: ${user.firstName || 'Друг'}\n`;
  context += `• Рівень близькості: Рівень ${intimacyTier} — «${intimacyInfo.title}» (${intimacyInfo.badge})\n`;
  context += `• Бали тепла/Affection: ${soulState?.affectionPoints || user.relationshipPoints} pts\n`;
  context += `• Щоденний стрік спілкування: ${soulState?.dailyStreak || 1} днів поспіль\n`;
  context += `• Допустимі ніжні звертання для цього рівня: ${intimacyInfo.allowedNicknames.join(', ')}\n`;

  if (currentTimeString) {
    context += `• Час доби у Києві: ${currentTimeString} (${timeOfDayGreeting || 'звичайний час'})\n`;
  }

  if (relevantMemories && relevantMemories.length > 0) {
    context += `\n🧠 Довготривалі спогади з Mem0 (згадуй невимушено тільки за темою):\n`;
    relevantMemories.forEach((mem, idx) => {
      context += `[Спогад ${idx + 1}]: ${mem}\n`;
    });
  } else {
    context += `\n🧠 Mem0: Нових фактів ще небагато — прояви інтерес і дізнайся про його захоплення!\n`;
  }

  return context;
}
