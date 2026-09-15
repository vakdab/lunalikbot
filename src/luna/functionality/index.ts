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

export class LunaCompanion {
  private readonly chatService: LunaChatService;

  constructor(
    private readonly telegram: TelegramApi,
    private readonly userRepo: UserRepository,
    private readonly memory: MemoryService,
    private readonly history: ConversationHistory,
    private readonly tools: LunaToolService,
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
        this.memory.saveExchange(user.id, userText, replyText).catch(err =>
          Logger.error('Photo memory save failed', err)
        ),
        this.history.append(message.chat.id, from.id, userText, replyText).catch(err =>
          Logger.error('Photo conversation history save failed', err)
        ),
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
    const recentHistory = await this.history.get(message.chat.id, from.id);
    await this.telegram.sendChatAction(message.chat.id, 'typing');

    let relevantMemories: string[] = [];
    try {
      relevantMemories = await this.memory.getRelevantMemories(user.id, message.text, 6);
    } catch (err) {
      Logger.warn(`Memory retrieval failed for user ${user.id}`, { err });
    }

    try {
      const response = await this.chatService.respond({
        user,
        userMessage: message.text,
        relevantMemories,
        recentHistory,
      });

      const replyText = response.cleanText.trim() || 'Хвилинку… не знайшла слів, але я тут з тобою.';
      await this.telegram.sendMessage(message.chat.id, escapeHtml(replyText));

      // Memory is automatic and never blocks the reply.
      ctx.executionCtx.waitUntil(Promise.all([
        this.memory.saveExchange(user.id, message.text, replyText).catch(err =>
          Logger.error('Automatic memory save failed', err)
        ),
        this.history.append(message.chat.id, from.id, message.text, replyText).catch(err =>
          Logger.error('Conversation history save failed', err)
        ),
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
