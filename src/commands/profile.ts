import { CommandHandler } from './types';
import { INTIMACY_TIERS, SoulIntimacyEngine } from '../luna/soul';
import { Keyboards } from '../telegram/keyboards';

export const handleProfile: CommandHandler = async ({ message, telegram, userRepo }) => {
  if (!message.from) return;

  const user = await userRepo.getOrCreate(message.from);
  const soulEngine = new SoulIntimacyEngine();
  const soulState = await soulEngine.getSoulState(user.id);
  const intimacy = INTIMACY_TIERS[soulState.intimacyTier];

  const nextTierPoints = intimacy.maxPoints;
  const progressPercent = Math.min(100, Math.round((soulState.affectionPoints / nextTierPoints) * 100));
  const filledBars = Math.floor(progressPercent / 10);
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);

  const card = (
    `👤 <b>Профіль & Зв'язок з Луною (Soul of Waifu)</b>\n\n` +
    `• <b>Ім'я:</b> ${user.firstName} ${user.lastName || ''}\n` +
    `• <b>ID:</b> <code>${user.id}</code>\n` +
    `• <b>Стрік спілкування:</b> 🔥 ${soulState.dailyStreak} дн. поспіль\n` +
    `• <b>Повідомлень:</b> ${user.messageCount}\n\n` +
    `💜 <b>Рівень Близькості (Intimacy):</b>\n` +
    `• <b>Статус:</b> ${intimacy.badge} — «${intimacy.title}»\n` +
    `• <b>Бали тепла:</b> ${soulState.affectionPoints} / ${nextTierPoints} pts\n` +
    `• <b>Прогрес:</b> [<code>${progressBar}</code>] ${progressPercent}%\n\n` +
    `✨ <b>Відкриті можливості:</b>\n` +
    intimacy.perks.map((p) => `  ✓ ${p}`).join('\n') +
    `\n\n<i>💬 Продовжуй щиро спілкуватися з Луною щодня, щоб відкривати нові таємниці та вирази обличчя!</i>`
  );

  await telegram.sendMessage(message.chat.id, card, {
    reply_markup: Keyboards.profileMenu(),
  });
};
