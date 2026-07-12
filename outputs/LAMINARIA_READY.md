# Laminaria — ready-to-run handoff

## Delivered

- Animated, responsive Next.js application with light/dark themes and reduced-motion support
- Complete English and Russian product experience
- Registration, sign-in, verification, password reset, onboarding, and workspaces
- Webinar creation, scheduling, public pages, attendee registration, confirmation, and calendar export
- Camera/microphone prejoin with device selection and receive-only fallback
- LiveKit webinar room plus Socket.IO chat, Q&A, moderation boundaries, roles, and short-lived credentials
- Fastify API with CSRF, secure cookies, rate limits, Swagger docs, PostgreSQL repositories, and health probes
- BullMQ worker with SMTP, S3-compatible storage, and optional AI providers
- Exactly three plans: Free, Professional, Business; no invented prices or limits and no duration limit
- Docker Compose for PostgreSQL, Redis, MinIO, and Mailpit
- Architecture, brand, user-flow, service, and audit documentation

## Verified

- Web TypeScript: passed
- Web ESLint: passed with zero warnings
- Web production build: passed, 36 generated routes
- API TypeScript and production build: passed
- API in-process startup and `/health/live` smoke test: passed (HTTP 200)
- Worker TypeScript and production build: passed
- UI, localization, contracts, and plan configuration TypeScript: passed
- Prisma schema validation and Prisma Client generation: passed

Vitest cannot start in this managed Windows session because the environment blocks its esbuild child process with `spawn EPERM`; the failure happens before test collection. Production compilation and an API smoke test were completed independently.

## Start

```powershell
Copy-Item .env.example .env
corepack enable
pnpm install
pnpm infra:up
pnpm db:generate
pnpm db:push
pnpm dev
```

Then open `http://localhost:3000/en`, `http://localhost:3000/ru`, API docs at `http://localhost:4000/docs`, and local email at `http://localhost:8025`.

## External launch configuration

Real video requires LiveKit URL/key/secret. Production deployment also requires a real domain, a strong `TOKEN_PEPPER`, production PostgreSQL/Redis, and chosen mail/storage providers. AI and billing remain fail-closed until providers and business terms are explicitly approved.
