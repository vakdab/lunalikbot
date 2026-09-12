import { CommandHandler } from './types';
import { Keyboards } from '../telegram/keyboards';

export const handleMemory: CommandHandler = async ({ message, telegram, memory }) => {
  if (!message.from) return;

  const memories = await memory.retriever.getAllUserMemories(message.from.id);

  if (memories.length === 0) {
    await telegram.sendMessage(
      message.chat.id,
      `🧠 <b>Спогади Луни:</b>\n\nЯ поки що нічого особливого не записала у свою пам'ять. Розкажи мені про свої захоплення, улюблену музику чи мрії! ✨`,
      { reply_markup: Keyboards.mainMenu() }
    );
    return;
  }

  let text = `🧠 <b>Що Луна пам'ятає про тебе:</b>\n\n`;
  memories.slice(0, 10).forEach((mem, index) => {
    text += `• <i>${mem.memory}</i>\n`;
  });

  text += `\n<i>💡 Щоб очистити пам'ять, скористайся кнопкою в профілі.</i>`;

  await telegram.sendMessage(message.chat.id, text, {
    reply_markup: Keyboards.profileMenu(),
  });
};
