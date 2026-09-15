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
import { parseReminderRequest, ReminderService } from './luna/reminders';
import { GroupService } from './luna/groups';
import { escapeHtml } from './utils/html';
import { ConversationHistory } from './luna/history';
import { LunaToolService } from './luna/tools';
import { SerpApiSearchService } from './luna/search';
import { getRolivWeather, isWeatherRequest } from './weather';

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
      return Response.json({ status: 'ok', bot: 'Lunalik', mode: 'chat + automatic memory + proactive follow-ups + natural reminders' });
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
      const reminders = new ReminderService(kvStorage, telegram);
      const groups = new GroupService(telegram);
      const userRepo = new UserRepository(new D1Client(env.DB), kvStorage);
      const memory = new MemoryService(config.mem0ApiKey, kvStorage, env.MEM0_ORG_ID, env.MEM0_PROJECT_ID);
      const history = new ConversationHistory(kvStorage);
      const tools = new LunaToolService(telegram, {
        url: config.toolsUrl,
        secret: config.toolsSecret,
        visionApiKey: config.visionApiKey,
        visionModel: config.visionModelName,
      });
      const search = new SerpApiSearchService({
        apiKey: config.searchApiKey,
        location: config.searchLocation,
        language: config.searchLanguage,
        country: config.searchCountry,
        googleDomain: config.searchGoogleDomain,
      });
      const aiProvider = AIProviderFactory.create(config);
      const luna = new LunaCompanion(telegram, userRepo, memory, history, tools, search, aiProvider);
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

      // Weather is a deterministic public command and should not spend an AI request.
      if (message.chat.type === 'private' && message.text && isWeatherRequest(message.text)) {
        try {
          await telegram.sendChatAction(message.chat.id, 'typing');
          await telegram.sendMessage(message.chat.id, await getRolivWeather());
        } catch (err) {
          Logger.error('Weather request failed', err);
          await telegram.sendMessage(
            message.chat.id,
            'Не можу зараз отримати актуальну погоду. Спробуй, будь ласка, ще раз за хвилину.'
          );
        }
        return new Response('OK');
      }

      // Natural-language reminders work without commands: «нагадай завтра о 6:00 ...».
      if (message.chat.type === 'private' && message.text) {
        const reminderRequest = parseReminderRequest(message.text);
        if (reminderRequest) {
          if (!kvStorage.isAvailable) {
            await telegram.sendMessage(message.chat.id, 'Я зможу нагадати, щойно для мене буде підключено сховище нагадувань.');
            return new Response('OK');
          }
          const reminder = await reminders.create(
            message.from.id,
            message.chat.id,
            reminderRequest.text,
            reminderRequest.dueAt
          );
          const due = new Intl.DateTimeFormat('uk-UA', {
            timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit',
          }).format(new Date(reminder.dueAt));
          await telegram.sendMessage(message.chat.id, `Добре, нагадаю ${due}: ${escapeHtml(reminder.text)}`);
          return new Response('OK');
        }

        // Never let the AI pretend it scheduled something when the parser did
        // not understand the wording. Ask for a supported natural format.
        if (/^нагадай(?:\s+мені)?\b/i.test(message.text.trim())) {
          await telegram.sendMessage(
            message.chat.id,
            'Я хочу точно зберегти це нагадування. Напиши, наприклад: «нагадай мені завтра о 8:00 помити підлогу» або «нагадай мені в 18:30 зателефонувати». '
          );
          return new Response('OK');
        }
      }

      const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

      // Group mode: silent spam moderation + replies when addressed.
      if (isGroup) {
        const removed = await groups.moderate(message);
        if (!removed && message.text) {
          const addressed = await groups.isAddressedToBot(message);
          if (addressed) {
            const cleanText = groups.stripMention(message.text);
            if (cleanText.length > 0) {
              if (isWeatherRequest(cleanText)) {
                try {
                  await telegram.sendChatAction(message.chat.id, 'typing');
                  await telegram.sendMessage(message.chat.id, await getRolivWeather());
                } catch (err) {
                  Logger.error('Group weather request failed', err);
                  await telegram.sendMessage(
                    message.chat.id,
                    'Не можу зараз отримати актуальну погоду. Спробуйте, будь ласка, ще раз за хвилину.'
                  );
                }
              } else {
                message.text = cleanText;
                const appCtx: AppContext = { env, config, executionCtx };
                await luna.handleUserMessage(message, appCtx);
              }
            }
          }
        }
        return new Response('OK');
      }

      // The bot has one purpose: conversation. /start is just a clean greeting;
      // every other text message goes through the same chat + memory pipeline.
      if (/^\/start(?:@\w+)?$/i.test(message.text?.trim() || '')) {
        await telegram.sendPhoto(
          message.chat.id,
          LUNA_WELCOME_IMAGE_URL,
          { caption: LUNA_WELCOME_CAPTION, parse_mode: 'HTML' }
        );
      } else if (message.photo?.length) {
        const appCtx: AppContext = { env, config, executionCtx };
        await luna.handlePhotoMessage(message, appCtx);
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
      const kvStorage = new KVStorage(env.LUNA_KV);
      const proactive = new ProactiveService(kvStorage, telegram);
      const reminders = new ReminderService(kvStorage, telegram);
      const groups = new GroupService(telegram);
      executionCtx.waitUntil(Promise.all([
        proactive.sendDueFollowUps(),
        reminders.sendDueReminders(),
      ]).then(([followUps, dueReminders]) =>
        Logger.info(`Scheduled scan completed: ${followUps} follow-up(s), ${dueReminders} reminder(s) sent`)
      ));
    } catch (err) {
      Logger.error('Scheduled proactive follow-up failed', err);
    }
  },
};
