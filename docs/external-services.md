# External service contract

| Capability | Required configuration | Behavior when absent |
| --- | --- | --- |
| Live video | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Pre-join explains that media is not configured; no token is issued |
| Redis/realtime jobs | `REDIS_URL` | API remains readable; realtime/queued operations return service unavailable |
| Object storage | S3 endpoint, bucket, credentials | Upload and recording controls are disabled with setup guidance |
| Email | SMTP host and sender | Verification/reminder requests are retained or rejected explicitly; never marked delivered |
| AI | selected provider, model, secret | AI controls show “Not configured”; deterministic moderation still runs |
| Billing | provider and webhook secrets | Plans can be compared, but checkout is unavailable and no price is displayed |
| Sentry | DSN | Structured local logs remain active; no telemetry is sent |

Production secrets must be injected by the deployment secret manager. Do not commit a populated
`.env`, place secrets in Prisma records, or prefix secret variables with `NEXT_PUBLIC_`.
