import { CommandHandler } from './types';
import { Messages } from '../telegram/messages';
import { Keyboards } from '../telegram/keyboards';

export const handleAbout: CommandHandler = async ({ message, telegram }) => {
  await telegram.sendMessage(message.chat.id, Messages.aboutLuna(), {
    reply_markup: Keyboards.mainMenu(),
  });
};
