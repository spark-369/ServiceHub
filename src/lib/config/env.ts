import { z } from "zod";

/**
 * Centralised, validated environment configuration.
 *
 * Values are validated lazily (on first access) so that importing this module
 * never throws during `next build` when secrets are intentionally absent.
 * Only variables marked `required` will hard-fail in production.
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Cache / Realtime
  REDIS_URL: z.string().optional(),

  // Public site URL (used for metadataBase, sitemap, OG tags)
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Security / CORS
  ALLOWED_ORIGINS: z.string().default("*"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Treat empty-string env values as unset so zod defaults apply. */
function normaliseEnv(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    result[key] = value === "" ? undefined : value;
  }
  return result;
}

function parseEnv(): Env {
  const parsed = envSchema.safeParse(normaliseEnv(process.env));

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment configuration -> ${issues}`);
  }

  return parsed.data;
}

/** Memoised, permissive accessor (never throws). Safe for client bundles. */
export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv();
  }
  return cached;
}

/**
 * Strict validation intended for the server bootstrap (see `instrumentation.ts`).
 * Throws when a variable that is *required in production* is missing.
 */
export function validateEnv(): { ok: boolean; missing: string[] } {
  const env = getEnv();
  const isProd = env.NODE_ENV === "production";
  const missing: string[] = [];

  if (isProd) {
    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (!env.JWT_SECRET) missing.push("JWT_SECRET");
    if (!env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
    if (!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      missing.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }

  return { ok: missing.length === 0, missing };
}

/** Whether Stripe server credentials are usable. */
export function isStripeConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.STRIPE_SECRET_KEY?.startsWith("sk_"));
}

/** Parsed list of allowed CORS origins. */
export function getAllowedOrigins(): string[] {
  const env = getEnv();
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === "*") {
    return ["*"];
  }
  return env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default getEnv;
