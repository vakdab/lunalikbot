import { CommandHandler } from './types';
import { Messages } from '../telegram/messages';
import { Keyboards } from '../telegram/keyboards';

export const handleHelp: CommandHandler = async ({ message, telegram }) => {
  await telegram.sendMessage(message.chat.id, Messages.help(), {
    reply_markup: Keyboards.mainMenu(),
  });
};
