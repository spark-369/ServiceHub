import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Liveness + readiness probe (also serves as a Kubernetes probe endpoint).
 *
 * - `status: "ok"`        -> process is up and dependencies reachable
 * - HTTP 200              -> ready to receive traffic
 * - HTTP 503              -> a critical dependency is unavailable
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}

async function checkRedis(): Promise<{ configured: boolean; ok: boolean }> {
  if (!process.env.REDIS_URL) {
    return { configured: false, ok: true };
  }
  try {
    const { getRedis } = await import("@/lib/cache/redis");
    const redis = getRedis();
    if (!redis) return { configured: false, ok: true };
    const pong = await redis.ping();
    return { configured: true, ok: pong === "PONG" };
  } catch {
    return { configured: true, ok: false };
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const healthy = database.ok;

  const body = {
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || "1.0.0",
    checks: {
      database: database.ok ? "up" : "down",
      redis: redis.configured ? (redis.ok ? "up" : "down") : "not_configured",
      stripe: process.env.STRIPE_SECRET_KEY ? "configured" : "not_configured",
    },
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
