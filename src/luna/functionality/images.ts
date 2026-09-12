import { LunaImageManager } from '../../media/images';
import { LunaEmotion } from '../../media/types';

export class LunaVisuals {
  constructor(private readonly imageManager: LunaImageManager) {}

  async showEmotion(chatId: number | string, emotion: LunaEmotion, text?: string): Promise<boolean> {
    return this.imageManager.sendLunaEmotionImage(chatId, emotion, text);
  }
}
