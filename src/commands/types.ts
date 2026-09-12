import { TelegramMessage } from '../telegram/types';
import { TelegramApi } from '../telegram/api';
import { UserRepository } from '../database/users';
import { AppContext } from '../types';
import { RouletteManager } from '../roulette/manager';
import { MemoryService } from '../luna/memory';

export interface CommandContext {
  message: TelegramMessage;
  args: string;
  telegram: TelegramApi;
  userRepo: UserRepository;
  roulette: RouletteManager;
  memory: MemoryService;
  appCtx: AppContext;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;
