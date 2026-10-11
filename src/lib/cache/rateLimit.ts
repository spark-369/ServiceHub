import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/config/logger";

/**
 * Distributed rate limiter.
 *
 * Uses Redis (`INCR` + `PEXPIRE`) when `REDIS_URL` is configured so limits are
 * shared across all server instances, and transparently falls back to an
 * in-process sliding window otherwise (development / tests / Redis outage).
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms when the window resets
}

interface MemoryBucket {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, MemoryBucket>();

// Periodically evict expired buckets so the fallback store cannot grow without
// bound in a long-running process. `unref()` keeps this timer from holding the
// event loop open (important for tests / graceful shutdown).
const CLEANUP_INTERVAL_MS = 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of memoryStore) {
    if (bucket.resetTime <= now) memoryStore.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

async function getRedis(): Promise<import("ioredis").default | null> {
  const env = getEnv();
  if (!env.REDIS_URL) return null;
  try {
    const { default: redis } = await import("@/lib/cache/redis");
    return redis;
  } catch (error) {
    logger.warn("Rate limiter falling back to memory (redis unavailable)", {
      error,
    });
    return null;
  }
}

function memoryLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = memoryStore.get(key);

  if (!bucket || bucket.resetTime <= now) {
    const resetTime = now + windowMs;
    memoryStore.set(key, { count: 1, resetTime });
    return { success: true, limit: maxRequests, remaining: maxRequests - 1, reset: resetTime };
  }

  if (bucket.count >= maxRequests) {
    return { success: false, limit: maxRequests, remaining: 0, reset: bucket.resetTime };
  }

  bucket.count += 1;
  return {
    success: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    reset: bucket.resetTime,
  };
}

/**
 * Consume one unit for the given identifier.
 *
 * @param identifier  Usually `ip` or `ip:route`.
 * @param maxRequests Requests allowed per window.
 * @param windowMs    Window length in milliseconds.
 */
export async function rateLimit(
  identifier: string,
  maxRequests?: number,
  windowMs?: number
): Promise<RateLimitResult> {
  const env = getEnv();
  const limit = maxRequests ?? env.RATE_LIMIT_MAX;
  const window = windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const key = `ratelimit:${identifier}`;

  const redis = await getRedis();
  if (!redis) {
    return memoryLimit(key, limit, window);
  }

  try {
    const results = await redis
      .multi()
      .incr(key)
      .pttl(key)
      .exec();

    const count = Number(results?.[0]?.[1] ?? 1);
    let ttl = Number(results?.[1]?.[1] ?? -1);

    if (ttl < 0) {
      await redis.pexpire(key, window);
      ttl = window;
    }

    const reset = Date.now() + ttl;

    if (count > limit) {
      return { success: false, limit, remaining: 0, reset };
    }

    return { success: true, limit, remaining: Math.max(0, limit - count), reset };
  } catch (error) {
    logger.warn("Rate limiter redis error, using memory fallback", { error });
    return memoryLimit(key, limit, window);
  }
}

/** Reset an identifier's counter (useful after successful login, in tests, etc.). */
export async function resetRateLimit(identifier: string): Promise<void> {
  const key = `ratelimit:${identifier}`;
  memoryStore.delete(key);
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // best-effort
    }
  }
}

/** Extract the best-guess client IP from proxy headers. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export default rateLimit;
