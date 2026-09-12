import { TelegramAPIError } from '../utils/errors';
import { Logger } from '../utils/logger';
import {
  SendMessageOptions,
  SendPhotoOptions,
  TelegramChatAction,
  TelegramMessage,
  TelegramReplyMarkup,
} from './types';

export class TelegramApi {
  private readonly baseUrl: string;

  constructor(private readonly token: string) {
    if (!token) {
      throw new Error('Telegram bot token is required to initialize TelegramApi.');
    }
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  private async call<T>(method: string, payload: Record<string, any>): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();

      if (!response.ok || !data.ok) {
        Logger.error(`Telegram API call ${method} failed`, data, { method });
        throw new TelegramAPIError(
          data?.description || `Telegram API error on method ${method} (status ${response.status})`
        );
      }

      Logger.debug(`Telegram API ${method} completed in ${Date.now() - startTime}ms`);
      return data.result as T;
    } catch (error) {
      if (error instanceof TelegramAPIError) throw error;
      Logger.error(`Network error during Telegram API call ${method}`, error);
      throw new TelegramAPIError(`Failed to communicate with Telegram API: ${String(error)}`);
    }
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: SendMessageOptions
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
      disable_notification: options?.disable_notification,
      reply_to_message_id: options?.reply_to_message_id,
      reply_markup: options?.reply_markup,
    });
  }

  async sendPhoto(
    chatId: number | string,
    photo: string, // URL or Telegram file_id
    options?: SendPhotoOptions
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendPhoto', {
      chat_id: chatId,
      photo,
      caption: options?.caption,
      parse_mode: options?.parse_mode || 'HTML',
      disable_notification: options?.disable_notification,
      reply_to_message_id: options?.reply_to_message_id,
      reply_markup: options?.reply_markup,
    });
  }

  async sendChatAction(
    chatId: number | string,
    action: TelegramChatAction = 'typing'
  ): Promise<boolean> {
    try {
      return await this.call<boolean>('sendChatAction', {
        chat_id: chatId,
        action,
      });
    } catch (err) {
      Logger.warn(`Failed to send chat action ${action} to chat ${chatId}`, { err });
      return false;
    }
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    options?: { text?: string; showAlert?: boolean; url?: string }
  ): Promise<boolean> {
    return this.call<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: options?.text,
      show_alert: options?.showAlert,
      url: options?.url,
    });
  }

  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: { parse_mode?: 'HTML' | 'MarkdownV2'; reply_markup?: TelegramReplyMarkup }
  ): Promise<TelegramMessage | boolean> {
    return this.call<TelegramMessage | boolean>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup,
    });
  }

  async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    try {
      return await this.call<boolean>('deleteMessage', {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (err) {
      Logger.warn(`Failed to delete message ${messageId} in chat ${chatId}`, { err });
      return false;
    }
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    return this.call<boolean>('setWebhook', {
      url,
      secret_token: secretToken,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
    });
  }
}
