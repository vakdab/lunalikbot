import { AppContext } from '../../types';
import { TelegramMessage } from '../../telegram/types';
import { TelegramApi } from '../../telegram/api';
import { UserRepository } from '../../database/users';
import { MemoryService } from '../memory';
import { AIProvider } from '../ai/types';
import { LunaChatService } from '../ai/chat';
import { EmotionEngine } from './emotions';
import { LunaVisuals } from './images';
import { LunaImageManager } from '../../media/images';
import { SoulIntimacyEngine, LunaSoulDiary } from '../soul';
import { ReactionEngine } from './reactions';
import { Logger } from '../../utils/logger';

export * from './types';
export * from './emotions';
export * from './reactions';
export * from './profile';
export * from './images';

export class LunaCompanion {
  private readonly chatService: LunaChatService;
  private readonly emotions: EmotionEngine;
  private readonly visuals: LunaVisuals;
  public readonly soulIntimacy: SoulIntimacyEngine;
  public readonly soulDiary: LunaSoulDiary;

  constructor(
    private readonly telegram: TelegramApi,
    private readonly userRepo: UserRepository,
    private readonly memory: MemoryService,
    private readonly aiProvider: AIProvider,
    private readonly imageManager: LunaImageManager
  ) {
    this.chatService = new LunaChatService(this.aiProvider);
    this.emotions = new EmotionEngine();
    this.visuals = new LunaVisuals(this.imageManager);
    this.soulIntimacy = new SoulIntimacyEngine();
    this.soulDiary = new LunaSoulDiary();
  }

  async handleUserMessage(message: TelegramMessage, ctx: AppContext): Promise<void> {
    const from = message.from;
    if (!from || !message.text) return;

    const user = await this.userRepo.getOrCreate(from);
    const soulState = await this.soulIntimacy.getSoulState(user.id);

    // Send typing status
    await this.telegram.sendChatAction(message.chat.id, 'typing');

    // 1. Semantic Memory Search via Mem0
    let relevantMemories: string[] = [];
    try {
      relevantMemories = await this.memory.getRelevantMemories(user.id, message.text, 4);
    } catch (err) {
      Logger.warn(`Mem0 retrieval error for user ${user.id}`, { err });
    }

    // 2. Generate Soul-of-Waifu response
    let aiResponse;
    try {
      aiResponse = await this.chatService.respond({
        user,
        soulState,
        userMessage: message.text,
        relevantMemories,
      });
    } catch (err) {
      Logger.error('Soul-of-Waifu generation failed', err);
      await this.telegram.sendMessage(
        message.chat.id,
        '🌙 <i>Луна замріяно дивиться на зорі й не почула тебе... Напиши ще раз, будь ласка!</i>'
      );
      return;
    }

    // 3. Update emotion
    await this.emotions.setEmotion(user.id, aiResponse.detectedEmotion);

    // 4. Send response to user (with photo if special emotion or high intimacy)
    const shouldSendPhoto =
      ['love', 'sleepy', 'surprised'].includes(aiResponse.detectedEmotion) ||
      (soulState.intimacyTier >= 4 && Math.random() < 0.35);

    if (shouldSendPhoto) {
      await this.visuals.showEmotion(message.chat.id, aiResponse.detectedEmotion, aiResponse.cleanText);
    } else {
      await this.telegram.sendMessage(message.chat.id, aiResponse.cleanText);
    }

    // 5. Background operations (Soul Diary, Mem0 extraction, Affection update)
    ctx.executionCtx.waitUntil(
      (async () => {
        try {
          // A. Save inner thoughts to Luna's Secret Diary
          if (aiResponse.innerThought) {
            await this.soulDiary.addEntry(
              user.id,
              aiResponse.innerThought,
              aiResponse.detectedEmotion,
              soulState.intimacyTier
            );
          }

          // B. Add dialogue facts to Mem0
          await this.memory.saveExchange(user.id, message.text!, aiResponse.cleanText);

          // C. Add Affection Points
          const { tierUp, state: newState } = await this.soulIntimacy.addAffection(user.id, 2);
          await this.userRepo.addRelationshipPoints(user.id, 2);

          // If intimacy tier upgraded, send warm congratulation
          if (tierUp) {
            await this.telegram.sendMessage(
              message.chat.id,
              `✨ <b>Наш зв'язок став міцнішим!</b>\n` +
              `Тепер наш рівень довіри: <b>Рівень ${newState.intimacyTier}</b> 💜\n` +
              `<i>Дякую, що ти поруч зі мною...</i>`
            );
          }
        } catch (bgErr) {
          Logger.error('Background Soul & Mem0 update error', bgErr);
        }
      })()
    );
  }
}
