import { UserProfile } from '../../database/types';
import { LunaIntent } from '../router';

export interface PromptContextParams {
  user: UserProfile;
  relevantMemories?: string[];
  currentTimeString?: string;
  timeOfDayGreeting?: string;
  intent?: LunaIntent;
}

export function buildContextPrompt(params: PromptContextParams): string {
  const { user, relevantMemories, currentTimeString, timeOfDayGreeting, intent } = params;
  let context = `\n--- КОНТЕКСТ КОРИСТУВАЧА ТА ПАМʼЯТІ ---\n`;
  context += `• Імʼя: ${user.firstName || 'Друг'}\n`;
  if (currentTimeString) context += `• Час у Києві: ${currentTimeString} (${timeOfDayGreeting || 'звичайний час'})\n`;
  if (intent) {
    context += `• Визначений тип запиту: ${intent}\n`;
    context += `• Не запускай інструменти, яких немає в доступному контексті. Якщо потрібен зовнішній пошук або OCR, чесно скажи про обмеження.\n`;
  }
  if (relevantMemories?.length) {
    context += `\n🧠 Довготривала памʼять (згадуй лише доречно):\n`;
    relevantMemories.forEach((memory, index) => { context += `[Спогад ${index + 1}]: ${memory}\n`; });
  } else {
    context += `\n🧠 Памʼять поки що порожня — дізнайся більше під час розмови.\n`;
  }
  return context;
}
