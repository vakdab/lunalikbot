import { TelegramApi } from '../telegram/api';
import { TelegramMessage } from '../telegram/types';
import { Keyboards } from '../telegram/keyboards';
import { Messages } from '../telegram/messages';
import { RouletteClient } from './queue';
import { RouletteRelay } from './sessions';
import { Logger } from '../utils/logger';

export class RouletteManager {
  private readonly client: RouletteClient;
  private readonly relay: RouletteRelay;

  constructor(
    private readonly telegram: TelegramApi,
    doNamespace?: DurableObjectNamespace
  ) {
    this.client = new RouletteClient(doNamespace);
    this.relay = new RouletteRelay(telegram);
  }

  async startSearch(userId: number, chatId: number, lastPartnerId?: number): Promise<void> {
    const match = await this.client.join(userId, chatId, lastPartnerId);

    if (match.matched && match.session && match.partnerChatId) {
      // Notify both parties
      await this.telegram.sendMessage(chatId, Messages.rouletteConnected(), {
        reply_markup: Keyboards.rouletteActiveMenu(),
      });
      await this.telegram.sendMessage(match.partnerChatId, Messages.rouletteConnected(), {
        reply_markup: Keyboards.rouletteActiveMenu(),
      });
    } else {
      // In queue
      await this.telegram.sendMessage(chatId, Messages.rouletteSearching(), {
        reply_markup: Keyboards.rouletteSearchingMenu(),
      });
    }
  }

  async stopOrLeave(userId: number, chatId: number): Promise<void> {
    const leaveResult = await this.client.leave(userId);

    if (leaveResult.closedSession && leaveResult.partnerChatId) {
      // Notify the other partner that dialogue was ended
      await this.telegram.sendMessage(
        leaveResult.partnerChatId,
        Messages.roulettePartnerDisconnected(),
        { reply_markup: Keyboards.removeKeyboard() }
      );
    }

    await this.telegram.sendMessage(chatId, Messages.rouletteStopped(), {
      reply_markup: Keyboards.removeKeyboard(),
    });
  }

  async nextPartner(userId: number, chatId: number): Promise<void> {
    const currentSession = await this.client.getSession(userId);
    const lastPartnerId = currentSession
      ? (currentSession.userA === userId ? currentSession.userB : currentSession.userA)
      : undefined;

    // Leave existing session
    await this.client.leave(userId);

    if (currentSession) {
      const partnerChat = currentSession.userA === userId ? currentSession.chatB : currentSession.chatA;
      await this.telegram.sendMessage(
        partnerChat,
        Messages.roulettePartnerDisconnected(),
        { reply_markup: Keyboards.removeKeyboard() }
      );
    }

    // Immediately start searching for a new partner (skipping the immediate last partner)
    await this.startSearch(userId, chatId, lastPartnerId);
  }

  async handleIncomingMessage(message: TelegramMessage): Promise<boolean> {
    const userId = message.from?.id;
    if (!userId) return false;

    const session = await this.client.getSession(userId);
    if (!session) return false;

    // Active session found! Relay message anonymously
    await this.relay.relayMessage(session, userId, message);
    return true;
  }
}
