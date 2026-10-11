/**
 * Node.js-only instrumentation logic.
 *
 * This module is imported dynamically from `src/instrumentation.ts` **only**
 * when running in the Node.js runtime. Keeping the Node APIs (`process.exit`,
 * `process.once`, etc.) isolated here means the Edge bundler never analyses
 * them, avoiding "A Node.js API is used ... which is not supported in the Edge
 * Runtime" warnings.
 */

export async function registerNodeInstrumentation(): Promise<void> {
  const { logger } = await import("@/lib/config/logger");
  const { getEnv, validateEnv } = await import("@/lib/config/env");

  try {
    const env = getEnv();
    logger.info("Environment validated", {
      environment: env.NODE_ENV,
      redisConfigured: Boolean(env.REDIS_URL),
      stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
      webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    });

    const { ok, missing } = validateEnv();
    if (!ok) {
      logger.error("Missing required production environment variables", {
        missing,
      });
    }
  } catch (error) {
    // Log loudly but don't crash the boot: individual routes surface precise
    // configuration errors where they matter.
    logger.error("Environment validation failed", { error });
  }

  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}, shutting down gracefully`);
    try {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.$disconnect();
      const { getRedis } = await import("@/lib/cache/redis");
      const redis = getRedis();
      if (redis) await redis.quit();
      logger.info("Graceful shutdown complete");
    } catch (error) {
      logger.error("Error during graceful shutdown", { error });
    } finally {
      process.exit(0);
    }
  };

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}

export default registerNodeInstrumentation;
