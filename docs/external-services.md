# External service contract

| Capability          | Required configuration                                 | Behavior when absent                                                                       |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Live video          | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Pre-join explains that media is not configured; no token is issued                         |
| Redis/realtime jobs | `REDIS_URL`                                            | API remains readable; realtime/queued operations return service unavailable                |
| Object storage      | S3 endpoint, bucket, credentials                       | Upload and recording controls are disabled with setup guidance                             |
| Email               | SMTP host and sender                                   | Verification/reminder requests are retained or rejected explicitly; never marked delivered |
| AI                  | selected provider, model, secret                       | AI controls show “Not configured”; deterministic moderation still runs                     |
| Paddle Billing      | API key, client token, webhook secret, Pro price IDs   | Plans remain visible, but checkout and subscription management are disabled                |
| Sentry              | DSN                                                    | Structured local logs remain active; no telemetry is sent                                  |

Production secrets must be injected by the deployment secret manager. Do not commit a populated
`.env`, place secrets in Prisma records, or prefix secret variables with `NEXT_PUBLIC_`.

The Paddle client-side token is the only billing token intentionally sent to the browser. Paddle
documents it as safe for Paddle.js. The Paddle API key and webhook secret stay server-side.

## Paddle Billing setup

Configure these variables on the API service:

```dotenv
BILLING_PROVIDER=paddle
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=pdl_sdbx_...
PADDLE_CLIENT_TOKEN=test_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_PRO_MONTHLY_PRICE_ID=pri_...
PADDLE_PRO_YEARLY_PRICE_ID=pri_...
```

Use `production`, a live API key, and a `live_...` client-side token only after sandbox checkout,
webhook, cancellation, and refund scenarios pass.

Before live checkout, approve `laminarias.com` in Paddle's checkout website/domain settings.

Create the notification destination:

```text
https://laminarias.com/api/paddle/webhook
```

Subscribe it to subscription lifecycle events: `subscription.created`,
`subscription.activated`, `subscription.updated`, `subscription.trialing`,
`subscription.past_due`, `subscription.paused`, `subscription.resumed`, and
`subscription.canceled`.

The API key needs transaction read/write, subscription write, adjustment write, and customer portal
session write permissions. The application creates transactions server-side, opens Paddle Checkout
using the returned transaction ID, provisions access from signed subscription webhooks, and uses the
Paddle-hosted customer portal for self-service billing.
