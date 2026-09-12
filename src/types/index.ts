import { AppConfig, Env } from '../config/env';

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface AppContext {
  env: Env;
  config: AppConfig;
  executionCtx: ExecutionContext;
}

export interface UserContext {
  userId: number;
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

export type HandlerResult = {
  handled: boolean;
  response?: string;
};
