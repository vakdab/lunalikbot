export type LunaEmotion =
  | 'idle'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'sleepy'
  | 'love'
  | 'confused'
  | 'surprised';

export interface LunaImageMeta {
  emotion: LunaEmotion;
  fileName: string;
  telegramFileId?: string;
  r2Path?: string;
  fallbackUrl: string;
}
