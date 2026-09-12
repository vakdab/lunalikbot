import { CommandHandler } from './types';

export const handleStop: CommandHandler = async ({ message, roulette }) => {
  if (!message.from) return;
  await roulette.stopOrLeave(message.from.id, message.chat.id);
};
