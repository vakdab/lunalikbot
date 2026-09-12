# 🌙 Луна (Luna) — Soul of Waifu & Mem0 Telegram AI-Компаньйон

Високопродуктивний, модульний Telegram AI-компаньйон та сервіс анонімної чат-рулетки на базі **TypeScript** та **Cloudflare Workers**.

У проєкт глибоко інтегровано дві провідні концепції:
1. **[Mem0](https://github.com/mem0ai/mem0)** — довготривала семантична пам'ять із векторним пошуком контексту, автоматичним виділенням фактів та прив'язкою до `user_id` та `agent_id: "luna"`.
2. **[Soul of Waifu](https://github.com/jofizcd/Soul-of-Waifu)** — архітектура справжньої «душі» персонажа: внутрішній монолог (`<thought>...</thought>`), рівні близькості (Intimacy Tiers 1–5), таємний щоденник Луни (Soul Diary), стріки спілкування та динамічні аніме-вирази обличчя.

---

## 🏛️ 1. Архітектура та Модульна Структура

```
/
├── src/
│   ├── index.ts                     # Головний Worker orchestrator & router
│   │
│   ├── config/                      # Секрети та константи
│   │   ├── env.ts                   # Строга валідація Cloudflare Secrets
│   │   └── index.ts                 # Константи бота
│   │
│   ├── luna/                        # Ядро AI-компаньйона
│   │   ├── soul/                    # 🌸 Soul-of-Waifu Engine
│   │   │   ├── types.ts             # Intimacy tiers, Soul state, Diary models
│   │   │   ├── intimacy.ts          # Розрахунок балів довіри, стріків та нікнеймів
│   │   │   ├── diary.ts             # Потаємні думки Луни про користувача
│   │   │   └── index.ts
│   │   │
│   │   ├── memory/                  # 🧠 Mem0 Vector Memory Engine
│   │   │   ├── types.ts             # Mem0 REST API v1 інтерфейси
│   │   │   ├── retrieve.ts          # Семантичний пошук релевантних спогадів
│   │   │   ├── save.ts              # Асинхронне виділення та збереження фактів
│   │   │   └── index.ts
│   │   │
│   │   ├── prompt/                  # Динамічний генератор промпту
│   │   │   ├── personality.ts       # Образ, зовнішність та кібер-аніме вайб
│   │   │   ├── rules.ts             # Внутрішній монолог <thought> та правила
│   │   │   ├── context.ts           # Збирання контексту Mem0 + Soul Intimacy
│   │   │   └── system.ts            # Асемблер системного промпту
│   │   │
│   │   ├── ai/                      # Мультипровайдерна AI-система
│   │   │   ├── gemini.ts            # Google Gemini 2.5 Flash
│   │   │   ├── openai.ts            # OpenAI / Groq / Anthropic сумісний клієнт
│   │   │   ├── chat.ts              # Парсер емоцій та думок
│   │   │   └── provider.ts          # AIProviderFactory
│   │   │
│   │   └── functionality/           # Поведінковий шар Луни
│   │       ├── emotions.ts          # Моніторинг емоційного стану
│   │       ├── reactions.ts         # Реакція на відсутність (>24h, >72h)
│   │       ├── profile.ts           # Візуалізація профілю та прогресу
│   │       └── index.ts             # Головний фасад LunaCompanion
│   │
│   ├── roulette/                    # 🎲 Анонімна Чат-Рулетка
│   │   ├── durableObject.ts         # Cloudflare Durable Object (атомарна черга)
│   │   ├── queue.ts                 # Клієнт черги
│   │   ├── sessions.ts              # Анонімний ретранслятор (100% захист ID)
│   │   ├── manager.ts               # Контролер /roulette, /next, /stop
│   │   └── index.ts
│   │
│   ├── telegram/                    # Telegram API Layer (чистий Web Fetch)
│   ├── database/                    # Cloudflare D1 + KV клієнти
│   ├── media/                       # Менеджер PNG емоцій (file_id кеш + R2/CDN)
│   ├── commands/                    # Модульні хендлери (/start, /profile, /diary тощо)
│   └── utils/                       # Безпечний логер та валідатори
│
├── wrangler.jsonc                   # Повна конфігурація Workers + Bindings
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🌸 2. Що дає інтеграція Soul of Waifu

- **Внутрішній монолог (`<thought>...</thought>`)**: Перед відповіддю Луна генерує власні щирі потаємні думки, які автоматично зберігаються в її особистий щоденник (`/diary`).
- **Рівні близькості (Intimacy Tiers 1–5)**:
  1. `🌱 Знайомство` (0–50 pts)
  2. `🌿 Тепло` (50–150 pts)
  3. `🌸 Дружба` (150–350 pts) — вільне дружнє спілкування без формальностей.
  4. `💜 Близькість` (350–700 pts) — глибокі розмови, ніжні звертання, секрети.
  5. `✨ Споріднена душа` (700+ pts) — максимальний рівень довіри, унікальні реакції та особливі звертання.
- **Щоденний стрік спілкування (🔥 Daily Streak)** з бонусами тепла.

---

## 🧠 3. Що дає інтеграція Mem0

- **Векторний пошук фактів**: Під час кожного повідомлення користувача система запитує у Mem0 найбільш семантично схожі спогади (хобі, події, стиль, улюблені речі).
- **Автоматичне навчання**: У фоновому потоці (`ctx.executionCtx.waitUntil`) кожна репліка надсилається у Mem0 для аналізу та збереження нових фактів без затримки для користувача.
- **KV Fallback**: Якщо `MEM0_API_KEY` не вказано, система автоматично перемикається на локальну вбудовану пам'ять Cloudflare KV.

---

## 🚀 4. Швидкий Старт & Розгортання

```bash
# 1. Встановити залежності
npm install

# 2. Встановити секрети у Cloudflare Worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put AI_API_KEY
npx wrangler secret put MEM0_API_KEY
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

# 3. Опублікувати Worker
npx wrangler deploy

# 4. Встановити Webhook для Telegram
curl -F "url=https://<YOUR_WORKER>.workers.dev" \
     -F "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```
