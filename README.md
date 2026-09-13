# Lunalik Bot

Мінімальний Telegram-бот для двох речей:

- звичайне AI-спілкування без меню та додаткових режимів;
- автоматичне збереження важливих фактів із діалогів у Mem0.

Будь-який текст після `/start` обробляється як повідомлення для розмови.

## Groq

Бот підтримує Groq через OpenAI-сумісний Chat Completions API. Для запуску додайте секрети Cloudflare:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put AI_API_KEY
```

У `wrangler.jsonc` за замовчуванням увімкнено `AI_PROVIDER=groq` і модель `llama-3.3-70b-versatile`. За потреби модель можна змінити через `AI_MODEL_NAME`. Groq API key має бути переданий саме через `AI_API_KEY`.
