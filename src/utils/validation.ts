import { Logger } from './logger';

export function validateTelegramSecret(
  requestHeaderToken: string | null,
  configuredSecretToken?: string
): boolean {
  if (!configuredSecretToken) {
    // If no secret configured in worker secrets, allow (with warning in dev)
    return true;
  }

  if (!requestHeaderToken) {
    Logger.warn('Telegram request missing X-Telegram-Bot-Api-Secret-Token header');
    return false;
  }

  // Constant-time string comparison to prevent timing attacks
  if (requestHeaderToken.length !== configuredSecretToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < requestHeaderToken.length; i++) {
    result |= requestHeaderToken.charCodeAt(i) ^ configuredSecretToken.charCodeAt(i);
  }

  return result === 0;
}

export function sanitizeText(text: string, maxLength: number = 4000): string {
  if (!text) return '';
  return text.trim().slice(0, maxLength);
}

export function extractCommand(text?: string): { command: string; args: string } | null {
  if (!text || !text.startsWith('/')) {
    return null;
  }

  const parts = text.trim().split(/\s+/);
  const rawCommand = parts[0].toLowerCase();
  // Strip bot username if formatted as /start@lunalikbot
  const cleanCommand = rawCommand.split('@')[0];
  const args = parts.slice(1).join(' ');

  return {
    command: cleanCommand,
    args,
  };
}
