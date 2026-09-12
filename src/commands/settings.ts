import { CommandHandler } from './types';
import { Keyboards } from '../telegram/keyboards';

export const handleSettings: CommandHandler = async ({ message, telegram }) => {
  await telegram.sendMessage(
    message.chat.id,
    `⚙️ <b>Налаштування компаньйона:</b>\n\n` +
    `• <b>Мова:</b> Українська (за замовчуванням)\n` +
    `• <b>Формат виклику фото:</b> Автоматичний за емоційним станом\n` +
    `• <b>Сповіщення:</b> Увімкнено`,
    { reply_markup: Keyboards.mainMenu() }
  );
};
