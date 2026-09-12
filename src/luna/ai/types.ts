import { LunaEmotion } from '../../media/types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

export interface AIResponse {
  text: string;
  cleanText: string;
  innerThought?: string;
  detectedEmotion: LunaEmotion;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;
  generateResponse(messages: ChatMessage[], options?: GenerateOptions): Promise<AIResponse>;
}
