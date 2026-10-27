/**
 * Unit tests for the validated environment configuration (`src/lib/config/env.ts`).
 *
 * The module memoises its parse result, so every test loads a FRESH module
 * instance (after `jest.resetModules()`) to start from a clean cache. Env vars
 * touched by the tests are snapshotted and restored in `afterEach` so nothing
 * leaks into other suites running in the same worker.
 */

type EnvModule = typeof import("@/lib/config/env");

const TOUCHED_KEYS = [
  "ALLOWED_ORIGINS",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "RATE_LIMIT_MAX",
  "RATE_LIMIT_WINDOW_MS",
  "AUTH_RATE_LIMIT_MAX",
  "NODE_ENV",
];

async function loadEnvModule(): Promise<EnvModule> {
  return (await import("@/lib/config/env")) as EnvModule;
}

/**
 * Set `NODE_ENV` for a test.
 *
 * Next.js augments Node's `ProcessEnv` with a `readonly NODE_ENV` declaration
 * (`next/types/global.d.ts`), so a direct `process.env.NODE_ENV = …` assignment
 * is a compile error. Writing through an index-signature view of the object is
 * the standard way to mutate it from a test.
 */
function setNodeEnv(value: "development" | "production" | "test"): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("lib/config/env", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of TOUCHED_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    // Fresh module instance per test — the real module caches its parse result.
    jest.resetModules();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("getEnv", () => {
    it("applies schema defaults for optional values", async () => {
      const { getEnv } = await loadEnvModule();
      const env = getEnv();

      expect(env.ALLOWED_ORIGINS).toBe("*");
      expect(env.RATE_LIMIT_MAX).toBe(100);
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
      expect(env.AUTH_RATE_LIMIT_MAX).toBe(10);
    });

    it("memoises the parsed result", async () => {
      const { getEnv } = await loadEnvModule();
      expect(getEnv()).toBe(getEnv());
    });

    it("treats empty-string values as unset so defaults apply", async () => {
      process.env.ALLOWED_ORIGINS = "";
      const { getEnv } = await loadEnvModule();
      expect(getEnv().ALLOWED_ORIGINS).toBe("*");
    });

    it("coerces numeric env values to numbers", async () => {
      process.env.RATE_LIMIT_MAX = "25";
      const { getEnv } = await loadEnvModule();
      expect(getEnv().RATE_LIMIT_MAX).toBe(25);
    });

    it("throws when a present value violates the schema", async () => {
      process.env.JWT_SECRET = "short";
      const { getEnv } = await loadEnvModule();
      expect(() => getEnv()).toThrow(/Invalid environment configuration/);
    });
  });

  describe("getAllowedOrigins", () => {
    it("returns the wildcard singleton when origins are unrestricted", async () => {
      const { getAllowedOrigins } = await loadEnvModule();
      expect(getAllowedOrigins()).toEqual(["*"]);
    });

    it("parses a comma-separated allow-list (trimmed, no empties)", async () => {
      process.env.ALLOWED_ORIGINS = "https://a.example.com, https://b.example.com ,,";
      const { getAllowedOrigins } = await loadEnvModule();
      expect(getAllowedOrigins()).toEqual([
        "https://a.example.com",
        "https://b.example.com",
      ]);
    });
  });

  describe("isStripeConfigured", () => {
    it("is true only for sk_ secret keys", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_1234567890";
      const { isStripeConfigured } = await loadEnvModule();
      expect(isStripeConfigured()).toBe(true);

      // `getEnv()` memoises its parse result, so a fresh module instance is
      // required to observe a changed value.
      jest.resetModules();
      process.env.STRIPE_SECRET_KEY = "pk_test_not_a_secret";
      const reloaded = await loadEnvModule();
      expect(reloaded.isStripeConfigured()).toBe(false);
    });

    it("is false when no key is set", async () => {
      const { isStripeConfigured } = await loadEnvModule();
      expect(isStripeConfigured()).toBe(false);
    });
  });

  describe("validateEnv", () => {
    it("reports ok outside production without any secrets", async () => {
      setNodeEnv("test");
      const { validateEnv } = await loadEnvModule();
      expect(validateEnv()).toEqual({ ok: true, missing: [] });
    });

    it("lists missing required variables in production", async () => {
      setNodeEnv("production");
      const { validateEnv } = await loadEnvModule();
      const result = validateEnv();

      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(
        expect.arrayContaining([
          "DATABASE_URL",
          "JWT_SECRET",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        ])
      );
    });

    it("reports ok in production when every required variable is present", async () => {
      setNodeEnv("production");
      process.env.DATABASE_URL = "postgresql://db";
      process.env.JWT_SECRET = "a-sufficiently-long-secret";
      process.env.STRIPE_SECRET_KEY = "sk_test_1234567890";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_1234567890";
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_1234567890";

      const { validateEnv } = await loadEnvModule();
      expect(validateEnv()).toEqual({ ok: true, missing: [] });
    });
  });
});
