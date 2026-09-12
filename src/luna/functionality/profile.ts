import { UserProfile } from '../../database/types';

export class ProfileFormatter {
  static formatProfileCard(user: UserProfile): string {
    const tierEmojis: Record<UserProfile['relationshipTier'], string> = {
      stranger: '🌱 Знайомимося',
      acquaintance: '🌿 Приємний співрозмовник',
      friend: '🌸 Хороший друг',
      close_friend: '💜 Близький друг',
      soulmate: '✨ Споріднена душа',
    };

    const nextTierGoals: Record<UserProfile['relationshipTier'], number> = {
      stranger: 30,
      acquaintance: 100,
      friend: 250,
      close_friend: 500,
      soulmate: 1000,
    };

    const goal = nextTierGoals[user.relationshipTier];
    const progressPercent = Math.min(100, Math.round((user.relationshipPoints / goal) * 100));
    const progressBar = '█'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));

    return (
      `👤 <b>Профіль мандрівника</b>\n\n` +
      `• <b>Ім'я:</b> ${user.firstName} ${user.lastName || ''}\n` +
      `• <b>ID:</b> <code>${user.id}</code>\n` +
      `• <b>Повідомлень з Луною:</b> ${user.messageCount}\n` +
      `• <b>Діалогів у рулетці:</b> ${user.rouletteStats.totalChats}\n\n` +
      `💜 <b>Зв'язок з Луною:</b>\n` +
      `• <b>Рівень:</b> ${tierEmojis[user.relationshipTier]}\n` +
      `• <b>Бали тепла:</b> ${user.relationshipPoints} / ${goal} pts\n` +
      `• <b>Прогрес:</b> [<code>${progressBar}</code>] ${progressPercent}%\n\n` +
      `<i>💡 Чим більше щирих розмов — тим міцнішим стає ваш зв'язок!</i>`
    );
  }
}
