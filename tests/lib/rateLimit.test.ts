import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { rateLimit, getClientIp, resetRateLimit } from "@/lib/cache/rateLimit";

/**
 * The limiter uses the in-memory fallback whenever `REDIS_URL` is not set.
 * We mock the env module so the test is fully hermetic and deterministic —
 * independent of any ambient `REDIS_URL` in the developer/CI environment and
 * of the order in which `getEnv()` was first called (it memoises).
 */
jest.mock("@/lib/config/env", () => ({
  __esModule: true,
  getEnv: () => ({
    NODE_ENV: "test",
    REDIS_URL: undefined,
    ALLOWED_ORIGINS: "*",
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    AUTH_RATE_LIMIT_MAX: 10,
  }),
  validateEnv: () => ({ ok: true, missing: [] }),
  isStripeConfigured: () => false,
  getAllowedOrigins: () => ["*"],
}));

describe("Rate Limiter Tests", () => {
  beforeEach(async () => {
    await resetRateLimit("test-ip:api");
    await resetRateLimit("test-ip:auth");
  });

  it("should allow requests under the limit", async () => {
    const result = await rateLimit("test-ip:api", 3, 60000);
    expect(result.success).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(2);
  });

  it("should block requests once the limit is exceeded", async () => {
    // The limit is inclusive: `maxRequests` calls are allowed.
    for (let i = 0; i < 3; i++) {
      const allowed = await rateLimit("test-ip:auth", 3, 60000);
      expect(allowed.success).toBe(true);
    }
    const blocked = await rateLimit("test-ip:auth", 3, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("should reset the counter after resetRateLimit", async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimit("test-ip:api", 3, 60000);
    }
    // Sanity check: the next call would be blocked before the reset.
    const beforeReset = await rateLimit("test-ip:api", 3, 60000);
    expect(beforeReset.success).toBe(false);

    await resetRateLimit("test-ip:api");

    const afterReset = await rateLimit("test-ip:api", 3, 60000);
    expect(afterReset.success).toBe(true);
  });

  it("should track identifiers independently", async () => {
    await rateLimit("test-ip:api", 1, 60000);

    // A different identifier is unaffected by the first one's limit.
    const other = await rateLimit("other-ip:api", 1, 60000);
    expect(other.success).toBe(true);
  });

  it("getClientIp should prefer x-forwarded-for", () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "1.2.3.4, 5.6.7.8");
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("getClientIp should fall back to x-real-ip", () => {
    const headers = new Headers();
    headers.set("x-real-ip", "9.9.9.9");
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it("getClientIp should fall back to cf-connecting-ip", () => {
    const headers = new Headers();
    headers.set("cf-connecting-ip", "10.0.0.1");
    expect(getClientIp(headers)).toBe("10.0.0.1");
  });

  it("getClientIp should return 'unknown' when no IP headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

