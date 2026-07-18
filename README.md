# Laminaria

Laminaria is a bilingual webinar platform for audiences in Europe, the United States, and the CIS. The product includes an animated marketing experience, account flows, workspaces, webinar scheduling, public registration, device prejoin, a LiveKit room, realtime chat and Q&A, and background jobs.

## Run locally

Requirements: Node.js 22+, pnpm 11+, and Docker Desktop.

```powershell
Copy-Item .env.example .env
.\pnpm.cmd install
.\pnpm.cmd infra:up
.\pnpm.cmd db:generate
.\pnpm.cmd db:bootstrap
.\pnpm.cmd dev
```

Open:

- Web application: http://localhost:3000/en or http://localhost:3000/ru
- API documentation (development only): http://localhost:4000/docs
- Mailpit inbox: http://localhost:8025
- MinIO console: http://localhost:9001

The local PostgreSQL, Redis, SMTP inbox, and S3-compatible storage are provided by Docker Compose. Replace `TOKEN_PEPPER` before using a shared environment.

## Video rooms

Media is intentionally provided by LiveKit rather than a custom WebRTC implementation. Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to `.env` to enable room credentials. Until all three values exist, room entry returns an explicit `SERVICE_NOT_CONFIGURED` response instead of simulating a call.

## Languages and motion

English and Russian are first-class locales. The interface uses shared design tokens, spring-based transitions, responsive layouts, light/dark themes, and a reduced-motion path for accessibility.

## Workspace layout

- `apps/web` — Next.js product and public experience
- `apps/api` — Fastify API, Socket.IO gateway, authentication, Prisma repositories
- `apps/worker` — BullMQ jobs for mail, storage, and optional AI providers
- `packages/ui` — shared visual primitives and tokens
- `packages/localization` — complete EN/RU message catalogs
- `packages/contracts` — shared request and event contracts
- `packages/config` — exactly three fail-closed commercial plans
- `prisma` — PostgreSQL schema and Prisma configuration
- `docs` — architecture, brand, flows, audit, and external-service notes

## Verification

```powershell
.\pnpm.cmd check
```

Commercial prices and numeric plan limits are deliberately unset until a business decision is approved. Webinar duration is never limited. AI, billing, and production email/storage providers fail closed when they are not configured.
