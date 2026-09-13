import { UserProfile } from '../../database/types';

export interface PromptContextParams {
  user: UserProfile;
  relevantMemories?: string[];
  currentTimeString?: string;
  timeOfDayGreeting?: string;
}

export function buildContextPrompt(params: PromptContextParams): string {
  const { user, relevantMemories, currentTimeString, timeOfDayGreeting } = params;
  let context = `\n--- КОНТЕКСТ КОРИСТУВАЧА ТА ПАМʼЯТІ ---\n`;
  context += `• Імʼя: ${user.firstName || 'Друг'}\n`;
  if (currentTimeString) context += `• Час у Києві: ${currentTimeString} (${timeOfDayGreeting || 'звичайний час'})\n`;
  if (relevantMemories?.length) {
    context += `\n🧠 Довготривала памʼять (згадуй лише доречно):\n`;
    relevantMemories.forEach((memory, index) => { context += `[Спогад ${index + 1}]: ${memory}\n`; });
  } else {
    context += `\n🧠 Памʼять поки що порожня — дізнайся більше під час розмови.\n`;
  }
  return context;
}
