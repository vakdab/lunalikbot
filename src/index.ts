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
import { LunaImageManager } from './media/images';
import { RouletteManager } from './roulette/manager';
import { CommandRouter } from './commands';
import { validateTelegramSecret } from './utils/validation';
import { Logger } from './utils/logger';
import { Messages } from './telegram/messages';
import { Keyboards } from './telegram/keyboards';
import { ProfileFormatter } from './luna/functionality/profile';

// Re-export Cloudflare Durable Object for Wrangler binding
export { RouletteHubDO } from './roulette/durableObject';

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Health check & diagnostic endpoint
    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          bot: 'Луна (Soul of Waifu + Mem0 AI Companion)',
          version: '1.2.0',
          runtime: 'Cloudflare Workers',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          status: 200,
        }
      );
    }

    // 2. Only allow POST requests on the webhook endpoint
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 3. Security validation: Verify Telegram Webhook Secret Token
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!validateTelegramSecret(secretHeader, env.TELEGRAM_WEBHOOK_SECRET)) {
      Logger.warn('Unauthorized webhook request rejected');
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const config = parseConfig(env);
      const appCtx: AppContext = { env, config, executionCtx };

      // Initialize decoupled dependencies
      const telegram = new TelegramApi(config.telegramToken);
      const d1Client = new D1Client(env.DB);
      const kvStorage = new KVStorage(env.LUNA_KV);
      const userRepo = new UserRepository(d1Client, kvStorage);
      const memory = new MemoryService(config.mem0ApiKey, kvStorage, env.MEM0_ORG_ID, env.MEM0_PROJECT_ID);
      const aiProvider = AIProviderFactory.create(config);
      const imageManager = new LunaImageManager(telegram, kvStorage, env.MEDIA_BUCKET, config.mediaBaseUrl);
      const roulette = new RouletteManager(telegram, env.ROULETTE_HUB);
      const commandRouter = new CommandRouter();
      const luna = new LunaCompanion(telegram, userRepo, memory, aiProvider, imageManager);

      const update: TelegramUpdate = await request.json();

      // 4. Handle Callback Queries (Inline Keyboard Buttons)
      if (update.callback_query) {
        const cq = update.callback_query;
        await telegram.answerCallbackQuery(cq.id);

        if (!cq.message) return new Response('OK', { status: 200 });

        const data = cq.data || '';
        const user = await userRepo.getOrCreate(cq.from);

        if (data === 'luna:chat_prompt') {
          await telegram.sendMessage(
            cq.message.chat.id,
            '🌙 <i>Я тебе слухаю! Про що хочеш поговорити? Напиши будь-яке повідомлення.</i>'
          );
        } else if (data === 'roulette:start') {
          await roulette.startSearch(cq.from.id, cq.message.chat.id);
        } else if (data === 'luna:profile') {
          const card = ProfileFormatter.formatProfileCard(user);
          await telegram.sendMessage(cq.message.chat.id, card, {
            reply_markup: Keyboards.profileMenu(),
          });
        } else if (data === 'luna:about') {
          await telegram.sendMessage(cq.message.chat.id, Messages.aboutLuna(), {
            reply_markup: Keyboards.mainMenu(),
          });
        } else if (data === 'luna:diary_view') {
          const entries = await luna.soulDiary.getRecentEntries(cq.from.id, 5);
          if (entries.length === 0) {
            await telegram.sendMessage(
              cq.message.chat.id,
              `📖 <b>Щоденник Луни (Soul Diary):</b>\n\n<i>Луна ще не встигла зробити записи про тебе. Поговори з нею тепліше! ✨</i>`,
              { reply_markup: Keyboards.profileMenu() }
            );
          } else {
            let text = `📖 <b>Таємні думки Луни про тебе (Soul of Waifu Diary):</b>\n\n`;
            entries.forEach((e) => {
              text += `<b>[${e.dateStr}]</b> <i>(${e.emotion})</i>:\n«${e.thought}»\n\n`;
            });
            text += `<i>💜 Ці думки виникають у Луни під час розмов з тобою.</i>`;
            await telegram.sendMessage(cq.message.chat.id, text, {
              reply_markup: Keyboards.profileMenu(),
            });
          }
        } else if (data === 'luna:memory_view') {
          const mems = await memory.retriever.getAllUserMemories(cq.from.id);
          if (mems.length === 0) {
            await telegram.sendMessage(
              cq.message.chat.id,
              `🧠 <b>Спогади Mem0:</b>\n\nВекторна пам'ять поки що порожня. Розкажи Луні про свої вподобання чи хобі! ✨`,
              { reply_markup: Keyboards.profileMenu() }
            );
          } else {
            let text = `🧠 <b>Що записано у Mem0 про тебе:</b>\n\n`;
            mems.slice(0, 10).forEach((m) => {
              text += `• <i>${m.memory}</i>\n`;
            });
            await telegram.sendMessage(cq.message.chat.id, text, {
              reply_markup: Keyboards.profileMenu(),
            });
          }
        } else if (data === 'luna:memory_clear') {
          await memory.saver.clearUserMemories(cq.from.id);
          await telegram.sendMessage(
            cq.message.chat.id,
            '🧹 <i>Усі спогади Mem0 було очищено. Ми починаємо знайомство з чистого аркуша! ✨</i>'
          );
        } else if (data === 'menu:main') {
          await telegram.sendMessage(cq.message.chat.id, Messages.welcome(user.firstName), {
            reply_markup: Keyboards.mainMenu(),
          });
        }

        return new Response('OK', { status: 200 });
      }

      // 5. Handle Incoming Messages
      const message = update.message;
      if (!message || !message.from) {
        return new Response('OK', { status: 200 });
      }

      // Rate limiting check
      const allowed = await kvStorage.checkRateLimit(message.from.id, config.rateLimitPerMinute);
      if (!allowed) {
        await telegram.sendMessage(
          message.chat.id,
          '⏳ <i>Занадто багато повідомлень! Зачекай кілька секунд перед наступним.</i>'
        );
        return new Response('OK', { status: 200 });
      }

      // 5A. Check if message is a Command (/start, /roulette, /diary, etc.)
      const isCommand = await commandRouter.handle({
        message,
        args: '',
        telegram,
        userRepo,
        roulette,
        memory,
        appCtx,
      });

      if (isCommand) {
        return new Response('OK', { status: 200 });
      }

      // 5B. Check if user is in an active Anonymous Roulette session
      const isRelayed = await roulette.handleIncomingMessage(message);
      if (isRelayed) {
        return new Response('OK', { status: 200 });
      }

      // 5C. Default to Luna AI Companion Conversation (Soul-of-Waifu + Mem0 pipeline)
      await luna.handleUserMessage(message, appCtx);

      return new Response('OK', { status: 200 });
    } catch (err) {
      Logger.error('Unhandled worker exception during update handling', err);
      return new Response('OK', { status: 200 });
    }
  },
};
