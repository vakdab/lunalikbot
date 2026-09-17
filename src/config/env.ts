export interface Env {
  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  AI_API_KEY: string;
  MEM0_API_KEY?: string;
  MEM0_ORG_ID?: string;
  MEM0_PROJECT_ID?: string;
  VISION_AI_API_KEY?: string;
  VISION_AI_MODEL_NAME?: string;
  AI_TOOLS_URL?: string;
  AI_TOOLS_SECRET?: string;
  SEARCH_API_KEY?: string;
  SEARCH_LOCATION?: string;
  SEARCH_HL?: string;
  SEARCH_GL?: string;
  SEARCH_GOOGLE_DOMAIN?: string;

  // Environment Variables
  ENVIRONMENT?: string;
  AI_PROVIDER?: string; // 'puter' | 'gemini' | 'openai' | 'groq'
  AI_MODEL_NAME?: string;
  MEDIA_STORAGE_TYPE?: string; // 'telegram_cache' | 'r2' | 'cdn'
  MEDIA_BASE_URL?: string;
  RATE_LIMIT_PER_MINUTE?: string | number;
  ADMIN_USER_IDS?: string;

  // Cloudflare Bindings
  LUNA_KV?: KVNamespace;
  DB?: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  ROULETTE_HUB?: DurableObjectNamespace;
}

export interface AppConfig {
  environment: 'development' | 'production' | 'test';
  telegramToken: string;
  webhookSecret?: string;
  aiProvider: 'puter' | 'gemini' | 'openai' | 'groq';
  aiApiKey: string;
  aiModelName: string;
  mem0ApiKey?: string;
  visionApiKey?: string;
  visionModelName: string;
  toolsUrl?: string;
  toolsSecret?: string;
  searchApiKey?: string;
  searchLocation?: string;
  searchLanguage?: string;
  searchCountry?: string;
  searchGoogleDomain?: string;
  mediaStorageType: 'telegram_cache' | 'r2' | 'cdn';
  mediaBaseUrl?: string;
  rateLimitPerMinute: number;
  adminUserIds: number[];
}

export function parseConfig(env: Env): AppConfig {
  const telegramToken = env.TELEGRAM_BOT_TOKEN || '';
  const mem0ApiKey = env.MEM0_API_KEY;
  const aiApiKey = env.AI_API_KEY || '';

  const adminIds = (env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));

  return {
    environment: (env.ENVIRONMENT as any) || 'production',
    telegramToken,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    aiProvider: (env.AI_PROVIDER as any) || 'puter',
    aiApiKey,
    aiModelName:
      env.AI_MODEL_NAME ||
      (env.AI_PROVIDER === 'openai'
        ? 'gpt-4o-mini'
        : env.AI_PROVIDER === 'groq'
          ? 'llama-3.1-8b-instant'
          : 'gemini-3.8-flash'),
    mem0ApiKey,
    visionApiKey: env.VISION_AI_API_KEY,
    visionModelName: env.VISION_AI_MODEL_NAME || 'gemini-3.6-flash',
    toolsUrl: env.AI_TOOLS_URL,
    toolsSecret: env.AI_TOOLS_SECRET,
    searchApiKey: env.SEARCH_API_KEY,
    searchLocation: env.SEARCH_LOCATION,
    searchLanguage: env.SEARCH_HL,
    searchCountry: env.SEARCH_GL,
    searchGoogleDomain: env.SEARCH_GOOGLE_DOMAIN,
    mediaStorageType: (env.MEDIA_STORAGE_TYPE as any) || 'telegram_cache',
    mediaBaseUrl: env.MEDIA_BASE_URL,
    rateLimitPerMinute: typeof env.RATE_LIMIT_PER_MINUTE === 'number' ? env.RATE_LIMIT_PER_MINUTE : parseInt(String(env.RATE_LIMIT_PER_MINUTE || '30'), 10),
    adminUserIds: adminIds,
  };
}
