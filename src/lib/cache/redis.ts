import Redis from "ioredis";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/config/logger";

/**
 * Hardened Redis client.
 *
 * Important: the client is created lazily so that importing this module never
 * opens a socket (which previously threw during `next build` / CI when
 * `REDIS_URL` was absent) and never crashes the process when Redis is down.
 */

const globalForRedis = globalThis as unknown as {
  redis?: Redis | null;
};

function createClient(): Redis | null {
  const { REDIS_URL } = getEnv();

  if (!REDIS_URL) {
    logger.warn("REDIS_URL is not configured; real-time features disabled");
    return null;
  }

  const client = new Redis(REDIS_URL, {
    // Queue commands until the connection is ready instead of rejecting them.
    // With `enableOfflineQueue: false`, commands issued while the client is
    // still connecting (common during Next.js dev recompiles) are dropped and
    // reads silently return nothing — which surfaced as spurious 404s.
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    retryStrategy(times) {
      // Exponential backoff capped at 3s to avoid busy looping.
      return Math.min(times * 200, 3000);
    },
    ...(REDIS_URL.startsWith("rediss://")
      ? { tls: { rejectUnauthorized: true } }
      : {}),
  });

  // Prevent unhandled 'error' events from crashing the Node process.
  client.on("error", (error) => {
    logger.error("Redis connection error", { error });
  });
  client.on("connect", () => logger.info("Redis connected"));
  client.on("reconnecting", () => logger.warn("Redis reconnecting"));

  return client;
}

/**
 * Always returns a Redis client instance (may be null when unconfigured).
 * Prefer `getRedis()` for lazy access.
 */
const redis: Redis | null =
  globalForRedis.redis !== undefined ? globalForRedis.redis : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export function getRedis(): Redis | null {
  return redis;
}

export function isRedisConfigured(): boolean {
  return redis !== null;
}

export default redis;
