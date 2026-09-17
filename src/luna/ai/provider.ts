import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { GroqProvider } from './groq';
import { AIProvider } from './types';
import { AppConfig } from '../../config/env';

export class AIProviderFactory {
  static create(config: AppConfig): AIProvider {
    switch (config.aiProvider) {
      case 'puter':
        return new OpenAIProvider(
          config.aiApiKey,
          config.aiModelName,
          'https://api.puter.com/puterai/openai/v1',
          'puter'
        );
      case 'openai':
        return new OpenAIProvider(config.aiApiKey, config.aiModelName);
      case 'groq':
        return new GroqProvider(config.aiApiKey, config.aiModelName);
      case 'gemini':
      default:
        return new GeminiProvider(config.aiApiKey, config.aiModelName);
    }
  }
}
