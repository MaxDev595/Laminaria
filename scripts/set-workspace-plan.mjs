import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const planCode = process.argv[2];
const workspaceRef = process.argv[3];

const plans = {
  free: {
    displayNameKey: "plans.free",
    priceMonthlyMinor: 0,
    priceAnnualMinor: 0,
    maxConcurrentAttendees: 25,
    recordingRetentionDays: 0,
    storageBytes: 0,
    teamMembers: 1,
    features: {
      webinarRecording: false,
      polls: false,
      advancedModeration: false,
      advancedAnalytics: false,
      customLogo: false,
      removeLaminariaBranding: false,
      dataExport: false,
      apiAccess: false,
      workspaceTeam: false,
    },
  },
  professional: {
    displayNameKey: "plans.professional",
    priceMonthlyMinor: 1200,
    priceAnnualMinor: 12000,
    maxConcurrentAttendees: 150,
    recordingRetentionDays: 30,
    storageBytes: 10 * 1024 * 1024 * 1024,
    teamMembers: 1,
    features: {
      webinarRecording: true,
      polls: true,
      advancedModeration: true,
      advancedAnalytics: true,
      customLogo: true,
      removeLaminariaBranding: false,
      dataExport: true,
      apiAccess: false,
      workspaceTeam: false,
    },
  },
  business: {
    displayNameKey: "plans.business",
    priceMonthlyMinor: 2900,
    priceAnnualMinor: 29000,
    maxConcurrentAttendees: 1000,
    recordingRetentionDays: 365,
    storageBytes: 100 * 1024 * 1024 * 1024,
    teamMembers: 25,
    features: {
      webinarRecording: true,
      polls: true,
      advancedModeration: true,
      advancedAnalytics: true,
      customLogo: true,
      removeLaminariaBranding: true,
      dataExport: true,
      apiAccess: true,
      workspaceTeam: true,
    },
  },
};

if (!planCode || !plans[planCode] || !workspaceRef) {
  console.error("Usage: node scripts/set-workspace-plan.mjs <free|professional|business> <workspace-id-or-slug>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query("begin");

  const workspace = await client.query(
    'select id, name, slug from "Workspace" where (id::text = $1 or slug = $1) and "deletedAt" is null limit 1',
    [workspaceRef],
  );

  if (!workspace.rowCount) {
    throw new Error(`Workspace not found: ${workspaceRef}`);
  }

  for (const [code, plan] of Object.entries(plans)) {
    await client.query(
      `
      insert into "Plan" (
        code,
        "displayNameKey",
        "priceMonthlyMinor",
        "priceAnnualMinor",
        currency,
        limits,
        features,
        "businessDecisionRequired",
        active
      )
      values ($1, $2, $3, $4, 'USD', $5::jsonb, $6::jsonb, false, true)
      on conflict (code) do update set
        "displayNameKey" = excluded."displayNameKey",
        "priceMonthlyMinor" = excluded."priceMonthlyMinor",
        "priceAnnualMinor" = excluded."priceAnnualMinor",
        currency = excluded.currency,
        limits = excluded.limits,
        features = excluded.features,
        "businessDecisionRequired" = false,
        active = true,
        "updatedAt" = now()
      `,
      [
        code,
        plan.displayNameKey,
        plan.priceMonthlyMinor,
        plan.priceAnnualMinor,
        JSON.stringify({
          maxConcurrentAttendees: plan.maxConcurrentAttendees,
          concurrentWebinars: code === "business" ? 10 : code === "professional" ? 2 : 1,
          recordingRetentionDays: plan.recordingRetentionDays,
          storageBytes: plan.storageBytes,
          aiQuota: 0,
          teamMembers: plan.teamMembers,
        }),
        JSON.stringify(plan.features),
      ],
    );
  }

  const selectedPlan = await client.query('select id from "Plan" where code = $1 and active = true', [
    planCode,
  ]);
  const planId = selectedPlan.rows[0].id;
  const workspaceId = workspace.rows[0].id;

  await client.query(
    'update "Subscription" set "deletedAt" = now(), status = $1 where "workspaceId" = $2 and "deletedAt" is null',
    ["CANCELLED", workspaceId],
  );

  await client.query(
    `
    insert into "Subscription" (
      "workspaceId",
      "planId",
      status,
      "billingProvider",
      "currentPeriodStart",
      "currentPeriodEnd"
    )
    values ($1, $2, 'ACTIVE', 'MANUAL', now(), now() + interval '1 year')
    `,
    [workspaceId, planId],
  );

  await client.query("commit");
  console.log(`Workspace "${workspace.rows[0].slug}" is now on ${planCode}.`);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
