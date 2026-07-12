# Laminaria repository audit

Date: 2026-07-10

## Starting state

The supplied workspace contained no application repository, package manifest, source files,
environment contract, design tokens, database schema, tests, or documentation. Only the Codex
`work/` and `outputs/` service directories existed. The attached product specification is therefore
the source of truth and Laminaria is being created as a new project rather than modifying existing
user code.

## Initial gaps

- No monorepo, frontend, API, worker, shared packages, or lockfile.
- No persistence model, migrations, auth/session implementation, RBAC, or subscription service.
- No LiveKit, Socket.IO, storage, email, AI, or billing integration boundary.
- No EN/RU localization, design system, responsive UI, accessibility, or motion policy.
- No security baseline, reliability handling, tests, deployment config, or runbook.

## Architecture decision

Laminaria is a pnpm workspace modular monolith with independently deployable web, API, and worker
processes. PostgreSQL is the system of record. Redis carries ephemeral coordination and BullMQ jobs;
it is never the only copy of business data. LiveKit owns media only. The API owns authorization,
tokens, room permissions, realtime validation, idempotency, and audit trails.

External services are represented by real provider interfaces. When credentials are absent, the
application returns a typed `SERVICE_NOT_CONFIGURED` state and never fabricates a successful result.
