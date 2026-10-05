# Lunalik Bot

Мінімальний Telegram-бот для двох речей:

- звичайне AI-спілкування без меню та додаткових режимів;
- автоматичне збереження важливих фактів із діалогів у Mem0;
- проактивні follow-up повідомлення в приватному чаті: після 6 годин тиші Луна м’яко питає, чи все гаразд, і робить не більше двох нагадувань;
- природні нагадування без команд: «нагадай мені завтра о 6:00 помити руки», «нагадай через 2 години зателефонувати»;
- щоденні проактивні повідомлення: Луна пише першою після 6 годин тиші, потім — щодня, поки користувач не відповість;
- груповий режим: тиха модерація спаму (за наявності прав адміністратора) та відповіді, коли бота згадують (@lunalikbot, «Луна…» або reply на його повідомлення).

Будь-який текст після `/start` обробляється як повідомлення для розмови.

## AI-провайдер

Бот за замовчуванням використовує Groq Chat Completions API. Це серверний Telegram-бот, тому він не може використати браузерну сесію `puter.js` користувача. Для запуску додайте секрети Cloudflare:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put MEM0_API_KEY
```

У `wrangler.json` за замовчуванням увімкнено `AI_PROVIDER=groq` і підтверджену модель `openai/gpt-oss-120b`. Створіть API key у [Groq Console](https://console.groq.com/keys) та збережіть його як `GROQ_API_KEY`.

Puter залишається опційним режимом (`AI_PROVIDER=puter`) і використовує `AI_API_KEY`, але його серверний endpoint вимагає платний/активний Puter subscription для такого виклику та повертає `402 subscription required`. Інструкція [Free, Unlimited Gemini API](https://developer.puter.com/tutorials/free-gemini-api/) стосується браузерного `puter.ai.chat()` із сесією користувача, а не Telegram Worker. Для цього бота використовуйте прямий Gemini режим.

Для Groq використовуйте саме `GROQ_API_KEY`; код має fallback на `AI_API_KEY` лише для сумісності зі старими конфігураціями.

## Персональна довгострокова пам’ять

Пам’ять інтегрована через [Mem0](https://github.com/mem0ai/mem0). Для кожного Telegram-користувача Worker використовує окремий Mem0 `user_id` і `agent_id=luna`, тому спогади різних користувачів не змішуються. Після кожного діалогу важливі факти зберігаються асинхронно, а перед новою відповіддю релевантні спогади додаються до контексту Luna.

Потрібен лише Cloudflare Worker Secret `MEM0_API_KEY`; його не треба додавати в GitHub. Mem0 є сховищем довгострокової пам’яті: після кожного обміну Луна передає діалог у Mem0, а перед відповіддю шукає релевантні спогади. Якщо Mem0 тимчасово недоступний, розмова не ламається, а короткостроковий діалог продовжує зберігатися у KV.

Опційні Mem0 secrets для окремого workspace:

```text
MEM0_ORG_ID
MEM0_PROJECT_ID
```

Вони не потрібні для базової персональної пам’яті.

## Автоматичний деплой

Cloudflare Worker підключений до цього GitHub-репозиторію безпосередньо через Cloudflare Git integration. Після push у `main` Cloudflare сам забирає репозиторій і деплоїть Worker за конфігурацією з `wrangler.json`.

GitHub Actions не виконує Cloudflare deploy і не потребує `CLOUDFLARE_API_TOKEN` або `CLOUDFLARE_ACCOUNT_ID`. Workflow `.github/workflows/typecheck.yml` запускає лише `npm run typecheck` для перевірки коду.

Секрети Telegram і Groq залишаються Cloudflare Worker Secrets/Variables та не зберігаються в GitHub.


## Проактивні повідомлення

Для автоматичних follow-up повідомлень потрібен KV binding `LUNA_KV`. Після `/start` або звичайного повідомлення Луна запам'ятовує чат як активний. Cron запускається щохвилини; перше follow-up повідомлення надсилається після 6 годин без відповіді, друге — через 24 години. Після нового повідомлення лічильник очікування скидається.

Проактивні повідомлення надсилаються лише в приватних чатах і не більше двох разів без нової відповіді, щоб бот не спамив.

Нагадування приймають українські формати `сьогодні о 18:30`, `завтра о 6:00`, `післязавтра о 9:00` і `через 2 години`. Час за замовчуванням — `Europe/Kyiv`. Якщо KV не підключено, бот не підтверджує нагадування як збережене, а повідомляє про відсутнє сховище.

## Груповий режим

Бот бачить повідомлення групи лише якщо у BotFather вимкнено Group Privacy (`/setprivacy` → Disable). Для видалення спаму Луні потрібні права адміністратора «Видалення повідомлень»; без прав спам просто ігнорується. Луна відповідає в групі тільки на прямі звернення, щоб не заспамлювати чат.

## Виправлення: помилка «can't parse entities»

Telegram надсилає повідомлення з `parse_mode: HTML` за замовчуванням. Якщо у відповіді AI, тексті нагадування чи імені користувача трапляється сирий `<`, `>` або `&` (наприклад, обірваний тег `<thought>` через ліміт токенів, чи смайлик `<3`), Telegram відхиляв усе повідомлення з помилкою `can't parse entities`. Тепер увесь динамічний текст екранується (`escapeHtml`) перед відправкою, а обірваний `<thought>` без закриваючого тега більше не потрапляє в чат як видимий текст.


## Контекст довгого діалогу

Луна використовує два шари контексту:

- KV зберігає до 40 останніх повідомлень кожного чату протягом 30 днів.
- Mem0 зберігає важливі стабільні факти та повертає до 8 релевантних спогадів для нового повідомлення.

У запит до AI передаються до 24 останніх повідомлень і релевантна довготривала памʼять. Старі записи автоматично обрізаються за лімітом, щоб не перевищувати контекст моделі.

## Інтеграція механік Her-Go

У Lunalik адаптовано не окремий Go-сервіс, а принципи Her-Go поверх поточного Cloudflare Worker:

- `luna:profile:<telegram_user_id>` у наявному KV містить окремі колекції `memories`, `reflections`, `emotional` та `personality`.
- Довготривалі факти витягуються лише з явних сигналів у повідомленні, обʼєднуються за схожістю та проходять періодичну consolidation-процедуру через cron.
- Mem0 використовується для семантичної памʼяті лише для важливих повідомлень або періодичних checkpoint-ів, а не для кожного повідомлення.
- Емоційний стан і стиль адаптуються контрольовано та не можуть змінювати системні правила.
- Внутрішні reflections зберігаються окремо й не надсилаються користувачу.
- Команди приватності: `/memory`, `/memory_delete <id>`, `/memory_clear`, `/proactive_on`, `/proactive_off`.
- Пошук запускається тільки для запитів із ознаками актуальності, новин, цін, GitHub, технологій або явного прохання пошукати.

Додаткових environment variables не потрібно. Потрібні вже наявні `LUNA_KV`, `MEM0_API_KEY` для віддаленої семантичної памʼяті та `SEARCH_API_KEY` для web search. Без Mem0 або SerpAPI бот продовжує працювати на локальному KV і звичайному діалозі.

## TencentDB Agent Memory integration

Lunalik can optionally use the external TencentDB Agent Memory `MemoryCore` gateway as its primary long-term memory pipeline. The Worker does not embed the Node.js MemoryCore runtime. It connects to the gateway over its v3 HTTP data plane:

- `/v3/conversation/add` receives completed Telegram turns as L0 conversation data.
- `/v3/atomic/search` retrieves relevant L1 memories before a reply.
- `/v3/conversation/delete` clears the current Telegram session when the user runs `/memory_clear`.
- Team, Agent and Telegram user isolation IDs are sent on every request.
- KV state and Mem0 remain graceful fallbacks when TencentDB is not configured or temporarily unavailable.

Required Worker secrets/variables when enabling TencentDB:

```env
TENCENT_MEMORY_ENDPOINT=https://your-memorycore.example.com
TENCENT_MEMORY_API_KEY=...
TENCENT_MEMORY_SERVICE_ID=lunalik-production
TENCENT_MEMORY_TEAM_ID=...
TENCENT_MEMORY_AGENT_ID=...
```

MemoryCore itself must be deployed separately because it requires Node.js 22.16+ and a persistent SQLite/local storage volume. Configure its own LLM credentials and gateway API key according to TencentDB Agent Memory's `MemoryCore/tdai-gateway.standalone.yaml`. The Lunalik Worker only needs the HTTP endpoint and the five TencentDB identifiers above.
