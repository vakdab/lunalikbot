import { assembleSystemPrompt } from '../prompt/system';
import { UserProfile } from '../../database/types';
import { AIProvider, AIResponse } from './types';
import { Logger } from '../../utils/logger';
import { IntentResult } from '../router';

export interface LunaConversationContext {
  user: UserProfile;
  userMessage: string;
  relevantMemories?: string[];
  recentHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  intent?: IntentResult;
  searchContext?: string;
}

export class LunaChatService {
  constructor(private readonly provider: AIProvider) {}

  async respond(context: LunaConversationContext): Promise<AIResponse> {
    const { user, userMessage, relevantMemories, recentHistory = [], intent, searchContext } = context;

    // 1. Time in Kyiv
    const now = new Date();
    const timeString = now.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });
    const hour = parseInt(timeString.split(':')[0], 10);
    const greeting = hour >= 23 || hour < 5 ? 'Глибока ніч (час тиші)' : hour < 12 ? 'Ранок' : hour < 18 ? 'День' : 'Затишний вечір';

    // 2. Assemble system prompt with Soul-of-Waifu & Mem0 context
    const systemPrompt = assembleSystemPrompt({
      user,
      relevantMemories,
      currentTimeString: timeString,
      timeOfDayGreeting: greeting,
      intent: intent?.intent,
      searchContext,
    });

    // 3. Messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const item of recentHistory.slice(-4)) {
      messages.push({
        role: item.role,
        content: item.content,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    Logger.info(`Chat response generated for user ${user.id}`);

    const response = await this.provider.generateResponse(messages, {
      systemInstruction: systemPrompt,
      temperature: 0.8,
      maxTokens: 800,
    });

    return response;
  }
}
