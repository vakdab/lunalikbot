import { OpenAIProvider } from './openai';

/**
 * Groq exposes an OpenAI-compatible Chat Completions API.
 * Keeping this as a small specialization preserves the existing response
 * parsing and emotion handling used by the bot.
 */
export class GroqProvider extends OpenAIProvider {
  public override readonly providerName = 'groq';

  constructor(apiKey: string, modelName: string = 'llama-3.1-8b-instant') {
    super(apiKey, modelName, 'https://api.groq.com/openai/v1');
  }

  protected override async getFallbackModels(): Promise<string[]> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return [];
      const data = await response.json() as { data?: Array<{ id?: string }> };
      const available = (data.data || [])
        .map((model) => model.id)
        .filter((model): model is string => Boolean(model))
        .filter((model) => !/(whisper|guard|tts|speech|safeguard)/i.test(model));
      const preferred = [
        'openai/gpt-oss-20b',
        'openai/gpt-oss-120b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
      ];
      return [...preferred.filter((model) => available.includes(model)), ...available.filter((model) => !preferred.includes(model))];
    } catch {
      return [];
    }
  }
}
