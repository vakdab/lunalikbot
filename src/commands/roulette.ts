import { CommandHandler } from './types';

export const handleRoulette: CommandHandler = async ({ message, roulette }) => {
  if (!message.from) return;
  await roulette.startSearch(message.from.id, message.chat.id);
};

export const handleNext: CommandHandler = async ({ message, roulette }) => {
  if (!message.from) return;
  await roulette.nextPartner(message.from.id, message.chat.id);
};
