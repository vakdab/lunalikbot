export * from './env';

export const APP_CONSTANTS = {
  BOT_NAME: 'Луна',
  BOT_USERNAME: 'lunalikbot',
  VERSION: '1.0.0',
  DEFAULT_LANGUAGE: 'uk',
  MAX_MESSAGE_LENGTH: 4096,
  MAX_MEMORY_SEARCH_LIMIT: 5,
  INACTIVITY_ABSENCE_HOURS: 48,
  ROULETTE_TIMEOUT_SECONDS: 60,
  SUPPORTED_EMOTIONS: [
    'idle',
    'happy',
    'sad',
    'angry',
    'sleepy',
    'love',
    'confused',
    'surprised',
  ] as const,
};
