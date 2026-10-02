import { AppContext } from '../../types';
import { TelegramMessage } from '../../telegram/types';
import { TelegramApi } from '../../telegram/api';
import { UserRepository } from '../../database/users';
import { MemoryService } from '../memory';
import { AIProvider } from '../ai/types';
import { LunaChatService } from '../ai/chat';
import { Logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { escapeHtml } from '../../utils/html';
import { ConversationHistory } from '../history';
import { LunaToolService } from '../tools';
import { IntentRouter } from '../router';
import { SerpApiSearchService } from '../search';
import { LunaStateService } from '../state';

export class LunaCompanion {
  private readonly chatService: LunaChatService;
  private readonly router = new IntentRouter();

  constructor(
    private readonly telegram: TelegramApi,
    private readonly userRepo: UserRepository,
    private readonly memory: MemoryService,
    private readonly history: ConversationHistory,
    private readonly state: LunaStateService,
    private readonly tools: LunaToolService,
    private readonly search: SerpApiSearchService,
    private readonly aiProvider: AIProvider
  ) {
    this.chatService = new LunaChatService(this.aiProvider);
  }

  async handlePhotoMessage(message: TelegramMessage, ctx: AppContext): Promise<void> {
    const from = message.from;
    const largestPhoto = message.photo?.[message.photo.length - 1];
    if (!from || !largestPhoto) return;

    const user = await this.userRepo.getOrCreate(from);
    const userText = message.caption?.trim() || '[Користувач надіслав фото]';
    await this.telegram.sendChatAction(message.chat.id, 'upload_photo');

    try {
      const result = await this.tools.analyzeTelegramPhoto(largestPhoto.file_id, message.caption);
      const replyText = result.text.trim() || 'Я не змогла розібрати це фото.';
      await this.telegram.sendMessage(message.chat.id, escapeHtml(replyText));
      ctx.executionCtx.waitUntil(Promise.all([
        this.memory.saveExchange(user.id, userText, replyText).catch(err => Logger.error('Photo memory save failed', err)),
        this.history.append(message.chat.id, from.id, userText, replyText).catch(err => Logger.error('Photo conversation history save failed', err)),
        this.state.recordTurn(user.id, userText, 'idle').catch(err => Logger.error('Photo state update failed', err)),
      ]));
    } catch (err) {
      Logger.error('Photo analysis failed', err);
      const detail = err instanceof AppError ? `\n\nДеталі: ${escapeHtml(err.message.slice(0, 300))}` : '';
      await this.telegram.sendMessage(
        message.chat.id,
        `Я поки не можу проаналізувати фото. Перевір, чи підключений Vision-сервіс, або надішли текстом, що саме потрібно зробити.${detail}`
      );
    }
  }

  async handleUserMessage(message: TelegramMessage, ctx: AppContext): Promise<void> {
    const from = message.from;
    if (!from || !message.text) return;

    const user = await this.userRepo.getOrCreate(from);
    const [conversation, localMemories, remoteMemories, profile] = await Promise.all([
      this.history.getContext(message.chat.id, from.id),
      this.state.getRelevantMemories(user.id, message.text, 8),
      this.memory.getRelevantMemories(user.id, message.text, 8).catch(err => {
        Logger.warn(`Memory retrieval failed for user ${user.id}`, { err });
        return [] as string[];
      }),
      this.state.get(user.id),
    ]);
    await this.telegram.sendChatAction(message.chat.id, 'typing');

    const relevantMemories = [
      ...localMemories.map((memory) => memory.content),
      ...remoteMemories,
    ].filter((memory, index, all) => all.indexOf(memory) === index).slice(0, 10);

    try {
      const intent = this.router.detectText(message.text);
      let searchContext: string | undefined;
      if (intent.intent === 'WEB_SEARCH' && this.search.isConfigured) {
        await this.telegram.sendChatAction(message.chat.id, 'typing');
        const results = await this.search.search(message.text, 5);
        searchContext = results.length
          ? results.map((result, index) => `${index + 1}. ${result.title}\nURL: ${result.link}\n${result.snippet || ''}`).join('\n\n')
          : 'Пошук не повернув результатів.';
      } else if (intent.intent === 'WEB_SEARCH') {
        searchContext = 'SerpAPI не налаштований. Не вигадуй результати пошуку і чесно повідом про це.';
      }

      const response = await this.chatService.respond({
        user,
        userMessage: message.text,
        relevantMemories,
        conversationSummary: conversation.summary,
        emotionalState: profile.emotional,
        personalityState: profile.personality,
        recentHistory: conversation.turns,
        intent,
        searchContext,
      });

      const replyText = response.cleanText.trim() || 'Хвилинку… не знайшла слів, але я тут з тобою.';
      await this.telegram.sendMessage(message.chat.id, escapeHtml(replyText));

      const memorySignal = /(мене звати|моє ім'я|люблю|подобається|не люблю|мій проєкт|мій проект|працюю над|хочу|планую|моя ціль|зазвичай|називай мене|звертайся до мене)/i.test(message.text);
      const periodicMemoryCheckpoint = profile.personality.interactionCount > 0 && profile.personality.interactionCount % 5 === 0;
      ctx.executionCtx.waitUntil(Promise.all([
        // Mem0 remains the semantic long-term store. It is called for explicit
        // memory signals or periodic checkpoints, not for every chat message.
        ...(memorySignal || periodicMemoryCheckpoint
          ? [this.memory.saveExchange(user.id, message.text, replyText).catch(err => Logger.error('Automatic memory save failed', err))]
          : []),
        this.history.append(message.chat.id, from.id, message.text, replyText).catch(err => Logger.error('Conversation history save failed', err)),
        this.state.recordTurn(user.id, message.text, response.detectedEmotion).catch(err => Logger.error('State update failed', err)),
      ]));
    } catch (err) {
      Logger.error('Chat response failed', err);
      const diagnostic = err instanceof AppError ? `\n\nДеталі: ${escapeHtml(err.message.slice(0, 300))}` : '';
      await this.telegram.sendMessage(
        message.chat.id,
        `Я не змогла відповісти зараз. Напиши ще раз трохи пізніше.${diagnostic}`
      );
    }
  }
}
