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

export class LunaCompanion {
  private readonly chatService: LunaChatService;

  constructor(
    private readonly telegram: TelegramApi,
    private readonly userRepo: UserRepository,
    private readonly memory: MemoryService,
    private readonly aiProvider: AIProvider
  ) {
    this.chatService = new LunaChatService(this.aiProvider);
  }

  async handleUserMessage(message: TelegramMessage, ctx: AppContext): Promise<void> {
    const from = message.from;
    if (!from || !message.text) return;

    const user = await this.userRepo.getOrCreate(from);
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
      });

      const replyText = response.cleanText.trim() || 'Хвилинку… не знайшла слів, але я тут з тобою.';
      await this.telegram.sendMessage(message.chat.id, escapeHtml(replyText));

      // Memory is automatic and never blocks the reply.
      ctx.executionCtx.waitUntil(
        this.memory.saveExchange(user.id, message.text, replyText).catch(err =>
          Logger.error('Automatic memory save failed', err)
        )
      );
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
