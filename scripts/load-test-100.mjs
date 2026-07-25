import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const requireFromApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { Client } = requireFromApi("pg");
const { io } = requireFromApi("socket.io-client");

const baseUrl = process.env.LAMINARIA_API_URL ?? "http://127.0.0.1:4100";
const databaseUrl = process.env.DATABASE_URL;
const tokenPepper = process.env.TOKEN_PEPPER;
if (!databaseUrl || !tokenPepper) throw new Error("DATABASE_URL and TOKEN_PEPPER are required");

const runId = randomUUID().slice(0, 12);
const credentials = {
  email: `load-${runId}@example.test`,
  password: `Load-${runId}-Password!`,
  name: "Load Test Owner",
};
const cookies = new Map();
let accountCreated = false;
const sockets = [];

function storeCookies(headers) {
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookies.size)
    headers.cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  if (method !== "GET" && cookies.has("laminaria_csrf")) {
    headers["x-csrf-token"] = cookies.get("laminaria_csrf");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  storeCookies(response.headers);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

function issueRealtimeToken({ subject, webinarId, role, name }, ttlSeconds = 900) {
  const encoded = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: subject,
      webinarId,
      role,
      name,
      exp: Math.floor(Date.now() / 1_000) + ttlSeconds,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", tokenPepper)
    .update("laminaria-participant-v1\0")
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

async function retry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw lastError;
}

function connectViewer(index, webinarId) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const token = issueRealtimeToken({
      subject: `guest:load-${runId}-${index}`,
      webinarId,
      role: "GUEST",
      name: `Viewer ${index}`,
    });
    const socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 15_000,
      extraHeaders: { origin: "http://127.0.0.1:3000" },
    });
    sockets.push(socket);
    const fail = (stage, error) => {
      socket.disconnect();
      resolve({ ok: false, stage, error: error instanceof Error ? error.message : String(error) });
    };
    socket.once("connect_error", (error) => fail("connect", error));
    socket.once("connect", () => {
      socket.emit("webinar:join", { webinarId }, (acknowledgement) => {
        if (!acknowledgement?.ok) {
          fail("join", acknowledgement?.error?.code ?? "unknown");
          return;
        }
        resolve({ ok: true, latencyMs: performance.now() - startedAt, socket });
      });
    });
  });
}

async function setProfessionalPlan(workspaceId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    const plan = await client.query(
      `insert into "Plan" (
        id, code, "displayNameKey", "priceMonthlyMinor", "priceAnnualMinor",
        currency, limits, features, "businessDecisionRequired", active, "createdAt", "updatedAt"
      ) values (
        $1, 'professional', 'plans.professional', 1200, 12000, 'USD',
        $2::jsonb, $3::jsonb, false, true, now(), now()
      )
      on conflict (code) do update set
        limits = excluded.limits, features = excluded.features, active = true, "updatedAt" = now()
      returning id`,
      [
        randomUUID(),
        JSON.stringify({
          maxConcurrentAttendees: 100,
          concurrentWebinars: 2,
          recordingRetentionDays: 30,
          storageBytes: 10 * 1024 * 1024 * 1024,
          aiQuota: 0,
          teamMembers: 1,
        }),
        JSON.stringify({
          webinarRecording: true,
          polls: true,
          advancedModeration: true,
          advancedAnalytics: true,
          customLogo: true,
          removeLaminariaBranding: false,
          dataExport: true,
          apiAccess: false,
          workspaceTeam: false,
        }),
      ],
    );
    await client.query(
      `insert into "Subscription" (
        id, "workspaceId", "planId", status, "billingProvider",
        "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt"
      ) values ($1, $2, $3, 'ACTIVE', 'MANUAL', now(), now() + interval '1 day', now(), now())`,
      [randomUUID(), workspaceId, plan.rows[0].id],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

try {
  await request("/v1/auth/csrf");
  const signUp = await request("/v1/auth/sign-up", {
    method: "POST",
    body: { ...credentials, locale: "en" },
  });
  if (signUp.response.status !== 202)
    throw new Error(`Registration failed: ${signUp.response.status}`);
  accountCreated = true;
  const signIn = await request("/v1/auth/sign-in", {
    method: "POST",
    body: { email: credentials.email, password: credentials.password },
  });
  if (signIn.response.status !== 200) throw new Error(`Sign-in failed: ${signIn.response.status}`);

  const workspaceResult = await request("/v1/workspaces", {
    method: "POST",
    body: { name: "100 Viewer Load Test", slug: `load-${runId}` },
  });
  if (workspaceResult.response.status !== 201)
    throw new Error(`Workspace failed: ${workspaceResult.response.status}`);
  const workspaceId = workspaceResult.payload.workspace.id;
  await retry(() => setProfessionalPlan(workspaceId));

  const rejected = await request(`/v1/workspaces/${workspaceId}/webinars`, {
    method: "POST",
    body: {
      slug: `over-limit-${runId}`,
      title: "Over limit",
      allowGuests: true,
      requireEmailRegistration: false,
      maxAttendees: 101,
    },
  });
  if (![400, 402, 403].includes(rejected.response.status)) {
    throw new Error(`Pro limit did not reject 101 attendees: ${rejected.response.status}`);
  }

  const created = await request(`/v1/workspaces/${workspaceId}/webinars`, {
    method: "POST",
    body: {
      slug: `load-${runId}`,
      title: "100 Viewer Load Test",
      description: "Temporary automated test",
      scheduledStartAt: new Date(Date.now() + 60_000).toISOString(),
      timezone: "UTC",
      language: "en",
      visibility: "PUBLIC",
      allowGuests: true,
      requireEmailRegistration: false,
      maxAttendees: 100,
    },
  });
  if (created.response.status !== 201)
    throw new Error(`Webinar creation failed: ${created.response.status}`);
  let webinar = created.payload.webinar;
  const scheduled = await request(
    `/v1/workspaces/${workspaceId}/webinars/${webinar.id}/transitions`,
    {
      method: "POST",
      body: { status: "SCHEDULED", version: webinar.version },
    },
  );
  if (scheduled.response.status !== 200)
    throw new Error(`Schedule failed: ${scheduled.response.status}`);
  webinar = scheduled.payload.webinar;
  const live = await request(`/v1/workspaces/${workspaceId}/webinars/${webinar.id}/transitions`, {
    method: "POST",
    body: { status: "LIVE", version: webinar.version },
  });
  if (live.response.status !== 200) throw new Error(`Go-live failed: ${live.response.status}`);
  webinar = live.payload.webinar;
  const recordingResult = await request(
    `/v1/workspaces/${workspaceId}/webinars/${webinar.id}/recordings`,
  );
  if (recordingResult.response.status !== 200 || recordingResult.payload.recordings.length !== 1) {
    throw new Error(`Automatic recording catalog failed: ${recordingResult.response.status}`);
  }
  const automaticRecording = recordingResult.payload.recordings[0];

  const startedAt = performance.now();
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, index) => connectViewer(index + 1, webinar.id)),
  );
  const elapsedMs = performance.now() - startedAt;
  const successes = results.filter((result) => result.ok);
  const failures = results.filter((result) => !result.ok);
  const latencies = successes.map((result) => result.latencyMs);

  const hostToken = issueRealtimeToken({
    subject: `user:${signIn.payload.user.id}`,
    webinarId: webinar.id,
    role: "OWNER",
    name: credentials.name,
  });
  const host = io(baseUrl, {
    auth: { token: hostToken },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 15_000,
    extraHeaders: { origin: "http://127.0.0.1:3000" },
  });
  sockets.push(host);
  await new Promise((resolve, reject) => {
    host.once("connect_error", reject);
    host.once("connect", () => {
      host.emit("webinar:join", { webinarId: webinar.id }, (acknowledgement) => {
        if (!acknowledgement?.ok) reject(new Error("Host join failed"));
        else resolve();
      });
    });
  });
  await new Promise((resolve, reject) => {
    host.emit(
      "chat:set_state",
      { webinarId: webinar.id, idempotencyKey: `chat-state-${runId}`, enabled: true },
      (acknowledgement) =>
        acknowledgement?.ok ? resolve() : reject(new Error("Chat enable failed")),
    );
  });
  const chatResults = await Promise.all(
    successes.slice(0, 20).map(
      (result, index) =>
        new Promise((resolve) => {
          result.socket.emit(
            "chat:send",
            {
              webinarId: webinar.id,
              idempotencyKey: `load-chat-${runId}-${index}`,
              body: `Load test message ${index + 1}`,
            },
            (acknowledgement) => resolve(Boolean(acknowledgement?.ok)),
          );
        }),
    ),
  );

  console.log(
    JSON.stringify(
      {
        scenario: "100 simultaneous realtime viewers",
        viewerConnections: {
          attempted: 100,
          joined: successes.length,
          failed: failures.length,
          elapsedMs: Math.round(elapsedMs),
          p50Ms: Math.round(percentile(latencies, 0.5)),
          p95Ms: Math.round(percentile(latencies, 0.95)),
          maxMs: Math.round(Math.max(...latencies, 0)),
        },
        chat: { attempted: 20, accepted: chatResults.filter(Boolean).length },
        recordingFallback: {
          catalogEntryCreated: true,
          status: automaticRecording.status,
          failureCode: automaticRecording.failureCode,
        },
        planLimit: { proMaximum: 100, rejectedAt: 101, passed: true },
        failures: failures.slice(0, 10).map(({ stage, error }) => ({ stage, error })),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of sockets) socket.disconnect();
  if (accountCreated && cookies.has("laminaria_session")) {
    await request("/v1/auth/account", { method: "DELETE", body: { confirmation: "DELETE" } });
  }
}
