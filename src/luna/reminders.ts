import { KVStorage } from '../database/kv';
import { TelegramApi } from '../telegram/api';
import { Logger } from '../utils/logger';

export interface Reminder {
  id: string;
  userId: number;
  chatId: number;
  text: string;
  dueAt: number;
  createdAt: number;
}

const REMINDER_PREFIX = 'luna:reminder:';
const KYIV_TIME_ZONE = 'Europe/Kyiv';

function kyivParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function kyivLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): number {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetParts = kyivParts(new Date(asUtc));
  const displayedAsUtc = Date.UTC(
    offsetParts.year, offsetParts.month - 1, offsetParts.day,
    offsetParts.hour, offsetParts.minute, offsetParts.second
  );
  const offset = displayedAsUtc - asUtc;
  return asUtc - offset;
}

function addDays(year: number, month: number, day: number, days: number): [number, number, number] {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Understands natural Ukrainian reminders without requiring a command. */
export function parseReminderRequest(input: string, now = new Date()): { text: string; dueAt: number } | null {
  const normalized = input.trim().replace(/\s+/g, ' ');
  const prefix = normalized.match(/^нагадай(?:\s+мені)?\s+/i);
  if (!prefix) return null;

  const rest = normalized.slice(prefix[0].length).trim();
  const relative = rest.match(/^через\s+(\d+)\s*(хв(?:илин|илину)?|год(?:ину|ини)?|д(?:ень|ні|нів))\s+(.+)$/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const multiplier = unit.startsWith('хв') ? 60_000 : unit.startsWith('год') ? 3_600_000 : 86_400_000;
    return { text: relative[3].trim(), dueAt: now.getTime() + amount * multiplier };
  }

  const atTime = rest.match(/^(сьогодні|завтра|післязавтра)?\s*(?:о|от)\s*(\d{1,2})(?::|\.)?(\d{2})?\s+(.+)$/i);
  if (!atTime) return null;

  const dayName = (atTime[1] || '').toLowerCase();
  const hour = Number(atTime[2]);
  const minute = Number(atTime[3] || 0);
  if (hour > 23 || minute > 59) return null;

  const current = kyivParts(now);
  const offsetDays = dayName === 'завтра' ? 1 : dayName === 'післязавтра' ? 2 : 0;
  let [year, month, day] = addDays(current.year, current.month, current.day, offsetDays);
  let dueAt = kyivLocalToUtc(year, month, day, hour, minute);

  // "нагадай о 18:00" means the next occurrence of that local time.
  if (!dayName && dueAt <= now.getTime()) {
    [year, month, day] = addDays(year, month, day, 1);
    dueAt = kyivLocalToUtc(year, month, day, hour, minute);
  }
  if (dueAt <= now.getTime()) return null;

  return { text: atTime[4].trim(), dueAt };
}

export class ReminderService {
  constructor(private readonly kv: KVStorage, private readonly telegram: TelegramApi) {}

  async create(userId: number, chatId: number, text: string, dueAt: number): Promise<Reminder> {
    const reminder: Reminder = {
      id: makeId(), userId, chatId, text, dueAt, createdAt: Date.now(),
    };
    await this.kv.set(`${REMINDER_PREFIX}${reminder.id}`, reminder);
    return reminder;
  }

  async sendDueReminders(now = Date.now()): Promise<number> {
    let sent = 0;
    for (const key of await this.kv.listKeys(REMINDER_PREFIX)) {
      const reminder = await this.kv.get<Reminder>(key);
      if (!reminder || reminder.dueAt > now) continue;

      try {
        await this.telegram.sendMessage(reminder.chatId, `⏰ Нагадування: ${reminder.text}`);
        await this.kv.delete(key);
        sent += 1;
      } catch (error) {
        Logger.warn(`Failed to send reminder ${reminder.id}`, { error });
      }
    }
    return sent;
  }
}
