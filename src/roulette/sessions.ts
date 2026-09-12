import { TelegramApi } from '../telegram/api';
import { TelegramMessage } from '../telegram/types';
import { ActiveSession } from './types';
import { Logger } from '../utils/logger';

export class RouletteRelay {
  constructor(private readonly telegram: TelegramApi) {}

  async relayMessage(session: ActiveSession, senderUserId: number, message: TelegramMessage): Promise<boolean> {
    const isUserA = session.userA === senderUserId;
    const recipientChatId = isUserA ? session.chatB : session.chatA;

    try {
      if (message.text) {
        // Send anonymous text
        await this.telegram.sendMessage(recipientChatId, message.text, {
          parse_mode: undefined, // Send plain text to avoid markdown injection
        });
        return true;
      }

      if (message.photo && message.photo.length > 0) {
        // Relay photo by file_id
        const bestPhoto = message.photo[message.photo.length - 1];
        await this.telegram.sendPhoto(recipientChatId, bestPhoto.file_id, {
          caption: message.caption,
        });
        return true;
      }

      // If unsupported media or sticker, inform recipient
      if (message.sticker) {
        await this.telegram.sendMessage(
          recipientChatId,
          `<i>[Співрозмовник надіслав стікер ${message.sticker.emoji || '🎭'}]</i>`
        );
        return true;
      }

      return false;
    } catch (err) {
      Logger.error(`Failed to relay anonymous message from ${senderUserId} to ${recipientChatId}`, err);
      return false;
    }
  }
}
