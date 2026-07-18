# Laminaria — финальный аудит

Дата проверки: 18 июля 2026 года.

## Общий статус

**Not ready.** Основной серверный MVP-контур работает и проходит автоматические и HTTP-интеграционные проверки, но публичный коммерческий релиз пока блокируют три подтверждённых ограничения:

1. bearer-токен сессии сохраняется в `localStorage`, поэтому XSS в web-приложении сможет похитить сессию;
2. история чата, Q&A и опросов хранится в памяти процесса и теряется при перезапуске API; полноценный интерфейс опросов отсутствует;
3. не выполнен настоящий двухклиентский browser E2E с камерой, микрофоном, демонстрацией экрана и мобильными браузерами.

Последняя опубликованная версия также не содержит исправления из этого аудита до повторного deploy.

## Проверенные области

- чистая установка 757 пакетов строго по `pnpm-lock.yaml`, включая native postinstall Prisma, Argon2, Sharp, SWC и esbuild;
- структура monorepo и scripts всех workspace-пакетов;
- ESLint, TypeScript strict typecheck, Prettier;
- unit и integration tests API, worker, contracts, config, localization и web;
- production-сборка API, worker, UI, localization и Next.js web;
- production-запуск Next.js и HTTP-запрос `/en`;
- development-запуск web и API и HTTP health/page probes;
- Prisma schema, применение initial migration на чистой PostgreSQL и повторное идемпотентное применение;
- фактическое соответствие существующей Neon-схемы `schema.prisma` перед baseline миграции;
- регистрация, конфликт повторной регистрации, вход, cookie-сессия и закрытые API;
- создание workspace и получение списка workspace;
- создание, планирование, публичное чтение, запуск и завершение вебинара;
- публичная регистрация зрителя и отклонение дубликата;
- запрет prejoin до старта и выдача LiveKit-токена после старта;
- назначение отдельного аккаунта модератором, получение роли `MODERATOR`, moderator prejoin и серверный запрет завершить эфир;
- анонимный доступ к workspace и завершению эфира;
- realtime chat/Q&A/poll/moderation unit integration;
- бан зрителя, разрыв Socket.IO-соединения, удаление LiveKit participant и запрет повторного входа;
- сохранение ban/mute/unban/unmute через `ModerationEvent`;
- CORS allow/deny, CSRF, security headers, production CSP и production-only конфигурация;
- `pnpm audit` production-зависимостей;
- статический поиск TODO/FIXME/HACK, `.skip`, `.only`, временных console-логов, localhost/example URL и клиентского хранения токенов;
- поверхностная проверка responsive CSS, `prefers-reduced-motion`, overflow и семантики UI по исходному коду.

## Найденные и исправленные ошибки

### Critical: отсутствовала настоящая initial migration

- Причина: каталог `prisma/migrations/202607110001_initial` содержал только `.gitkeep`, а production запускал `prisma migrate deploy`.
- Файлы: `prisma/migrations/202607110001_initial/migration.sql`, `package.json`, `README.md`, `prisma/README.md`; удалён устаревший `scripts/dev-db-bootstrap.cjs`.
- Исправление: создан полный SQL для 28 таблиц, внешних ключей, уникальных ограничений и индексов; существующая Neon DB безопасно baselined без reset; bootstrap переведён на `prisma migrate deploy`.
- Regression: migration применена к чистой PostgreSQL, повторный deploy сообщил `No pending migrations to apply`.

### High: production мог случайно работать как development

- Причина: `NODE_ENV` по умолчанию был `development`, а Render-конфигурация могла оставить dev-режим, Swagger и небезопасные auth-настройки.
- Файлы: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `apps/api/src/app.ts`.
- Исправление: default стал production; Render/Vercel принудительно считаются production; Swagger UI доступен только в development/test.
- Regression: тесты покрывают Render и Vercel окружения.

### High: тестовая авторизация по номеру была доступна в production

- Причина: production providers раскрывал dev-код `000000` и маршруты phone start/verify.
- Файлы: `apps/api/src/routes/auth.ts`, `apps/api/src/auth/service.ts`, `apps/api/src/config.ts`, env examples.
- Исправление: вход и регистрация по телефону удалены; телефон сохранён только как обязательное поле публичной регистрации зрителя.
- Regression: `/v1/auth/phone/verify` возвращает 404, providers содержит только Google.

### High: бан не гарантировал удаление из LiveKit

- Причина: сервер разрывал Socket.IO, но пользователь мог оставаться в media room.
- Файлы: `apps/api/src/livekit/token-service.ts`, `apps/api/src/realtime/register-realtime.ts`, `apps/api/src/realtime/register-realtime.test.ts`.
- Исправление: при бане API находит все LiveKit participants с данным subject и вызывает `removeParticipant`; повторный вход блокируется.
- Regression: realtime integration проверяет disconnect, LiveKit removal hook и отказ повторного join.

### High: mute и ban терялись при рестарте API

- Причина: ограничения находились только в process-local Map.
- Файлы: `apps/api/src/repositories/contracts.ts`, `apps/api/src/repositories/prisma.ts`, `apps/api/src/realtime/types.ts`, `apps/api/src/realtime/register-realtime.ts`.
- Исправление: актуальное состояние ограничений сохраняется и восстанавливается из `ModerationEvent`.
- Regression: unit integration проверяет сохранение операций и применение ограничений.

### Medium: лимит зрителей считал несуществующие активные DB-сессии

- Причина: `ParticipantSession` не создавался в текущем join-потоке.
- Файлы: `apps/api/src/livekit/token-service.ts`, `apps/api/src/routes/public.ts`.
- Исправление: вместимость комнаты проверяется по реальному `listParticipants` LiveKit.
- Regression: типы, API tests и реальный LiveKit prejoin проходят.

### Medium: небезопасный production CSP

- Причина: `unsafe-eval` можно было включить public environment variable.
- Файл: `apps/web/next.config.ts`.
- Исправление: `unsafe-eval` разрешён только в development.
- Regression: запущенный production Next.js отдаёт CSP без `unsafe-eval`.

### Medium: запрещённый CORS-origin приводил к 500

- Причина: CORS callback передавал Error вместо отказа без разрешающих заголовков.
- Файлы: `apps/api/src/security/plugin.ts`, `apps/api/src/auth/session-cookie.test.ts`.
- Исправление: origin отклоняется без 5xx и без `Access-Control-Allow-Origin`.
- Regression: evil-origin preflight проверяется автоматически.

### Medium: две известные уязвимые transitive dependency

- Причина: уязвимые версии PostCSS и `@hono/node-server` в lockfile.
- Файлы: `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
- Исправление: безопасные версии закреплены через overrides.
- Regression: `pnpm audit --prod --audit-level moderate` сообщает `No known vulnerabilities found`.

### Medium: неполный общий quality gate

- Причина: API и contracts не имели `test:run`, UI объявлял lint без ESLint 9 config.
- Файлы: `apps/api/package.json`, `packages/contracts/package.json`, `packages/ui/eslint.config.mjs`.
- Исправление: общий `pnpm check` действительно запускает эти тесты и UI lint.
- Regression: два полных прогона `pnpm check`.

### Low: Q&A не позволял модератору отправить ответ из комнаты

- Причина: realtime event существовал, но UI не имел формы ответа.
- Файлы: `apps/web/src/components/room-experience.tsx`, `apps/web/src/app/globals.css`.
- Исправление: добавлена inline-форма ответа с отображением результата.
- Regression: lint, typecheck и production build.

## Результаты команд

| Проверка                      | Фактический результат                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| Clean install                 | PASS — 757 packages, native postinstall успешны                       |
| `pnpm lint`                   | PASS                                                                  |
| `pnpm typecheck`              | PASS                                                                  |
| Unit/integration              | PASS — 6 API files / 19 tests; остальные пакеты 19 tests              |
| Format                        | PASS — все файлы соответствуют Prettier                               |
| Production audit              | PASS — известных moderate/high/critical уязвимостей нет               |
| Production build              | PASS — Next.js 37 routes, API/worker/packages собраны                 |
| Production web start          | PASS — `/en` = 200, CSP без `unsafe-eval`                             |
| Development start             | PASS — web `/en` = 200, API readiness = 200                           |
| Prisma validate/status/deploy | PASS — schema valid, DB up to date, повторный deploy идемпотентен     |
| HTTP integration              | PASS для перечисленного core-сценария                                 |
| Browser E2E                   | **NOT RUN** — Playwright/Cypress в проекте отсутствует                |
| Реальный media E2E            | **NOT RUN** — не было двух управляемых браузеров и реальных устройств |

## Тестовые сценарии

Успешно прошли: signup `202`, duplicate signup `409`, sign-in `200`, восстановленная cookie-сессия `/me` `200`, workspace create `201`, webinar create `201`, schedule `200`, public page `200`, attendee registration `201`, duplicate registration `409`, prejoin до эфира `409`, start `200`, LiveKit host prejoin `200`, end `200`, anonymous protected calls `401`.

Отдельный двухаккаунтный сценарий: назначение moderator `201`, вход модератора, роль `MODERATOR`, доступ к workspace/webinar, moderator prejoin `200`, попытка moderator завершить эфир `403`, завершение owner `200`.

Не проверены фактически: email-delivery и Google OAuth callback с production credentials; forgot/reset-password полный почтовый цикл; несколько реальных камер/микрофонов; screen share; adaptive streaming при плохой сети; Safari/iOS/Android; полноценные polls в UI; upload/download файлов; запись; billing; AI; browser accessibility audit. Причина — соответствующие production credentials, сервисы, UI или browser E2E harness отсутствуют.

## Безопасность

Исправлены: production dev-mode, публичный тестовый phone OTP, CORS 500, production `unsafe-eval`, LiveKit ban eviction, непостоянные ограничения модерации, уязвимые dependencies, production Swagger.

Остаются:

- **High:** `apps/web/src/lib/api.ts` хранит bearer session token в `localStorage`, а auth API возвращает его в JSON. Для релиза нужен same-origin API proxy/custom parent domain и cookie-only session, затем удаление bearer из ответа и localStorage.
- **Medium:** CSRF использует custom header и строгий CORS, но не требует совпадения double-submit cookie для каждого state-changing запроса. Следует сделать строгую cookie/header проверку.
- **Medium:** автоматизированный IDOR/RBAC matrix покрывает основной контур, но не каждую пару «роль — endpoint» из расширенной спецификации.
- Секреты по известным шаблонам в tracked source не обнаружены; реальные значения `.env` не выводились и не изменялись.

## Производительность

- Next.js использует route splitting и production build; LiveKit загружается только комнатой через route chunks.
- production static assets текущей сборки занимают примерно 2.39 MB; крупнейший JS chunk около 624 KB. Нужны bundle analyzer и lazy loading тяжёлых room-компонентов перед масштабным трафиком.
- анимации учитывают `prefers-reduced-motion`; responsive CSS содержит breakpoints и overflow-защиту.
- нет нагрузочного теста 100+ зрителей, reconnect storm и длительной memory profile; это обязательный pre-launch этап.
- realtime state в памяти ограничивает горизонтальное масштабирование и делает Redis adapter обязательным до нескольких API replicas.

## Внешние зависимости

- production domain, DNS и единый parent domain для безопасной cookie-only сессии;
- production Neon/PostgreSQL URL и deploy миграции;
- SMTP provider и verified sender;
- Google OAuth client/secret/callback;
- LiveKit Cloud URL, API key/secret и TURN, проверенные из целевых регионов;
- Redis и Socket.IO adapter для horizontal scaling;
- S3-compatible storage для файлов/записей;
- observability: error tracking, logs, uptime, metrics и alerts;
- AI API key только если AI включается в релиз;
- Stripe keys, products и signed webhook только если billing включается в релиз.

## Известные ограничения

- chat/Q&A/polls не имеют постоянной истории и общей синхронизации между API replicas;
- UI опросов, файлов, записей, billing и AI не является готовым production-функционалом;
- страница команды не покрывает полный workflow приглашений/принятия/отказа и уведомлений;
- 144p и 240p используют один LiveKit low simulcast layer, 480p — medium, 720p/1080p — high; точное разрешение зависит от publisher, сети и adaptive streaming;
- Render free/cold instance ранее отвечал с задержкой более 45 секунд;
- git history содержит старые package-cache blobs, из-за чего pack около 367 MB; безопасная очистка требует отдельной согласованной rewrite-history операции;
- production deployment необходимо повторить: опубликованный URL не включает текущие изменения.

## Deployment checklist

- [ ] Закрыть High-риск `localStorage` session token через same-origin/cookie-only архитектуру.
- [ ] Перенести chat/Q&A/polls в PostgreSQL/Redis и добавить Socket.IO Redis adapter.
- [ ] Добавить Playwright E2E минимум для signup/sign-in/workspace/webinar/moderation/end-webinar.
- [ ] Выполнить двухклиентский LiveKit E2E: host + viewer, camera/mic/screen share, quality, ban/rejoin.
- [ ] Выполнить Chrome/Firefox/Safari и iOS/Android smoke, accessibility и responsive audit.
- [ ] Настроить production SMTP, Google OAuth, LiveKit, storage, monitoring и secrets.
- [ ] Применить `prisma migrate deploy` к production DB с backup и проверкой `/health/ready`.
- [ ] Выполнить новый deploy API и web из текущего commit; не использовать старую публикацию как доказательство.
- [ ] Проверить exact production CORS origin, CSP, secure cookies и отсутствие `/docs`.
- [ ] Выполнить load/reconnect test и проверить Render без cold-start для планируемого тарифа.
- [ ] После deploy повторить `pnpm check`, audit, migration status и критический HTTP/browser smoke.

## Решение

Кодовая база стала существенно безопаснее и основной webinar MVP подтверждён на уровне build, API, БД, RBAC, LiveKit token/control plane и realtime unit integration. Статус останется **Not ready**, пока не устранены три блокера из раздела «Общий статус» и не выполнен browser/media E2E на опубликованной версии.
