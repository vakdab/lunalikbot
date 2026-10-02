import { assembleSystemPrompt } from '../prompt/system';
import { UserProfile } from '../../database/types';
import { AIProvider, AIResponse } from './types';
import { Logger } from '../../utils/logger';
import { IntentResult } from '../router';

export interface LunaConversationContext {
  user: UserProfile;
  userMessage: string;
  relevantMemories?: string[];
  conversationSummary?: string;
  recentHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  intent?: IntentResult;
  searchContext?: string;
}

export class LunaChatService {
  constructor(private readonly provider: AIProvider) {}

  async respond(context: LunaConversationContext): Promise<AIResponse> {
    const {
      user,
      userMessage,
      relevantMemories,
      conversationSummary,
      recentHistory = [],
      intent,
      searchContext,
    } = context;

    const now = new Date();
    const timeString = now.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });
    const hour = parseInt(timeString.split(':')[0], 10);
    const greeting = hour >= 23 || hour < 5 ? 'Глибока ніч (час тиші)' : hour < 12 ? 'Ранок' : hour < 18 ? 'День' : 'Затишний вечір';

    const systemPrompt = assembleSystemPrompt({
      user,
      relevantMemories,
      conversationSummary,
      currentTimeString: timeString,
      timeOfDayGreeting: greeting,
      intent: intent?.intent,
      searchContext,
    });

    // Keep a long, useful window instead of only the last four messages. The
    // history service already bounds the total size before it reaches here.
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = recentHistory.slice(-24);
    messages.push({ role: 'user', content: userMessage });

    Logger.info(`Chat response generated for user ${user.id}`);

    return this.provider.generateResponse(messages, {
      systemInstruction: systemPrompt,
      temperature: 0.8,
      maxTokens: 800,
    });
  }
}
