const { createRequire } = require("node:module");
const path = require("node:path");

const pgRoot = path.resolve(
  "node_modules/.pnpm/pg@8.22.0/node_modules/pg",
);
const requireFromPg = createRequire(path.join(pgRoot, "package.json"));
const pg = requireFromPg(pgRoot);

const appUrl =
  process.env.DATABASE_URL ??
  "postgresql://laminaria:laminaria-local@localhost:5432/laminaria?schema=public";

const adminUrl = "postgresql://postgres:postgres@localhost:5432/postgres";

async function ensureDatabase() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'laminaria') THEN
          CREATE ROLE laminaria LOGIN PASSWORD 'laminaria-local';
        END IF;
      END $$;
    `);

    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = 'laminaria'",
    );
    if (existing.rowCount === 0) {
      await admin.query("CREATE DATABASE laminaria OWNER laminaria");
    }
    await admin.query("ALTER DATABASE laminaria OWNER TO laminaria");
  } finally {
    await admin.end();
  }
}

async function applySchema() {
  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "Locale" AS ENUM ('EN', 'RU');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "AuthTokenKind" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "WebinarRole" AS ENUM ('HOST', 'COHOST', 'MODERATOR', 'SPEAKER', 'ATTENDEE', 'GUEST');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "WebinarHostRole" AS ENUM ('HOST', 'COHOST', 'MODERATOR', 'SPEAKER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "WebinarStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED', 'ARCHIVED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "WebinarSessionStatus" AS ENUM ('SCHEDULED', 'WAITING', 'LIVE', 'ENDED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "WebinarAccess" AS ENUM ('PUBLIC', 'PRIVATE', 'PASSWORD_PROTECTED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "normalizedEmail" varchar(320) NOT NULL UNIQUE,
        "passwordHash" varchar(255),
        "name" varchar(160),
        "avatarUrl" text,
        "locale" "Locale" NOT NULL DEFAULT 'EN',
        "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
        "emailVerifiedAt" timestamptz(3),
        "lastLoginAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "deletedAt" timestamptz(3)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "tokenHash" varchar(128) NOT NULL UNIQUE,
        "expiresAt" timestamptz(3) NOT NULL,
        "lastSeenAt" timestamptz(3) NOT NULL DEFAULT now(),
        "ipAddress" inet,
        "userAgent" text,
        "revokedAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "AuthToken" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "kind" "AuthTokenKind" NOT NULL,
        "tokenHash" varchar(128) NOT NULL UNIQUE,
        "expiresAt" timestamptz(3) NOT NULL,
        "consumedAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Workspace" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "name" varchar(160) NOT NULL,
        "slug" varchar(100) NOT NULL UNIQUE,
        "logoUrl" text,
        "locale" "Locale" NOT NULL DEFAULT 'EN',
        "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "deletedAt" timestamptz(3)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "WorkspaceMember" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
        "joinedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "deletedAt" timestamptz(3),
        UNIQUE ("workspaceId", "userId")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Webinar" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
        "createdById" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "slug" varchar(120) NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text,
        "coverImageUrl" text,
        "language" "Locale" NOT NULL DEFAULT 'EN',
        "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
        "status" "WebinarStatus" NOT NULL DEFAULT 'DRAFT',
        "access" "WebinarAccess" NOT NULL DEFAULT 'PUBLIC',
        "scheduledStartAt" timestamptz(3),
        "maxParticipants" integer,
        "requireEmailRegistration" boolean NOT NULL DEFAULT true,
        "allowGuestJoin" boolean NOT NULL DEFAULT false,
        "passwordHash" varchar(255),
        "waitingRoomEnabled" boolean NOT NULL DEFAULT false,
        "recordingEnabled" boolean NOT NULL DEFAULT false,
        "chatEnabled" boolean NOT NULL DEFAULT true,
        "qaEnabled" boolean NOT NULL DEFAULT true,
        "reactionsEnabled" boolean NOT NULL DEFAULT true,
        "pollsEnabled" boolean NOT NULL DEFAULT true,
        "aiModerationEnabled" boolean NOT NULL DEFAULT false,
        "aiAnswersEnabled" boolean NOT NULL DEFAULT false,
        "remindersEnabled" boolean NOT NULL DEFAULT true,
        "startedAt" timestamptz(3),
        "endedAt" timestamptz(3),
        "cancelledAt" timestamptz(3),
        "archivedAt" timestamptz(3),
        "version" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "deletedAt" timestamptz(3),
        UNIQUE ("workspaceId", "slug")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "WebinarSession" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "webinarId" uuid NOT NULL REFERENCES "Webinar"("id") ON DELETE CASCADE,
        "sequence" integer NOT NULL DEFAULT 1,
        "status" "WebinarSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
        "livekitRoomName" varchar(255) NOT NULL UNIQUE,
        "livekitRoomSid" varchar(255) UNIQUE,
        "scheduledStartAt" timestamptz(3),
        "waitingRoomOpenedAt" timestamptz(3),
        "startedAt" timestamptz(3),
        "endedAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        UNIQUE ("webinarId", "sequence")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "WebinarHost" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "webinarId" uuid NOT NULL REFERENCES "Webinar"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "role" "WebinarHostRole" NOT NULL,
        "invitedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "acceptedAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "deletedAt" timestamptz(3),
        UNIQUE ("webinarId", "userId")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Registration" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "webinarId" uuid NOT NULL REFERENCES "Webinar"("id") ON DELETE CASCADE,
        "userId" uuid REFERENCES "User"("id") ON DELETE SET NULL,
        "email" varchar(320) NOT NULL,
        "normalizedEmail" varchar(320) NOT NULL,
        "displayName" varchar(160) NOT NULL,
        "locale" "Locale" NOT NULL DEFAULT 'EN',
        "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
        "tokenHash" varchar(128) UNIQUE,
        "consentedAt" timestamptz(3),
        "confirmedAt" timestamptz(3),
        "cancelledAt" timestamptz(3),
        "attendedAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "deletedAt" timestamptz(3),
        UNIQUE ("webinarId", "normalizedEmail")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ParticipantSession" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "webinarSessionId" uuid NOT NULL REFERENCES "WebinarSession"("id") ON DELETE CASCADE,
        "registrationId" uuid REFERENCES "Registration"("id") ON DELETE SET NULL,
        "userId" uuid REFERENCES "User"("id") ON DELETE SET NULL,
        "role" "WebinarRole" NOT NULL,
        "displayName" varchar(160) NOT NULL,
        "livekitIdentity" varchar(255) NOT NULL,
        "idempotencyKey" varchar(100),
        "joinedAt" timestamptz(3) NOT NULL DEFAULT now(),
        "leftAt" timestamptz(3),
        "lastSeenAt" timestamptz(3) NOT NULL DEFAULT now(),
        "promotedAt" timestamptz(3),
        "removedAt" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
        UNIQUE ("webinarSessionId", "livekitIdentity"),
        UNIQUE ("webinarSessionId", "idempotencyKey")
      );
    `);

    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" ("email")',
      'CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User" ("deletedAt")',
      'CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx" ON "Session" ("userId", "expiresAt")',
      'CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session" ("expiresAt")',
      'CREATE INDEX IF NOT EXISTS "Session_revokedAt_idx" ON "Session" ("revokedAt")',
      'CREATE INDEX IF NOT EXISTS "AuthToken_userId_kind_expiresAt_idx" ON "AuthToken" ("userId", "kind", "expiresAt")',
      'CREATE INDEX IF NOT EXISTS "AuthToken_expiresAt_consumedAt_idx" ON "AuthToken" ("expiresAt", "consumedAt")',
      'CREATE INDEX IF NOT EXISTS "Workspace_ownerId_deletedAt_idx" ON "Workspace" ("ownerId", "deletedAt")',
      'CREATE INDEX IF NOT EXISTS "WorkspaceMember_userId_deletedAt_idx" ON "WorkspaceMember" ("userId", "deletedAt")',
      'CREATE INDEX IF NOT EXISTS "Webinar_workspaceId_status_scheduledStartAt_idx" ON "Webinar" ("workspaceId", "status", "scheduledStartAt")',
      'CREATE INDEX IF NOT EXISTS "Webinar_status_scheduledStartAt_idx" ON "Webinar" ("status", "scheduledStartAt")',
      'CREATE INDEX IF NOT EXISTS "Webinar_createdById_idx" ON "Webinar" ("createdById")',
      'CREATE INDEX IF NOT EXISTS "Webinar_deletedAt_idx" ON "Webinar" ("deletedAt")',
      'CREATE INDEX IF NOT EXISTS "WebinarSession_webinarId_status_idx" ON "WebinarSession" ("webinarId", "status")',
      'CREATE INDEX IF NOT EXISTS "WebinarHost_userId_deletedAt_idx" ON "WebinarHost" ("userId", "deletedAt")',
      'CREATE INDEX IF NOT EXISTS "Registration_webinarId_status_createdAt_idx" ON "Registration" ("webinarId", "status", "createdAt")',
      'CREATE INDEX IF NOT EXISTS "Registration_userId_idx" ON "Registration" ("userId")',
      'CREATE INDEX IF NOT EXISTS "Registration_deletedAt_idx" ON "Registration" ("deletedAt")',
      'CREATE INDEX IF NOT EXISTS "ParticipantSession_webinarSessionId_role_leftAt_idx" ON "ParticipantSession" ("webinarSessionId", "role", "leftAt")',
      'CREATE INDEX IF NOT EXISTS "ParticipantSession_registrationId_idx" ON "ParticipantSession" ("registrationId")',
      'CREATE INDEX IF NOT EXISTS "ParticipantSession_userId_idx" ON "ParticipantSession" ("userId")',
    ];

    for (const statement of indexStatements) {
      await client.query(statement);
    }

    console.log("dev_database_bootstrap_complete");
  } finally {
    await client.end();
  }
}

ensureDatabase()
  .then(applySchema)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
