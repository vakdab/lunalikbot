import { AIProviderError } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { LunaEmotion } from '../../media/types';
import { AIProvider, AIResponse, ChatMessage, GenerateOptions } from './types';

export class OpenAIProvider implements AIProvider {
  public readonly providerName: string = 'openai';
  public readonly modelName: string;

  constructor(
    private readonly apiKey: string,
    modelName: string = 'gpt-4o-mini',
    private readonly baseUrl: string = 'https://api.openai.com/v1'
  ) {
    this.modelName = modelName;
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

  async generateResponse(messages: ChatMessage[], options?: GenerateOptions): Promise<AIResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const formattedMessages: any[] = [];

    if (options?.systemInstruction) {
      formattedMessages.push({
        role: 'system',
        content: options.systemInstruction,
      });
    }

    formattedMessages.push(...messages);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: formattedMessages,
          temperature: options?.temperature ?? 0.8,
          max_tokens: options?.maxTokens ?? 900,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        Logger.error(`OpenAI API error ${res.status}`, new Error(err));
        throw new AIProviderError(`OpenAI API error status ${res.status}`);
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
      throw new AIProviderError(`OpenAI provider error: ${String(err)}`);
    }
  }
}
