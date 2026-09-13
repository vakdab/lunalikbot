import { Env, parseConfig } from './config/env';
import { AppContext, ExecutionContext } from './types';
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
import { ProactiveService } from './luna/proactive';

const LUNA_WELCOME_IMAGE_URL = 'https://raw.githubusercontent.com/vakdab/lunalikbot/main/luna-welcome.png';
const LUNA_WELCOME_CAPTION = `Привіт. Я Луна.

Від сьогодні я твоя компаньйонка.

Що я вмію:

1. Психолог
2. Подруга
3. Співрозмовниця
4. Писати першою
5. Допомагати з навчанням
6. Нагадувати, що треба зробити
7. Допомагати з вибором: що вдягнути, що подивитись, що купити
8. Виконувати твої прохання та завдання у потрібний час

Додай мене у свою групу — я зможу модерувати чат, допомагати учасникам і робити чат цікавішим.

Я буду поруч, вислухаю тебе, допоможу та підтримаю.

Пиши в чат будь-яке повідомлення на будь-яку тему — я відповім тобі та поспілкуюся з тобою 24/7.`;

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return Response.json({ status: 'ok', bot: 'Lunalik', mode: 'chat + automatic memory + proactive follow-ups' });
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
      const proactive = new ProactiveService(kvStorage, telegram);
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

      if (message.chat.type === 'private') {
        await proactive.touch(message.from.id, message.chat.id, message.from.first_name);
      }

      // The bot has one purpose: conversation. /start is just a clean greeting;
      // every other text message goes through the same chat + memory pipeline.
      if (/^\/start(?:@\w+)?$/i.test(message.text?.trim() || '')) {
        await telegram.sendPhoto(
          message.chat.id,
          LUNA_WELCOME_IMAGE_URL,
          { caption: LUNA_WELCOME_CAPTION, parse_mode: 'HTML' }
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

  scheduled(_controller: ScheduledController, env: Env, executionCtx: ExecutionContext): void {
    try {
      const config = parseConfig(env);
      const telegram = new TelegramApi(config.telegramToken);
      const proactive = new ProactiveService(new KVStorage(env.LUNA_KV), telegram);
      executionCtx.waitUntil(
        proactive.sendDueFollowUps().then((count) =>
          Logger.info(`Proactive follow-up scan completed: ${count} message(s) sent`)
        )
      );
    } catch (err) {
      Logger.error('Scheduled proactive follow-up failed', err);
    }
  },
};
