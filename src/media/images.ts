import { KVStorage } from '../database/kv';
import { TelegramApi } from '../telegram/api';
import { Logger } from '../utils/logger';
import { LunaEmotion } from './types';

export class LunaImageManager {
  private static readonly DEFAULT_BASE_URL = 'https://raw.githubusercontent.com/vakdab/lunalikbot/main/assets/images';

  constructor(
    private readonly telegram: TelegramApi,
    private readonly kv: KVStorage,
    private readonly r2Bucket?: R2Bucket,
    private readonly baseUrl: string = LunaImageManager.DEFAULT_BASE_URL
  ) {}

  getImageUrlForEmotion(emotion: LunaEmotion): string {
    return `${this.baseUrl}/luna_${emotion}.png`;
  }

  async sendLunaEmotionImage(
    chatId: number | string,
    emotion: LunaEmotion,
    caption?: string
  ): Promise<boolean> {
    const cacheKey = `media_file_id:luna_${emotion}`;

    // 1. Try to use Telegram cached file_id for ultra-fast instant delivery (<50ms)
    const cachedFileId = await this.kv.get<string>(cacheKey);
    const photoSource = cachedFileId || this.getImageUrlForEmotion(emotion);

    try {
      const sentMsg = await this.telegram.sendPhoto(chatId, photoSource, {
        caption,
        parse_mode: 'HTML',
      });

      // If we used a URL and got a file_id back from Telegram, cache it forever in KV
      if (!cachedFileId && sentMsg.photo && sentMsg.photo.length > 0) {
        const bestPhoto = sentMsg.photo[sentMsg.photo.length - 1];
        await this.kv.set(cacheKey, bestPhoto.file_id);
        Logger.info(`Cached Telegram file_id for emotion ${emotion}: ${bestPhoto.file_id}`);
      }

      return true;
    } catch (err) {
      Logger.error(`Failed to send Luna emotion image (${emotion})`, err, { chatId, emotion });
      return false;
    }
  }
}
