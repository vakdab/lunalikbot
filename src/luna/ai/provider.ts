import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { AIProvider } from './types';
import { AppConfig } from '../../config/env';

export class AIProviderFactory {
  static create(config: AppConfig): AIProvider {
    switch (config.aiProvider) {
      case 'openai':
        return new OpenAIProvider(config.aiApiKey, config.aiModelName);
      case 'gemini':
      default:
        return new GeminiProvider(config.aiApiKey, config.aiModelName);
    }
  }
}
