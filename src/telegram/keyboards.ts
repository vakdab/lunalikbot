import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from './types';

export class Keyboards {
  static mainMenu(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '💬 Поговорити з Луною', callback_data: 'luna:chat_prompt' },
          { text: '🎲 Чат-рулетка', callback_data: 'roulette:start' },
        ],
        [
          { text: '💜 Профіль & Звʼязок', callback_data: 'luna:profile' },
          { text: '📖 Щоденник думок', callback_data: 'luna:diary_view' },
        ],
        [
          { text: '🧠 Памʼять (Mem0)', callback_data: 'luna:memory_view' },
          { text: '⚙️ Налаштування', callback_data: 'settings:main' },
        ],
        [
          { text: '🌸 Про Луну', callback_data: 'luna:about' },
          { text: '❓ Допомога', callback_data: 'help:commands' },
        ],
      ],
    };
  }

  static rouletteActiveMenu(): ReplyKeyboardMarkup {
    return {
      keyboard: [
        [{ text: '⏭ Наступний (/next)' }, { text: '⏹ Зупинити (/stop)' }],
        [{ text: '⚠️ Поскаржитися (/report)' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  static rouletteSearchingMenu(): ReplyKeyboardMarkup {
    return {
      keyboard: [[{ text: '❌ Скасувати пошук (/stop)' }]],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  static profileMenu(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🧠 Що памʼятає Mem0', callback_data: 'luna:memory_view' },
          { text: '📖 Щоденник Луни', callback_data: 'luna:diary_view' },
        ],
        [
          { text: '✨ Очистити памʼять', callback_data: 'luna:memory_clear' },
          { text: '⬅️ Меню', callback_data: 'menu:main' },
        ],
      ],
    };
  }

  static removeKeyboard(): { remove_keyboard: true } {
    return { remove_keyboard: true };
  }
}
