import { OpenAIProvider } from './openai';

/**
 * Groq exposes an OpenAI-compatible Chat Completions API.
 * Keeping this as a small specialization preserves the existing response
 * parsing and emotion handling used by the bot.
 */
export class GroqProvider extends OpenAIProvider {
  public override readonly providerName = 'groq';

  constructor(apiKey: string, modelName: string = 'openai/gpt-oss-120b') {
    super(apiKey, modelName, 'https://api.groq.com/openai/v1');
  }
}
