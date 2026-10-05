import { AIProviderError } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { LunaEmotion } from '../../media/types';
import { AIProvider, AIResponse, ChatMessage, GenerateOptions } from './types';

// Ліміти, щоб запит вкладався в TPM Groq (8000 токенів/хв на безкоштовному тарифі).
const MAX_COMPLETION_TOKENS_CAP = 600;
const MAX_HISTORY_MESSAGES = 12;
const MAX_RETRY_WAIT_MS = 20000;
const DEFAULT_RETRY_WAIT_MS = 5000;

export class OpenAIProvider implements AIProvider {
  public readonly providerName: string;
  public readonly modelName: string;

  constructor(
    protected readonly apiKey: string,
    modelName: string = 'gpt-4o-mini',
    private readonly baseUrl: string = 'https://api.openai.com/v1',
    providerName: string = 'openai'
  ) {
    this.modelName = modelName;
    this.providerName = providerName;
  }

  protected async getFallbackModels(): Promise<string[]> {
    return [];
  }

  private parseOutput(rawText: string): { cleanText: string; innerThought?: string; emotion: LunaEmotion } {
    let workingText = rawText;
    let innerThought: string | undefined;

    const thoughtMatch = workingText.match(/<thought>([\s\S]*?)<\/thought>/i);
    if (thoughtMatch) {
      innerThought = thoughtMatch[1].trim();
      workingText = workingText.replace(thoughtMatch[0], '').trim();
    } else {
      // maxTokens can truncate the response mid-thought, leaving an unclosed
      // <thought> tag. Treat everything from that point on as the (partial)
      // inner monologue instead of leaking raw tag text into the chat.
      const openThoughtIndex = workingText.search(/<thought>/i);
      if (openThoughtIndex !== -1) {
        innerThought = workingText.slice(openThoughtIndex + '<thought>'.length).trim();
        workingText = workingText.slice(0, openThoughtIndex).trim();
      }
    }

    const emotionMatch = workingText.match(/\[EMOTION:\s*(idle|happy|sad|angry|sleepy|love|confused|surprised)\s*\]/i);
    let emotion: LunaEmotion = 'idle';

    if (emotionMatch) {
      emotion = emotionMatch[1].toLowerCase() as LunaEmotion;
      workingText = workingText.replace(emotionMatch[0], '').trim();
    }

    return { cleanText: workingText, innerThought, emotion };
  }

  // Повертає затримку в мс перед повтором після 429 або null, якщо чекати занадто довго.
  private getRetryDelayMs(res: Response, bodyText: string): number | null {
    let seconds: number | null = null;

    const header = res.headers.get('retry-after');
    if (header && !Number.isNaN(parseFloat(header))) {
      seconds = parseFloat(header);
    } else {
      const match = bodyText.match(/try again in\s+([\d.]+)\s*s/i);
      if (match) seconds = parseFloat(match[1]);
    }

    const ms = seconds !== null ? Math.ceil(seconds * 1000) + 300 : DEFAULT_RETRY_WAIT_MS;
    return ms <= MAX_RETRY_WAIT_MS ? ms : null;
  }

  async generateResponse(messages: ChatMessage[], options?: GenerateOptions): Promise<AIResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const formattedMessages: any[] = [];

    if (options?.systemInstruction) {
      formattedMessages.push({
        role: 'system',
        content: options.systemInstruction,
      });
    }

    formattedMessages.push(...messages.slice(-MAX_HISTORY_MESSAGES));

    const maxTokens = Math.min(options?.maxTokens ?? MAX_COMPLETION_TOKENS_CAP, MAX_COMPLETION_TOKENS_CAP);

    try {
      const makeRequest = (model: string) => {
        const body: Record<string, unknown> = {
          model,
          messages: formattedMessages,
          temperature: options?.temperature ?? 0.8,
          max_tokens: maxTokens,
        };
        // gpt-oss міркує і витрачає на це токени; low економить квоту.
        if (model.includes('gpt-oss')) {
          body.reasoning_effort = 'low';
        }
        return fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      };
      let activeModel = this.modelName;
      let res = await makeRequest(activeModel);

      if (res.status === 403 || res.status === 404) {
        const fallbackModels = await this.getFallbackModels();
        for (const fallbackModel of fallbackModels) {
          if (fallbackModel === activeModel) continue;
          const fallbackResponse = await makeRequest(fallbackModel);
          if (fallbackResponse.ok) {
            activeModel = fallbackModel;
            res = fallbackResponse;
            break;
          }
        }
      }

      // Один повтор після короткої паузи, якщо впёрлися в rate limit.
      if (res.status === 429) {
        const bodyText = await res.clone().text();
        const waitMs = this.getRetryDelayMs(res, bodyText);
        if (waitMs !== null) {
          Logger.error(
            `AI API 429 for ${this.providerName}/${activeModel}, retry in ${waitMs}ms`,
            new Error(bodyText.slice(0, 240))
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          res = await makeRequest(activeModel);
        }
      }

      if (!res.ok) {
        const err = await res.text();
        Logger.error(`AI API error ${res.status} for ${this.providerName}/${activeModel}`, new Error(err));
        let detail = '';
        try {
          const parsed = JSON.parse(err);
          detail = String(parsed?.error?.message || parsed?.message || '').trim();
        } catch {
          detail = err.replace(/\s+/g, ' ').trim();
        }
        const safeDetail = detail.slice(0, 240);
        throw new AIProviderError(`${this.providerName} API error status ${res.status} for model ${activeModel}${safeDetail ? `: ${safeDetail}` : ''}`);
      }

      const data: any = await res.json();
      const rawText = data?.choices?.[0]?.message?.content || '';
      const { cleanText, innerThought, emotion } = this.parseOutput(rawText);

      return {
        text: rawText,
        cleanText,
        innerThought,
        detectedEmotion: emotion,
        usage: {
          promptTokens: data?.usage?.prompt_tokens,
          completionTokens: data?.usage?.completion_tokens,
        },
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(`${this.providerName} provider error: ${String(err)}`);
    }
  }
}
