# Laminaria database

Prisma 7 reads the connection URL from `prisma.config.ts`, not from the schema.
Because the reference config intentionally lives in this directory, pass it explicitly:

```sh
pnpm prisma --config prisma/prisma.config.ts validate
pnpm prisma --config prisma/prisma.config.ts migrate deploy
pnpm prisma --config prisma/prisma.config.ts generate
```

Authentication, invitation and registration secrets are stored only as hashes.
OAuth token columns are for application-encrypted ciphertext; encryption keys must remain in a secrets manager.
The initial migration adds database checks which Prisma cannot express: normalized email casing,
positive capacities, exactly one invitation scope, scope/role alignment, non-negative usage, and moderation targets.
