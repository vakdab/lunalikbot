import { TelegramApi } from '../telegram/api';
import { TelegramMessage, TelegramUser } from '../telegram/types';
import { Logger } from '../utils/logger';

const SPAM_PATTERNS: RegExp[] = [
  /(t\.me\/\+|joinchat\/|chat\.whatsapp\.com)/i,
  /\b(казино|casino|1win|ставк[аи]|букмекер|букмекерськ[аі]|slots?|слоти)\b/i,
  /\b(крипт[аоі]|crypt[oa]|bitcoin|битко[іи]н|usdt)\b.*(?:заробляти|заработать|earn|інвест|invest)/i,
  /(?:https?:\/\/\S+[\s\S]*){5,}/i,
];

export class GroupService {
  private botInfo: TelegramUser | null = null;

  constructor(private readonly telegram: TelegramApi) {}

  async getBotInfo(): Promise<TelegramUser> {
    if (!this.botInfo) {
      this.botInfo = await this.telegram.getMe();
    }
    return this.botInfo;
  }

  isSpam(text?: string | null): boolean {
    if (!text) return false;
    return SPAM_PATTERNS.some((pattern) => pattern.test(text));
  }

  /** Silently removes spam when the bot has admin rights; returns true if removed. */
  async moderate(message: TelegramMessage): Promise<boolean> {
    if (!this.isSpam(message.text)) return false;
    const removed = await this.telegram.deleteMessage(message.chat.id, message.message_id);
    if (removed) {
      Logger.info(`Removed spam message ${message.message_id} in chat ${message.chat.id}`);
    }
    return removed;
  }

  async isAddressedToBot(message: TelegramMessage): Promise<boolean> {
    const text = (message.text || '').trim();
    if (!text) return false;

    const bot = await this.getBotInfo();
    if (message.reply_to_message?.from?.id === bot.id) return true;

    if (new RegExp(`@${bot.username}\\b`, 'i').test(text)) return true;

    // «Луна, як справи?» / «Луно, розкажи…» / «луна?»
    return /^луна[,:!?.\s]/i.test(text) || /^луна\??$/i.test(text) || /^лун[оує]/i.test(text);
  }

  /** Strips the mention so Luna receives a clean message. */
  stripMention(text: string): string {
    const bot = this.botInfo;
    return text
      .replace(new RegExp(`@${bot ? bot.username : 'lunalikbot'}\\b`, 'gi'), '')
      .replace(/^луна[,:!?.\s]*/i, '')
      .trim();
  }
}
