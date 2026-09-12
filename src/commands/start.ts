import { CommandHandler } from './types';
import { Messages } from '../telegram/messages';
import { Keyboards } from '../telegram/keyboards';

export const handleStart: CommandHandler = async ({ message, telegram, userRepo }) => {
  const from = message.from;
  if (!from) return;

  const user = await userRepo.getOrCreate(from);
  const welcomeText = Messages.welcome(user.firstName);

  await telegram.sendMessage(message.chat.id, welcomeText, {
    reply_markup: Keyboards.mainMenu(),
  });
};
