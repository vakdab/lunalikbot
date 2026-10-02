import { assembleSystemPrompt } from '../prompt/system';
import { UserProfile } from '../../database/types';
import { AIProvider, AIResponse } from './types';
import { Logger } from '../../utils/logger';
import { IntentResult } from '../router';
import { EmotionalState, PersonalityState } from '../state';

export interface LunaConversationContext {
  user: UserProfile;
  userMessage: string;
  relevantMemories?: string[];
  conversationSummary?: string;
  emotionalState?: EmotionalState;
  personalityState?: PersonalityState;
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
      emotionalState,
      personalityState,
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
      emotionalState,
      personalityState,
      currentTimeString: timeString,
      timeOfDayGreeting: greeting,
      intent: intent?.intent,
      searchContext,
    });

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
