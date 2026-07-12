import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalProvider = z.preprocess(
  (value) =>
    value === "" || (typeof value === "string" && value.toLowerCase() === "disabled")
      ? undefined
      : value,
  z.string().min(1).optional(),
);

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    TRUST_PROXY: booleanString,
    PUBLIC_API_URL: z.url().default("http://localhost:4000"),
    WEB_APP_URL: z.url().default("http://localhost:3000"),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("laminaria_session"),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(900).max(31_536_000).default(2_592_000),
    SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().min(300).max(31_536_000).default(604_800),
    CSRF_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("laminaria_csrf"),
    TOKEN_PEPPER: z.string().min(32),
    SKIP_EMAIL_VERIFICATION: booleanString,
    LIVEKIT_URL: optionalUrl,
    LIVEKIT_API_KEY: optionalString,
    LIVEKIT_API_SECRET: optionalString,
    LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    SMTP_SECURE: booleanString,
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM: optionalString,
    PHONE_AUTH_DEV_CODE: z.string().regex(/^[0-9]{6}$/).default("000000"),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GOOGLE_REDIRECT_URI: optionalUrl,
    AI_PROVIDER: optionalProvider,
    AI_API_KEY: optionalString,
    AI_MODEL: optionalString,
    BILLING_PROVIDER: optionalProvider,
    BILLING_API_KEY: optionalString,
    BILLING_WEBHOOK_SECRET: optionalString,
    STORAGE_ENDPOINT: optionalUrl,
    STORAGE_REGION: optionalString,
    STORAGE_BUCKET: optionalString,
    STORAGE_ACCESS_KEY_ID: optionalString,
    STORAGE_SECRET_ACCESS_KEY: optionalString,
  })
  .superRefine((env, context) => {
    const allOrNone = (keys: (keyof typeof env)[], service: string) => {
      const configured = keys.filter((key) => Boolean(env[key]));
      if (configured.length > 0 && configured.length < keys.length) {
        const missingKey = keys.find((key) => !env[key]) ?? keys[0] ?? "configuration";
        context.addIssue({
          code: "custom",
          path: [missingKey],
          message: `${service} configuration must be complete or entirely omitted`,
        });
      }
    };

    allOrNone(["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"], "LiveKit");
    allOrNone(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google");
    allOrNone(["SMTP_HOST", "EMAIL_FROM"], "Mail");
    if (env.SMTP_PASSWORD && !env.SMTP_USER) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_USER"],
        message: "SMTP_USER is required when SMTP_PASSWORD is set",
      });
    }
    allOrNone(["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"], "AI");
    allOrNone(["BILLING_PROVIDER", "BILLING_API_KEY", "BILLING_WEBHOOK_SECRET"], "Billing");
    allOrNone(
      [
        "STORAGE_ENDPOINT",
        "STORAGE_REGION",
        "STORAGE_BUCKET",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
      ],
      "Storage",
    );
  });

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  logLevel: string;
  trustProxy: boolean;
  publicApiUrl: string;
  webAppUrl: string;
  corsOrigins: readonly string[];
  databaseUrl: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  sessionIdleTtlSeconds: number;
  csrfCookieName: string;
  tokenPepper: string;
  skipEmailVerification: boolean;
  livekit: Readonly<{ url: string; apiKey: string; apiSecret: string; tokenTtlSeconds: number }> | null;
  mail: Readonly<{
    host: string;
    port: number;
    secure: boolean;
    username: string | null;
    password: string | null;
    from: string;
  }> | null;
  phoneAuth: Readonly<{ devCode: string }>;
  google: Readonly<{ clientId: string; clientSecret: string; redirectUri: string }> | null;
  ai: Readonly<{ provider: string; apiKey: string; model: string }> | null;
  billing: Readonly<{ provider: string; apiKey: string; webhookSecret: string }> | null;
  storage: Readonly<{
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }> | null;
}>;

function configured<T extends Record<string, string | undefined>>(
  value: T,
): { [K in keyof T]: string } | null {
  return Object.values(value).every(Boolean) ? (value as { [K in keyof T]: string }) : null;
}

export function parseConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid API configuration: ${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  const livekitBase = configured({
    url: env.LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
  });

  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxy: env.TRUST_PROXY,
    publicApiUrl: env.PUBLIC_API_URL,
    webAppUrl: env.WEB_APP_URL,
    corsOrigins: [...new Set(env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean))],
    databaseUrl: env.DATABASE_URL,
    sessionCookieName: env.SESSION_COOKIE_NAME,
    sessionTtlSeconds: env.SESSION_TTL_SECONDS,
    sessionIdleTtlSeconds: env.SESSION_IDLE_TTL_SECONDS,
    csrfCookieName: env.CSRF_COOKIE_NAME,
    tokenPepper: env.TOKEN_PEPPER,
    skipEmailVerification: env.SKIP_EMAIL_VERIFICATION,
    livekit: livekitBase ? { ...livekitBase, tokenTtlSeconds: env.LIVEKIT_TOKEN_TTL_SECONDS } : null,
    mail:
      env.SMTP_HOST && env.EMAIL_FROM
        ? {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            username: env.SMTP_USER ?? null,
            password: env.SMTP_PASSWORD ?? null,
            from: env.EMAIL_FROM,
          }
        : null,
    phoneAuth: { devCode: env.PHONE_AUTH_DEV_CODE },
    google: configured({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI ?? `${env.PUBLIC_API_URL}/v1/auth/google/callback`,
    }),
    ai: configured({ provider: env.AI_PROVIDER, apiKey: env.AI_API_KEY, model: env.AI_MODEL }),
    billing: configured({
      provider: env.BILLING_PROVIDER,
      apiKey: env.BILLING_API_KEY,
      webhookSecret: env.BILLING_WEBHOOK_SECRET,
    }),
    storage: configured({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    }),
  };
}
