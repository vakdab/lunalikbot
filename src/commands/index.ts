import { CommandHandler, CommandContext } from './types';
import { handleStart } from './start';
import { handleHelp } from './help';
import { handleAbout } from './about';
import { handleProfile } from './profile';
import { handleMemory } from './memory';
import { handleDiary } from './diary';
import { handleRoulette, handleNext } from './roulette';
import { handleStop } from './stop';
import { handleSettings } from './settings';
import { extractCommand } from '../utils/validation';
import { Logger } from '../utils/logger';

export * from './types';

export class CommandRouter {
  private readonly handlers: Map<string, CommandHandler> = new Map();

  constructor() {
    this.register('start', handleStart);
    this.register('help', handleHelp);
    this.register('about', handleAbout);
    this.register('luna', handleAbout);
    this.register('profile', handleProfile);
    this.register('memory', handleMemory);
    this.register('diary', handleDiary);
    this.register('roulette', handleRoulette);
    this.register('next', handleNext);
    this.register('stop', handleStop);
    this.register('settings', handleSettings);
  }

  register(command: string, handler: CommandHandler): void {
    const cleanCmd = command.toLowerCase().replace(/^\//, '');
    this.handlers.set(cleanCmd, handler);
  }

  async handle(context: CommandContext): Promise<boolean> {
    const parsed = extractCommand(context.message.text);
    if (!parsed) return false;

    const handler = this.handlers.get(parsed.command.replace('/', ''));
    if (!handler) {
      Logger.debug(`Unknown command received: ${parsed.command}`);
      return false;
    }

    context.args = parsed.args;
    try {
      await handler(context);
      return true;
    } catch (err) {
      Logger.error(`Error executing command ${parsed.command}`, err);
      await context.telegram.sendMessage(
        context.message.chat.id,
        '⚠️ <i>Виникла помилка під час виконання команди. Спробуйте ще раз пізніше.</i>'
      );
      return true;
    }
  }
}
