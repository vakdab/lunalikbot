import { AIProviderError } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { LunaEmotion } from '../../media/types';
import { AIProvider, AIResponse, ChatMessage, GenerateOptions } from './types';

export class GeminiProvider implements AIProvider {
  public readonly providerName = 'gemini';
  public readonly modelName: string;
  private resolvedModelName?: string;

  constructor(
    private readonly apiKey: string,
    modelName: string = 'gemini-2.5-flash'
  ) {
    this.modelName = modelName;
  }

  private async findAvailableModel(): Promise<string | undefined> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return undefined;

    const data = await response.json() as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const available = (data.models || [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => model.name?.replace(/^models\//, ''))
      .filter((model): model is string => Boolean(model))
      .filter((model) => model.startsWith('gemini-'));

    const preferred = [
      this.modelName,
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];
    return preferred.find((model) => available.includes(model)) || available[0];
  }

  private parseOutput(rawText: string): {
    cleanText: string;
    innerThought?: string;
    emotion: LunaEmotion;
  } {
    let workingText = rawText;
    let innerThought: string | undefined;

    // 1. Extract <thought>...</thought> (Soul-of-Waifu inner monologue)
    const thoughtMatch = workingText.match(/<thought>([\s\S]*?)<\/thought>/i);
    if (thoughtMatch) {
      innerThought = thoughtMatch[1].trim();
      workingText = workingText.replace(thoughtMatch[0], '').trim();
    }

    // 2. Extract [EMOTION:...]
    const emotionMatch = workingText.match(/\[EMOTION:\s*(idle|happy|sad|angry|sleepy|love|confused|surprised)\s*\]/i);
    let emotion: LunaEmotion = 'idle';

    if (emotionMatch) {
      emotion = emotionMatch[1].toLowerCase() as LunaEmotion;
      workingText = workingText.replace(emotionMatch[0], '').trim();
    } else {
      const lower = workingText.toLowerCase();
      if (lower.includes('дякую') || lower.includes('рада') || lower.includes('чудово') || lower.includes('✨')) {
        emotion = 'happy';
      } else if (lower.includes('сумн') || lower.includes('шкода') || lower.includes('жаль')) {
        emotion = 'sad';
      } else if (lower.includes('люблю') || lower.includes('серденько') || lower.includes('💜') || lower.includes('обійма')) {
        emotion = 'love';
      } else if (lower.includes('спати') || lower.includes('ніч') || lower.includes('втомил')) {
        emotion = 'sleepy';
      }
    }

    return {
      cleanText: workingText,
      innerThought,
      emotion,
    };
  }

  async generateResponse(messages: ChatMessage[], options?: GenerateOptions): Promise<AIResponse> {
    if (!this.apiKey) {
      return {
        text: '🌙 <i>Привіт! Я Луна. Щоб активувати мій інтелект та памʼять, додайте будь ласка <b>AI_API_KEY</b> у налаштуваннях Cloudflare Secrets (Settings ➔ Variables and Secrets).</i> [EMOTION:idle]',
        cleanText: '🌙 Привіт! Я Луна. Щоб активувати мій інтелект та памʼять, додайте будь ласка <b>AI_API_KEY</b> у налаштуваннях Cloudflare Secrets (Settings ➔ Variables and Secrets).',
        detectedEmotion: 'idle',
      };
    }

    const contents: any[] = [];

    const systemInstruction = options?.systemInstruction
      ? { parts: [{ text: options.systemInstruction }] }
      : undefined;

    for (const msg of messages) {
      if (msg.role === 'system') continue;
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const payload: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.8,
        maxOutputTokens: options?.maxTokens ?? 900,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    const startTime = Date.now();
    try {
      const model = this.resolvedModelName || this.modelName;
      const makeRequest = (modelName: string) => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        }
      );
      let res = await makeRequest(model);

      if (res.status === 404 && !this.resolvedModelName) {
        const availableModel = await this.findAvailableModel();
        if (availableModel && availableModel !== model) {
          this.resolvedModelName = availableModel;
          res = await makeRequest(availableModel);
        }
      }

      if (!res.ok) {
        const errText = await res.text();
        Logger.error(
          `Gemini API error (status ${res.status}, model ${this.resolvedModelName || this.modelName}, endpoint v1beta)`,
          new Error(errText)
        );
        throw new AIProviderError(`Gemini API returned status ${res.status} for model ${this.resolvedModelName || this.modelName}`);
      }

      const data: any = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!rawText) {
        throw new AIProviderError('Empty text received from Gemini');
      }

      const { cleanText, innerThought, emotion } = this.parseOutput(rawText);

      Logger.info(`Gemini response generated in ${Date.now() - startTime}ms [Emotion: ${emotion}, Thought: ${!!innerThought}]`);

      return {
        text: rawText,
        cleanText,
        innerThought,
        detectedEmotion: emotion,
        usage: {
          promptTokens: data?.usageMetadata?.promptTokenCount,
          completionTokens: data?.usageMetadata?.candidatesTokenCount,
        },
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      Logger.error('Gemini API fetch error', err);
      throw new AIProviderError(`Failed to call Gemini API: ${String(err)}`);
    }
  }
}
