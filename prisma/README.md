# Laminaria database

Prisma 7 reads the connection URL from `prisma.config.ts`, not from the schema.
The root `prisma.config.ts` is loaded automatically:

```sh
pnpm exec prisma validate
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Authentication, invitation and registration secrets are stored only as hashes.
OAuth token columns are for application-encrypted ciphertext; encryption keys must remain in a secrets manager.
The initial migration adds database checks which Prisma cannot express: normalized email casing,
positive capacities, exactly one invitation scope, scope/role alignment, non-negative usage, and moderation targets.
