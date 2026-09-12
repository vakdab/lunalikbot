import { CommandHandler } from './types';
import { LunaSoulDiary } from '../luna/soul';
import { Keyboards } from '../telegram/keyboards';

export const handleDiary: CommandHandler = async ({ message, telegram }) => {
  if (!message.from) return;

  const diary = new LunaSoulDiary();
  const entries = await diary.getRecentEntries(message.from.id, 5);

  if (entries.length === 0) {
    await telegram.sendMessage(
      message.chat.id,
      `📖 <b>Таємний щоденник Луни:</b>\n\n` +
      `<i>Луна ще не встигла зробити записи про тебе у своєму блокноті. Напиши їй щось цікаве! ✨</i>`,
      { reply_markup: Keyboards.profileMenu() }
    );
    return;
  }

  let text = `📖 <b>Таємні думки Луни про тебе (Soul Diary):</b>\n\n`;
  entries.forEach((entry, idx) => {
    text += `<b>[${entry.dateStr}]</b> <i>(${entry.emotion})</i>:\n«${entry.thought}»\n\n`;
  });

  text += `<i>💜 Ці думки Луна записує у свій внутрішній щоденник після кожної теплої розмови.</i>`;

  await telegram.sendMessage(message.chat.id, text, {
    reply_markup: Keyboards.profileMenu(),
  });
};
