-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'RU');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('OAUTH', 'OIDC');

-- CreateEnum
CREATE TYPE "AuthTokenKind" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "WebinarRole" AS ENUM ('HOST', 'COHOST', 'MODERATOR', 'SPEAKER', 'ATTENDEE', 'GUEST');

-- CreateEnum
CREATE TYPE "WebinarHostRole" AS ENUM ('HOST', 'COHOST', 'MODERATOR', 'SPEAKER');

-- CreateEnum
CREATE TYPE "WebinarStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WebinarSessionStatus" AS ENUM ('SCHEDULED', 'WAITING', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebinarAccess" AS ENUM ('PUBLIC', 'PRIVATE', 'PASSWORD_PROTECTED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FLAGGED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FLAGGED', 'ANSWERED', 'DISMISSED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('PENDING', 'RECORDING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('REGISTERED_ONLY', 'PARTICIPANTS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ModerationCategory" AS ENUM ('ABUSE', 'PROFANITY', 'THREAT', 'DANGEROUS_CONTENT', 'SPAM', 'SUSPICIOUS_LINK', 'DUPLICATE', 'OFF_TOPIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('ALLOW', 'FLAG', 'HOLD', 'BLOCK', 'REMOVE', 'MUTE', 'DISCONNECT');

-- CreateEnum
CREATE TYPE "ModerationSource" AS ENUM ('DETERMINISTIC', 'AI', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('MODERATION', 'QUESTION_CLASSIFICATION', 'QUESTION_DEDUPLICATION', 'ANSWER_SUGGESTION', 'AUTONOMOUS_ANSWER', 'WEBINAR_SUMMARY');

-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'REJECTED_LIMIT');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'PADDLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('CONCURRENT_ATTENDEES', 'CONCURRENT_WEBINARS', 'STORAGE_BYTES', 'AI_INPUT_TOKENS', 'AI_OUTPUT_TOKENS', 'TEAM_MEMBERS');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "normalizedEmail" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255),
    "name" VARCHAR(160),
    "avatarUrl" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AccountType" NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenType" VARCHAR(40),
    "scope" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" INET,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AuthTokenKind" NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "logoUrl" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webinar" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "language" "Locale" NOT NULL DEFAULT 'EN',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "status" "WebinarStatus" NOT NULL DEFAULT 'DRAFT',
    "access" "WebinarAccess" NOT NULL DEFAULT 'PUBLIC',
    "scheduledStartAt" TIMESTAMPTZ(3),
    "maxParticipants" INTEGER,
    "requireEmailRegistration" BOOLEAN NOT NULL DEFAULT true,
    "allowGuestJoin" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" VARCHAR(255),
    "waitingRoomEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "qaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reactionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pollsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiModerationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiAnswersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Webinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarSession" (
    "id" UUID NOT NULL,
    "webinarId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" "WebinarSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "livekitRoomName" VARCHAR(255) NOT NULL,
    "livekitRoomSid" VARCHAR(255),
    "scheduledStartAt" TIMESTAMPTZ(3),
    "waitingRoomOpenedAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WebinarSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarHost" (
    "id" UUID NOT NULL,
    "webinarId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WebinarHostRole" NOT NULL,
    "invitedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "WebinarHost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL,
    "webinarId" UUID NOT NULL,
    "userId" UUID,
    "email" VARCHAR(320) NOT NULL,
    "normalizedEmail" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "displayName" VARCHAR(160) NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" VARCHAR(128),
    "consentedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "attendedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "webinarId" UUID,
    "invitedById" UUID,
    "acceptedById" UUID,
    "email" VARCHAR(320) NOT NULL,
    "normalizedEmail" VARCHAR(320) NOT NULL,
    "workspaceRole" "WorkspaceRole",
    "webinarRole" "WebinarRole",
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantSession" (
    "id" UUID NOT NULL,
    "webinarSessionId" UUID NOT NULL,
    "registrationId" UUID,
    "userId" UUID,
    "role" "WebinarRole" NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "livekitIdentity" VARCHAR(255) NOT NULL,
    "idempotencyKey" VARCHAR(100),
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMPTZ(3),
    "removedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ParticipantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "webinarSessionId" UUID NOT NULL,
    "authorParticipantSessionId" UUID,
    "replyToId" UUID,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "blockedAt" TIMESTAMPTZ(3),
    "editedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "webinarSessionId" UUID NOT NULL,
    "authorParticipantSessionId" UUID,
    "answeredById" UUID,
    "aiUsageId" UUID,
    "body" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "answerBody" TEXT,
    "answeredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" UUID NOT NULL,
    "webinarSessionId" UUID NOT NULL,
    "createdById" UUID,
    "question" TEXT NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "pollOptionId" UUID NOT NULL,
    "participantSessionId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" UUID NOT NULL,
    "webinarSessionId" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "externalId" VARCHAR(255),
    "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "playbackUrl" TEXT,
    "mimeType" VARCHAR(120),
    "sizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "retentionUntil" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "availableAt" TIMESTAMPTZ(3),
    "failureCode" VARCHAR(120),
    "failureMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarResource" (
    "id" UUID NOT NULL,
    "webinarId" UUID NOT NULL,
    "uploadedById" UUID,
    "name" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" VARCHAR(128),
    "visibility" "ResourceVisibility" NOT NULL DEFAULT 'REGISTERED_ONLY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "WebinarResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationRule" (
    "id" UUID NOT NULL,
    "webinarId" UUID NOT NULL,
    "category" "ModerationCategory" NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pattern" TEXT,
    "configuration" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEvent" (
    "id" UUID NOT NULL,
    "webinarSessionId" UUID NOT NULL,
    "moderationRuleId" UUID,
    "chatMessageId" UUID,
    "questionId" UUID,
    "targetParticipantSessionId" UUID,
    "actorUserId" UUID,
    "aiUsageId" UUID,
    "source" "ModerationSource" NOT NULL,
    "category" "ModerationCategory" NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "webinarId" UUID,
    "webinarSessionId" UUID,
    "requestedById" UUID,
    "feature" "AiFeature" NOT NULL,
    "status" "AiUsageStatus" NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(160) NOT NULL,
    "providerRequestId" VARCHAR(255),
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "errorCode" VARCHAR(120),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "displayNameKey" VARCHAR(120) NOT NULL,
    "priceMonthlyMinor" INTEGER,
    "priceAnnualMinor" INTEGER,
    "currency" CHAR(3),
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "businessDecisionRequired" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "billingProvider" "BillingProvider",
    "providerCustomerId" VARCHAR(255),
    "providerSubscriptionId" VARCHAR(255),
    "currentPeriodStart" TIMESTAMPTZ(3),
    "currentPeriodEnd" TIMESTAMPTZ(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "subscriptionId" UUID,
    "metric" "UsageMetric" NOT NULL,
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "periodEnd" TIMESTAMPTZ(3) NOT NULL,
    "used" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceId" UUID,
    "webinarId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "type" VARCHAR(120) NOT NULL,
    "titleKey" VARCHAR(160) NOT NULL,
    "bodyKey" VARCHAR(160) NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "webinarId" UUID,
    "actorUserId" UUID,
    "action" VARCHAR(160) NOT NULL,
    "targetType" VARCHAR(120) NOT NULL,
    "targetId" VARCHAR(255),
    "ipAddress" INET,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User"("normalizedEmail");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Account_userId_deletedAt_idx" ON "Account"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_kind_expiresAt_idx" ON "AuthToken"("userId", "kind", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_consumedAt_idx" ON "AuthToken"("expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_deletedAt_idx" ON "Workspace"("ownerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Workspace_deletedAt_idx" ON "Workspace"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_deletedAt_idx" ON "WorkspaceMember"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_role_deletedAt_idx" ON "WorkspaceMember"("workspaceId", "role", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Webinar_workspaceId_status_scheduledStartAt_idx" ON "Webinar"("workspaceId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "Webinar_status_scheduledStartAt_idx" ON "Webinar"("status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "Webinar_createdById_idx" ON "Webinar"("createdById");

-- CreateIndex
CREATE INDEX "Webinar_deletedAt_idx" ON "Webinar"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Webinar_workspaceId_slug_key" ON "Webinar"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarSession_livekitRoomName_key" ON "WebinarSession"("livekitRoomName");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarSession_livekitRoomSid_key" ON "WebinarSession"("livekitRoomSid");

-- CreateIndex
CREATE INDEX "WebinarSession_webinarId_status_idx" ON "WebinarSession"("webinarId", "status");

-- CreateIndex
CREATE INDEX "WebinarSession_status_scheduledStartAt_idx" ON "WebinarSession"("status", "scheduledStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarSession_webinarId_sequence_key" ON "WebinarSession"("webinarId", "sequence");

-- CreateIndex
CREATE INDEX "WebinarHost_userId_deletedAt_idx" ON "WebinarHost"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "WebinarHost_webinarId_role_deletedAt_idx" ON "WebinarHost"("webinarId", "role", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarHost_webinarId_userId_key" ON "WebinarHost"("webinarId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_tokenHash_key" ON "Registration"("tokenHash");

-- CreateIndex
CREATE INDEX "Registration_webinarId_status_createdAt_idx" ON "Registration"("webinarId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_userId_idx" ON "Registration"("userId");

-- CreateIndex
CREATE INDEX "Registration_deletedAt_idx" ON "Registration"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_webinarId_normalizedEmail_key" ON "Registration"("webinarId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_normalizedEmail_status_idx" ON "Invitation"("workspaceId", "normalizedEmail", "status");

-- CreateIndex
CREATE INDEX "Invitation_webinarId_normalizedEmail_status_idx" ON "Invitation"("webinarId", "normalizedEmail", "status");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_status_idx" ON "Invitation"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "ParticipantSession_webinarSessionId_role_leftAt_idx" ON "ParticipantSession"("webinarSessionId", "role", "leftAt");

-- CreateIndex
CREATE INDEX "ParticipantSession_registrationId_idx" ON "ParticipantSession"("registrationId");

-- CreateIndex
CREATE INDEX "ParticipantSession_userId_idx" ON "ParticipantSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantSession_webinarSessionId_livekitIdentity_key" ON "ParticipantSession"("webinarSessionId", "livekitIdentity");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantSession_webinarSessionId_idempotencyKey_key" ON "ParticipantSession"("webinarSessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ChatMessage_webinarSessionId_status_createdAt_idx" ON "ChatMessage"("webinarSessionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_authorParticipantSessionId_createdAt_idx" ON "ChatMessage"("authorParticipantSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_replyToId_idx" ON "ChatMessage"("replyToId");

-- CreateIndex
CREATE INDEX "ChatMessage_deletedAt_idx" ON "ChatMessage"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_webinarSessionId_idempotencyKey_key" ON "ChatMessage"("webinarSessionId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Question_aiUsageId_key" ON "Question"("aiUsageId");

-- CreateIndex
CREATE INDEX "Question_webinarSessionId_status_upvoteCount_createdAt_idx" ON "Question"("webinarSessionId", "status", "upvoteCount", "createdAt");

-- CreateIndex
CREATE INDEX "Question_authorParticipantSessionId_idx" ON "Question"("authorParticipantSessionId");

-- CreateIndex
CREATE INDEX "Question_deletedAt_idx" ON "Question"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Question_webinarSessionId_idempotencyKey_key" ON "Question"("webinarSessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Poll_webinarSessionId_status_createdAt_idx" ON "Poll"("webinarSessionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Poll_deletedAt_idx" ON "Poll"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_pollId_position_key" ON "PollOption"("pollId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_id_pollId_key" ON "PollOption"("id", "pollId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_participantSessionId_idx" ON "PollVote"("pollId", "participantSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollOptionId_participantSessionId_key" ON "PollVote"("pollOptionId", "participantSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_idempotencyKey_key" ON "PollVote"("pollId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Recording_webinarSessionId_status_idx" ON "Recording"("webinarSessionId", "status");

-- CreateIndex
CREATE INDEX "Recording_retentionUntil_status_idx" ON "Recording"("retentionUntil", "status");

-- CreateIndex
CREATE INDEX "Recording_deletedAt_idx" ON "Recording"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_provider_externalId_key" ON "Recording"("provider", "externalId");

-- CreateIndex
CREATE INDEX "WebinarResource_webinarId_visibility_deletedAt_idx" ON "WebinarResource"("webinarId", "visibility", "deletedAt");

-- CreateIndex
CREATE INDEX "WebinarResource_uploadedById_idx" ON "WebinarResource"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarResource_webinarId_storageKey_key" ON "WebinarResource"("webinarId", "storageKey");

-- CreateIndex
CREATE INDEX "ModerationRule_webinarId_enabled_deletedAt_idx" ON "ModerationRule"("webinarId", "enabled", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationRule_webinarId_category_key" ON "ModerationRule"("webinarId", "category");

-- CreateIndex
CREATE INDEX "ModerationEvent_webinarSessionId_createdAt_idx" ON "ModerationEvent"("webinarSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_chatMessageId_idx" ON "ModerationEvent"("chatMessageId");

-- CreateIndex
CREATE INDEX "ModerationEvent_questionId_idx" ON "ModerationEvent"("questionId");

-- CreateIndex
CREATE INDEX "ModerationEvent_targetParticipantSessionId_idx" ON "ModerationEvent"("targetParticipantSessionId");

-- CreateIndex
CREATE INDEX "ModerationEvent_aiUsageId_idx" ON "ModerationEvent"("aiUsageId");

-- CreateIndex
CREATE INDEX "AiUsage_workspaceId_createdAt_idx" ON "AiUsage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_webinarId_feature_createdAt_idx" ON "AiUsage"("webinarId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_webinarSessionId_feature_createdAt_idx" ON "AiUsage"("webinarSessionId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_status_createdAt_idx" ON "AiUsage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_provider_providerRequestId_key" ON "AiUsage"("provider", "providerRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_workspaceId_status_currentPeriodEnd_idx" ON "Subscription"("workspaceId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_deletedAt_idx" ON "Subscription"("deletedAt");

-- CreateIndex
CREATE INDEX "UsageCounter_subscriptionId_metric_idx" ON "UsageCounter"("subscriptionId", "metric");

-- CreateIndex
CREATE INDEX "UsageCounter_periodEnd_idx" ON "UsageCounter"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_workspaceId_metric_periodStart_periodEnd_key" ON "UsageCounter"("workspaceId", "metric", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_createdAt_idx" ON "Notification"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_webinarId_createdAt_idx" ON "Notification"("webinarId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_deletedAt_idx" ON "Notification"("deletedAt");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_webinarId_createdAt_idx" ON "AuditLog"("webinarId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webinar" ADD CONSTRAINT "Webinar_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webinar" ADD CONSTRAINT "Webinar_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarSession" ADD CONSTRAINT "WebinarSession_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarHost" ADD CONSTRAINT "WebinarHost_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarHost" ADD CONSTRAINT "WebinarHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantSession" ADD CONSTRAINT "ParticipantSession_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantSession" ADD CONSTRAINT "ParticipantSession_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantSession" ADD CONSTRAINT "ParticipantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorParticipantSessionId_fkey" FOREIGN KEY ("authorParticipantSessionId") REFERENCES "ParticipantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_authorParticipantSessionId_fkey" FOREIGN KEY ("authorParticipantSessionId") REFERENCES "ParticipantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_aiUsageId_fkey" FOREIGN KEY ("aiUsageId") REFERENCES "AiUsage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollOptionId_pollId_fkey" FOREIGN KEY ("pollOptionId", "pollId") REFERENCES "PollOption"("id", "pollId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_participantSessionId_fkey" FOREIGN KEY ("participantSessionId") REFERENCES "ParticipantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarResource" ADD CONSTRAINT "WebinarResource_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarResource" ADD CONSTRAINT "WebinarResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationRule" ADD CONSTRAINT "ModerationRule_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_moderationRuleId_fkey" FOREIGN KEY ("moderationRuleId") REFERENCES "ModerationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_targetParticipantSessionId_fkey" FOREIGN KEY ("targetParticipantSessionId") REFERENCES "ParticipantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_aiUsageId_fkey" FOREIGN KEY ("aiUsageId") REFERENCES "AiUsage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_webinarSessionId_fkey" FOREIGN KEY ("webinarSessionId") REFERENCES "WebinarSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
