const CONFIGURED_API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000")
).replace(/\/$/, "");
const API_ORIGIN = process.env.NODE_ENV === "production" ? "" : CONFIGURED_API_ORIGIN;
const REALTIME_ORIGIN = (process.env.NEXT_PUBLIC_REALTIME_URL ?? CONFIGURED_API_ORIGIN).replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = fetch(`${API_ORIGIN}/v1/auth/csrf`, {
      credentials: "include",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok)
          throw new ApiError(
            response.status,
            "CSRF_UNAVAILABLE",
            "Request protection is unavailable",
          );
        const payload = (await response.json()) as { csrfToken: string };
        csrfToken = payload.csrfToken;
        return payload.csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

function isUnsafe(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (isUnsafe(method)) headers.set("x-csrf-token", await getCsrfToken());

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
      signal: options.signal ?? AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, "REQUEST_TIMEOUT", "The service took too long to respond");
    }
    throw new ApiError(0, "SERVICE_UNAVAILABLE", "The Laminaria API is not reachable");
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const body = payload as {
      code?: string;
      message?: string;
      details?: unknown;
      error?: { code?: string; message?: string; details?: unknown };
    };
    const errorBody = body.error ?? body;
    if (response.status === 403 && errorBody.code === "FORBIDDEN" && isUnsafe(method))
      csrfToken = null;
    throw new ApiError(
      response.status,
      errorBody.code ?? "REQUEST_FAILED",
      errorBody.message ?? `Request failed with status ${response.status}`,
      errorBody.details,
    );
  }

  return payload as T;
}

export const api = {
  origin: API_ORIGIN,
  realtimeOrigin: REALTIME_ORIGIN,
  authProviders: (signal?: AbortSignal) =>
    apiFetch<AuthProvidersPayload>("/v1/auth/providers", { signal }),
  me: (signal?: AbortSignal) => apiFetch<AuthPayload>("/v1/auth/me", { signal }),
  serviceStatus: (signal?: AbortSignal) =>
    apiFetch<ServiceStatusPayload>("/v1/system/services", { signal }),
  signIn: (input: { email: string; password: string }) =>
    apiFetch<AuthPayload>("/v1/auth/sign-in", { method: "POST", body: JSON.stringify(input) }),
  googleStartUrl: (locale: "en" | "ru") =>
    `${API_ORIGIN}/v1/auth/google/start?locale=${encodeURIComponent(locale)}`,
  signUp: (input: { name: string; email: string; password: string; locale: "en" | "ru" }) =>
    apiFetch<{ user: User; verificationRequired: boolean }>("/v1/auth/sign-up", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  signOut: () => apiFetch<void>("/v1/auth/sign-out", { method: "POST" }),
  updateProfile: (input: UpdateProfileInput) =>
    apiFetch<{ user: User }>("/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiFetch<void>("/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listSessions: () => apiFetch<{ sessions: AccountSession[] }>("/v1/auth/sessions"),
  revokeAllSessions: () =>
    apiFetch<void>("/v1/auth/sessions/revoke-all", { method: "POST" }),
  exportAccount: () => apiFetch<Record<string, unknown>>("/v1/auth/export"),
  deleteAccount: () =>
    apiFetch<void>("/v1/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
    }),
  uploadImage: (kind: "avatar" | "workspace-logo" | "webinar-cover", dataUrl: string) =>
    apiFetch<{ url: string }>("/v1/uploads/images", {
      method: "POST",
      body: JSON.stringify({ kind, dataUrl }),
    }),
  forgotPassword: (email: string) =>
    apiFetch<{ accepted: true }>("/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    apiFetch<void>("/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  verifyEmail: (token: string) =>
    apiFetch<void>("/v1/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  listWorkspaces: () => apiFetch<{ workspaces: Workspace[] }>("/v1/workspaces"),
  createWorkspace: (input: { name: string; slug: string }) =>
    apiFetch<{ workspace: Workspace }>("/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  workspaceSettings: (workspaceId: string) =>
    apiFetch<WorkspaceSettingsPayload>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/settings`,
    ),
  updateWorkspaceSettings: (workspaceId: string, input: UpdateWorkspaceInput) =>
    apiFetch<{ workspace: WorkspaceSettings }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/settings`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  deleteWorkspace: (workspaceId: string) =>
    apiFetch<void>(`/v1/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
    }),
  listWorkspaceMembers: (workspaceId: string) =>
    apiFetch<{ members: WorkspaceMember[] }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
    ),
  addWorkspaceMember: (
    workspaceId: string,
    input: { email: string; role: Exclude<WorkspaceRole, "OWNER"> },
  ) =>
    apiFetch<{ member: Pick<WorkspaceMember, "userId" | "role"> }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateWorkspaceMember: (
    workspaceId: string,
    userId: string,
    role: Exclude<WorkspaceRole, "OWNER">,
  ) =>
    apiFetch<{ member: Pick<WorkspaceMember, "userId" | "role"> }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      { method: "PATCH", body: JSON.stringify({ role }) },
    ),
  removeWorkspaceMember: (workspaceId: string, userId: string) =>
    apiFetch<void>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ),
  listWebinars: (workspaceId: string) =>
    apiFetch<{ webinars: Webinar[] }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars`),
  createWebinar: (workspaceId: string, input: CreateWebinarInput) =>
    apiFetch<{ webinar: Webinar }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  transitionWebinar: (
    workspaceId: string,
    webinarId: string,
    status: WebinarStatus,
    version: number,
  ) =>
    apiFetch<{ webinar: Webinar }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/transitions`,
      { method: "POST", body: JSON.stringify({ status, version }) },
    ),
  endWebinar: (webinarId: string) =>
    apiFetch<{ webinar: Webinar }>(`/v1/webinars/${encodeURIComponent(webinarId)}/end`, {
      method: "POST",
    }),
  hostPrejoin: (workspaceId: string, webinarId: string) =>
    apiFetch<PrejoinPayload>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/prejoin`,
      { method: "POST" },
    ),
  assignWebinarHost: (
    workspaceId: string,
    webinarId: string,
    input: { email: string; role: "COHOST" | "MODERATOR" | "SPEAKER" },
  ) =>
    apiFetch<{
      host: {
        userId: string;
        email: string;
        name: string;
        role: "COHOST" | "MODERATOR" | "SPEAKER";
      };
    }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/hosts`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  listWebinarRegistrations: (workspaceId: string, webinarId: string) =>
    apiFetch<{ registrations: Registration[] }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/registrations`,
    ),
  listRecordings: (workspaceId: string, webinarId: string) =>
    apiFetch<{ recordings: Recording[] }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/recordings`,
    ),
  startRecording: (workspaceId: string, webinarId: string) =>
    apiFetch<{ recordings: Recording[] }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/recordings/start`,
      { method: "POST" },
    ),
  publicRecording: (recordingId: string) =>
    apiFetch<PublicRecording>(`/v1/public/recordings/${encodeURIComponent(recordingId)}`),
  deleteRecording: (workspaceId: string, webinarId: string, recordingId: string) =>
    apiFetch<void>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}/recordings/${encodeURIComponent(recordingId)}`,
      { method: "DELETE" },
    ),
  deleteWebinar: (workspaceId: string, webinarId: string) =>
    apiFetch<void>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/webinars/${encodeURIComponent(webinarId)}`,
      { method: "DELETE" },
    ),
  publicWebinar: (slug: string, signal?: AbortSignal) =>
    apiFetch<{ webinar: PublicWebinar }>(`/v1/public/webinars/${encodeURIComponent(slug)}`, {
      signal,
    }),
  register: (
    slug: string,
    input: { email: string; phone: string; name: string; locale: "en" | "ru" },
  ) =>
    apiFetch<RegistrationPayload>(`/v1/public/webinars/${encodeURIComponent(slug)}/registrations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  confirmRegistration: (token: string) =>
    apiFetch<{ registration: Registration; accessToken: string }>(
      "/v1/public/registrations/confirm",
      {
        method: "POST",
        body: JSON.stringify({ token }),
      },
    ),
  prejoin: (slug: string, input: { accessToken?: string; guestName?: string }) =>
    apiFetch<PrejoinPayload>(`/v1/public/webinars/${encodeURIComponent(slug)}/prejoin`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export interface User {
  id: string;
  email: string;
  name: string;
  locale: "en" | "ru";
  avatarUrl?: string | null;
  timezone?: string;
  preferences?: UserPreferences;
  emailVerifiedAt?: string | null;
}

export interface AuthPayload {
  user: User;
  sessionExpiresAt: string;
}

export interface AuthProvidersPayload {
  google: { enabled: boolean };
}

export interface ServiceStatus {
  key: "livekit" | "mail" | "google" | "ai" | "billing" | "storage";
  label: string;
  configured: boolean;
  requiredEnv: string[];
}

export interface ServiceStatusPayload {
  services: ServiceStatus[];
}

export type WorkspaceRole = "OWNER" | "ADMIN" | "HOST" | "MODERATOR" | "ANALYST" | "MEMBER";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role?: WorkspaceRole;
  logoUrl?: string | null;
  timezone?: string;
}

export interface UserPreferences {
  notifications?: {
    registrationConfirmation?: boolean;
    webinarReminder?: boolean;
    teamInvitation?: boolean;
    recordingReady?: boolean;
  };
  devices?: {
    cameraId?: string;
    microphoneId?: string;
    speakerId?: string;
    videoQuality?: "auto" | "360p" | "480p" | "720p" | "1080p";
  };
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
  locale?: "en" | "ru";
  timezone?: string;
  preferences?: UserPreferences;
}

export interface WebinarDefaults {
  language: "en" | "ru";
  timezone: string;
  access: "PUBLIC" | "PRIVATE";
  allowGuests: boolean;
  requireRegistration: boolean;
  autoRecording: boolean;
  viewerChat: boolean;
}

export interface PollDefaults {
  enabled: boolean;
  anonymousVoting: boolean;
  resultsVisibility: "LIVE" | "AFTER_CLOSE";
}

export interface BrandingSettings {
  accentColor: string;
  coverImageUrl: string | null;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  locale: "en" | "ru";
  timezone: string;
  settings: {
    webinarDefaults?: WebinarDefaults;
    polls?: PollDefaults;
    branding?: BrandingSettings;
  };
}

export interface WorkspaceSettingsPayload {
  workspace: WorkspaceSettings;
  role: WorkspaceRole;
  planCode: string;
  usage: { members: number; webinars: number; recordings: number; storageBytes: number };
}

export interface UpdateWorkspaceInput {
  name?: string;
  logoUrl?: string | null;
  locale?: "en" | "ru";
  timezone?: string;
  settings?: {
    webinarDefaults?: WebinarDefaults;
    polls?: PollDefaults;
    branding?: BrandingSettings;
  };
}

export interface AccountSession {
  id: string;
  current: boolean;
  lastSeenAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export type WebinarStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED" | "ARCHIVED";
export type WebinarRole =
  "OWNER" | "HOST" | "COHOST" | "MODERATOR" | "SPEAKER" | "ATTENDEE" | "GUEST";

export interface Webinar {
  id: string;
  workspaceId: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  status: WebinarStatus;
  scheduledStartAt: string | null;
  timezone: string;
  language: "en" | "ru";
  visibility: "PUBLIC" | "PRIVATE";
  allowGuests: boolean;
  requireEmailRegistration: boolean;
  maxAttendees: number | null;
  recordingEnabled: boolean;
  startedAt: string | null;
  endedAt: string | null;
  version: number;
  currentUserRole?: WebinarRole | null;
}

export type RecordingStatus =
  | "PENDING"
  | "RECORDING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "DELETED";

export interface Recording {
  id: string;
  webinarSessionId: string;
  provider: string;
  externalId: string | null;
  status: RecordingStatus;
  playbackUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  startedAt: string | null;
  endedAt: string | null;
  availableAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
}

export interface PublicRecording {
  recording: Recording;
  webinar: { id: string; slug: string; title: string };
  chat: Array<{
    id: string;
    author: {
      id: string;
      displayName: string;
      role: "OWNER" | "HOST" | "COHOST" | "MODERATOR" | "SPEAKER" | "ATTENDEE" | "GUEST";
    };
    body: string;
    status: "visible" | "pending_review" | "deleted";
    createdAt: string;
  }>;
}

export type PublicWebinar = Pick<
  Webinar,
  | "slug"
  | "title"
  | "description"
  | "coverImageUrl"
  | "status"
  | "scheduledStartAt"
  | "timezone"
  | "language"
  | "visibility"
  | "allowGuests"
  | "requireEmailRegistration"
> & {
  branding: {
    companyName: string | null;
    logoUrl: string | null;
    accentColor: string;
    coverImageUrl: string | null;
  };
};

export interface CreateWebinarInput {
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  scheduledStartAt: string | null;
  timezone: string;
  language: "en" | "ru";
  visibility: "PUBLIC" | "PRIVATE";
  allowGuests: boolean;
  requireEmailRegistration: boolean;
  maxAttendees: number | null;
}

export interface PrejoinPayload {
  workspaceId?: string;
  webinarId: string;
  recordingEnabled?: boolean;
  polls?: PollDefaults;
  media: {
    roomName: string;
    url: string;
    token: string;
    expiresInSeconds: number;
    identity: string;
  };
  realtimeToken: string;
  participant: {
    identity: string;
    displayName: string;
    role: WebinarRole;
  };
}

export interface Registration {
  id: string;
  webinarId: string;
  email: string;
  phone: string;
  name: string;
  locale: "en" | "ru";
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

export interface RegistrationPayload {
  registration: Registration;
  accessToken: string | null;
  confirmationRequired: boolean;
}

export function friendlyError(error: unknown, locale: string) {
  const code = error instanceof ApiError ? error.code : "UNKNOWN";
  const russian = locale === "ru";
  if (error instanceof ApiError && error.status === 409) {
    return russian
      ? "Эта почта или ссылка уже занята. Используйте другую или войдите через уже созданную."
      : "This email or link is already used. Use another one or sign in with the existing account.";
  }
  if (error instanceof ApiError && code === "SERVICE_NOT_CONFIGURED") {
    return serviceNotConfiguredMessage(error.message, russian);
  }
  const messages: Record<string, [string, string]> = {
    SERVICE_UNAVAILABLE: [
      "The service is not reachable. Check that the API is running.",
      "Сервис недоступен. Проверьте, запущен ли API.",
    ],
    SERVICE_NOT_CONFIGURED: [
      "This service has not been configured yet.",
      "Этот сервис ещё не настроен.",
    ],
    UNAUTHENTICATED: ["Sign in to continue.", "Войдите, чтобы продолжить."],
    UNAUTHORIZED: ["Sign in to continue.", "Войдите, чтобы продолжить."],
    FORBIDDEN: [
      "Your role does not allow this action.",
      "Ваша роль не позволяет выполнить это действие.",
    ],
    VALIDATION_ERROR: [
      "Review the highlighted information and try again.",
      "Проверьте введённые данные и попробуйте снова.",
    ],
    BAD_REQUEST: ["Review the information and try again.", "Проверьте данные и попробуйте снова."],
    RATE_LIMITED: [
      "Too many attempts. Wait a moment and try again.",
      "Слишком много попыток. Подождите и попробуйте снова.",
    ],
  };
  const pair = messages[code];
  if (pair) return russian ? pair[1] : pair[0];
  if (error instanceof ApiError && error.status > 0) return error.message;
  return russian
    ? "Что-то нарушило ход работы. Попробуйте снова."
    : "Something interrupted the flow. Try again.";
}

function serviceNotConfiguredMessage(message: string, russian: boolean) {
  if (/livekit/i.test(message)) {
    return russian
      ? "LiveKit не настроен. Добавьте LIVEKIT_URL, LIVEKIT_API_KEY и LIVEKIT_API_SECRET в .env, затем перезапустите API."
      : "LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env, then restart the API.";
  }
  if (/mail/i.test(message)) {
    return russian
      ? "Почта не настроена. Для локальной разработки можно отключить подтверждение email или добавить SMTP_HOST и EMAIL_FROM."
      : "Email delivery is not configured. For local development, disable email confirmation or add SMTP_HOST and EMAIL_FROM.";
  }
  return russian
    ? "Этот сервис ещё не настроен. Проверьте экран Settings."
    : "This service has not been configured yet. Check Settings.";
}
