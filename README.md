# Neutroteck — песни в подарок (бот MAX + мини-приложение)

Бот и мини-приложение MAX работают на одном бэкенде и общей логике (`server/src/core.ts`):
рассказ о герое → текст песни (Claude) → правки → «Сделать хит!» → генерация (Suno) → аудио.

```
server/     Fastify + бот MAX (long polling) + SQLite (node:sqlite), TypeScript
miniapp/    React + Vite, MAX Bridge; сервер раздаёт miniapp/dist
```

## Запуск

```bash
npm install
cp .env.example .env   # заполнить
npm run build          # собрать мини-приложение
npm start              # сервер + бот, порт 3000
npm test
```

Без ключей всё работает на заглушках: нет `ANTHROPIC_API_KEY` → тестовый текст,
нет `SUNO_API_KEY` → тестовый mp3 через 3 с, нет `MAX_BOT_TOKEN` → не стартует только бот.
Локальная отладка мини-приложения вне MAX: `DEV_AUTH=1`, `npm run dev:server` + `npm run dev:miniapp`.

## Что реализовано (MVP)

- Подписка на обязательные каналы (`REQUIRED_CHANNELS`), проверка в боте и в API.
- Баланс в токенах, 4 тарифных пакета, цена песни 439 токенов (`server/src/config.ts`).
- Оплата Robokassa: ссылка → `POST/GET /pay/robokassa/result` (проверка подписи и суммы, идемпотентное начисление).
- Диалог в боте и те же экраны в мини-приложении: выбор повода (45 вариантов + «Свой вариант», список в `server/src/occasions.ts`), рассказ, правка текста бесплатна до запуска.
- Генерация в фоне, опрос статуса, возобновление после рестарта, **возврат токенов при сбое**.
- Авторизация мини-приложения по подписанному `initData` (HMAC от токена бота).
- Админ-команда в боте: `/grant <user_id> <tokens>` (`ADMIN_IDS`).

## Что нужно проверить на живых сервисах

Код написан по документации, но в этой среде не гонялся против реальных MAX, Suno и Robokassa:

1. **MAX**: формат `initData` и подпись — алгоритм взят как у Telegram WebApp, сверьте с документацией MAX
   (`server/src/max/initData.ts`); эндпоинты в `server/src/max/api.ts`. Бот должен быть админом каналов для `isMember`.
2. **Suno**: официального API нет; `SunoApiOrg` написан под формат sunoapi.org. Другой агрегатор — меняется только `server/src/services/music.ts`.
3. **Robokassa**: в личном кабинете укажите Result URL `${PUBLIC_URL}/pay/robokassa/result` (метод POST или GET),
   Success/Fail URL — `/pay/success`, `/pay/fail`. Сначала `ROBOKASSA_TEST=1`.

## Дальше (вне MVP)

Обложка по фото (+149₽), мультик (3073 токена), отправка самого аудиофайла в чат вместо ссылки,
Postgres вместо SQLite при росте, webhook вместо long polling, антифлуд и логи платежей.
