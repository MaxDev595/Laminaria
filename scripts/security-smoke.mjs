import { randomUUID } from "node:crypto";

const baseUrl = process.env.LAMINARIA_API_URL ?? "http://127.0.0.1:4100";
const runId = randomUUID().slice(0, 12);
const credentials = {
  email: `security-${runId}@example.test`,
  password: `Audit-${runId}-Password!`,
  name: "Security Audit",
};
const cookies = new Map();
const checks = [];

function assert(name, condition, details) {
  checks.push({ name, passed: Boolean(condition), details });
  if (!condition) throw new Error(`${name}: ${details}`);
}

function storeCookies(headers) {
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function request(path, { method = "GET", body, csrf = true, origin, cookie = true } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (origin) headers.origin = origin;
  if (cookie && cookies.size) {
    headers.cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }
  if (csrf && method !== "GET" && method !== "HEAD" && cookies.has("laminaria_csrf")) {
    headers["x-csrf-token"] = cookies.get("laminaria_csrf");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
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

let accountCreated = false;

try {
  const live = await request("/health/live");
  assert("health/live", live.response.status === 200, `status ${live.response.status}`);

  const unauthenticatedMe = await request("/v1/auth/me");
  assert(
    "protected auth/me",
    unauthenticatedMe.response.status === 401,
    `status ${unauthenticatedMe.response.status}`,
  );

  const unauthenticatedWorkspaces = await request("/v1/workspaces");
  assert(
    "protected workspaces",
    unauthenticatedWorkspaces.response.status === 401,
    `status ${unauthenticatedWorkspaces.response.status}`,
  );

  const preflight = await fetch(`${baseUrl}/v1/workspaces`, {
    method: "OPTIONS",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "GET",
    },
  });
  assert(
    "CORS rejects unknown origin",
    !preflight.headers.get("access-control-allow-origin"),
    `allow-origin ${preflight.headers.get("access-control-allow-origin")}`,
  );

  const csrf = await request("/v1/auth/csrf");
  assert(
    "CSRF token issued",
    csrf.response.status === 200 && typeof csrf.payload?.csrfToken === "string",
    `status ${csrf.response.status}`,
  );

  const signUp = await request("/v1/auth/sign-up", {
    method: "POST",
    body: { ...credentials, locale: "en" },
  });
  assert("registration", signUp.response.status === 202, `status ${signUp.response.status}`);
  accountCreated = true;

  const unknownReset = await request("/v1/auth/forgot-password", {
    method: "POST",
    body: { email: `unknown-${runId}@example.test` },
  });
  const knownReset = await request("/v1/auth/forgot-password", {
    method: "POST",
    body: { email: credentials.email },
  });
  assert(
    "password reset resists enumeration",
    unknownReset.response.status === 202 &&
      knownReset.response.status === 202 &&
      JSON.stringify(unknownReset.payload) === JSON.stringify(knownReset.payload),
    `statuses ${unknownReset.response.status}/${knownReset.response.status}`,
  );

  const badSignIn = await request("/v1/auth/sign-in", {
    method: "POST",
    body: { email: credentials.email, password: `${credentials.password}-wrong` },
  });
  assert(
    "wrong password rejected",
    badSignIn.response.status === 401,
    `status ${badSignIn.response.status}`,
  );

  const injectionSignIn = await request("/v1/auth/sign-in", {
    method: "POST",
    body: { email: "admin@example.test' OR 1=1--", password: "irrelevant" },
  });
  assert(
    "injection-shaped login rejected",
    [400, 401].includes(injectionSignIn.response.status),
    `status ${injectionSignIn.response.status}`,
  );

  const signIn = await request("/v1/auth/sign-in", {
    method: "POST",
    body: { email: credentials.email, password: credentials.password },
  });
  assert(
    "sign in",
    signIn.response.status === 200 && cookies.has("laminaria_session"),
    `status ${signIn.response.status}`,
  );

  const me = await request("/v1/auth/me");
  assert(
    "session persists",
    me.response.status === 200 && me.payload?.user?.email === credentials.email,
    `status ${me.response.status}`,
  );

  const missingCsrf = await request("/v1/workspaces", {
    method: "POST",
    csrf: false,
    body: { name: "Blocked Workspace", slug: `blocked-${runId}` },
  });
  assert(
    "CSRF required",
    missingCsrf.response.status === 403,
    `status ${missingCsrf.response.status}`,
  );

  const workspace = await request("/v1/workspaces", {
    method: "POST",
    body: { name: "Security Workspace", slug: `security-${runId}` },
  });
  assert(
    "workspace creation",
    workspace.response.status === 201 && workspace.payload?.workspace?.id,
    `status ${workspace.response.status}`,
  );

  const inaccessibleWorkspace = await request(`/v1/workspaces/${randomUUID()}`);
  assert(
    "cross-workspace access denied",
    [403, 404].includes(inaccessibleWorkspace.response.status),
    `status ${inaccessibleWorkspace.response.status}`,
  );

  const profile = await request("/v1/auth/profile", {
    method: "PATCH",
    body: { name: "Security Audit Updated", email: "takeover@example.test", role: "OWNER" },
  });
  assert(
    "mass assignment stripped",
    profile.response.status === 200 &&
      profile.payload?.user?.email === credentials.email &&
      profile.payload?.user?.name === "Security Audit Updated",
    `status ${profile.response.status}`,
  );

  let finalResetStatus = 0;
  for (let index = 0; index < 5; index += 1) {
    const limited = await request("/v1/auth/forgot-password", {
      method: "POST",
      body: { email: `rate-${runId}@example.test` },
    });
    finalResetStatus = limited.response.status;
    if (finalResetStatus === 429) break;
  }
  assert("password reset rate limit", finalResetStatus === 429, `last status ${finalResetStatus}`);
} finally {
  if (accountCreated && cookies.has("laminaria_session")) {
    const deleted = await request("/v1/auth/account", {
      method: "DELETE",
      body: { confirmation: "DELETE" },
    });
    assert(
      "test account cleanup",
      deleted.response.status === 204,
      `status ${deleted.response.status}`,
    );
  }
}

console.log(
  JSON.stringify(
    { passed: checks.filter((check) => check.passed).length, total: checks.length, checks },
    null,
    2,
  ),
);
