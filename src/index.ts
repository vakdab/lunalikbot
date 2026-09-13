import { Env, parseConfig } from './config/env';
import { AppContext } from './types';
import { TelegramApi } from './telegram/api';
import { TelegramUpdate } from './telegram/types';
import { D1Client } from './database/d1';
import { KVStorage } from './database/kv';
import { UserRepository } from './database/users';
import { MemoryService } from './luna/memory';
import { AIProviderFactory } from './luna/ai/provider';
import { LunaCompanion } from './luna/functionality';
import { validateTelegramSecret } from './utils/validation';
import { Logger } from './utils/logger';

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return Response.json({ status: 'ok', bot: 'Lunalik', mode: 'chat + automatic memory' });
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!validateTelegramSecret(secretHeader, env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const config = parseConfig(env);
      const telegram = new TelegramApi(config.telegramToken);
      const kvStorage = new KVStorage(env.LUNA_KV);
      const userRepo = new UserRepository(new D1Client(env.DB), kvStorage);
      const memory = new MemoryService(config.mem0ApiKey, kvStorage, env.MEM0_ORG_ID, env.MEM0_PROJECT_ID);
      const aiProvider = AIProviderFactory.create(config);
      const luna = new LunaCompanion(telegram, userRepo, memory, aiProvider);
      const update: TelegramUpdate = await request.json();
      const message = update.message;

      if (!message?.from) return new Response('OK');
      if (!(await kvStorage.checkRateLimit(message.from.id, config.rateLimitPerMinute))) {
        await telegram.sendMessage(message.chat.id, 'Будь ласка, зачекай кілька секунд і напиши ще раз.');
        return new Response('OK');
      }

      // The bot has one purpose: conversation. /start is just a clean greeting;
      // every other text message goes through the same chat + memory pipeline.
      if (message.text?.trim() === '/start') {
        await telegram.sendMessage(
          message.chat.id,
          `Привіт, ${message.from.first_name || 'друже'}! Я Луна. Просто напиши мені щось — я відповім і поступово запам’ятаю важливе про тебе.`
        );
      } else if (message.text) {
        const appCtx: AppContext = { env, config, executionCtx };
        await luna.handleUserMessage(message, appCtx);
      }

      return new Response('OK');
    } catch (err) {
      Logger.error('Unhandled chat update error', err);
      return new Response('OK');
    }
  },
};
