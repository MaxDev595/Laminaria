# Laminaria: самый простой деплой без GitHub

Полноценная работа приложения требует 2 публичных сервиса:

1. **API**: Railway/Render/Fly/VPS. Нужен для регистрации, аккаунтов, вебинаров, Socket.IO и LiveKit-токенов.
2. **Web**: Vercel. Это красивый frontend на Next.js.

## Что делаешь ты

Только логинишься в сервисах и копируешь готовые значения.

## Шаг 1 — API на Railway

Открой PowerShell:

```powershell
cd C:\Users\pc\Documents\Codex\2026-07-10\new-chat-3
.\deploy\deploy-api-railway.ps1
```

Если Railway спросит:

- `Login` — войди в браузере.
- `Create new project` — да.
- `Project name` — `laminaria-api`.
- `Add PostgreSQL` — да, обязательно.

После деплоя Railway даст публичный домен API, например:

```text
https://laminaria-api-production.up.railway.app
```

Скопируй его.

## Шаг 2 — Web на Vercel

Открой PowerShell:

```powershell
cd C:\Users\pc\Documents\Codex\2026-07-10\new-chat-3
.\deploy\deploy-web-vercel.ps1
```

Если Vercel спросит:

- `Set up and deploy?` — `Y`
- `Which scope?` — твой аккаунт
- `Link to existing project?` — `N`
- `Project name?` — `laminaria`
- `In which directory is your code located?` — `./`
- `Want to modify settings?` — `N`

## Шаг 3 — переменные в Vercel

В Vercel Project → Settings → Environment Variables добавь:

```env
NEXT_PUBLIC_APP_URL=https://ТВОЙ-VERCEL-ДОМЕН
NEXT_PUBLIC_API_URL=https://ТВОЙ-RAILWAY-API-ДОМЕН
NEXT_PUBLIC_REALTIME_URL=https://ТВОЙ-RAILWAY-API-ДОМЕН
NEXT_PUBLIC_LIVEKIT_URL=https://ТВОЙ-LIVEKIT-ДОМЕН
```

Потом нажми **Redeploy**.

## Шаг 4 — переменные в Railway API

В Railway Project → API service → Variables добавь значения из:

```text
deploy/railway-api-env.example
```

Главное заменить:

- `PUBLIC_API_URL`
- `WEB_APP_URL`
- `CORS_ORIGINS`
- `TOKEN_PEPPER`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

## Что можно пока не оплачивать

Можно оставить пустыми:

- `SMTP_*` — email пока не нужен, если включён `SKIP_EMAIL_VERIFICATION=true`.
- `AI_*`
- `BILLING_*`
- `STORAGE_*`

LiveKit нужен для настоящей трансляции.
