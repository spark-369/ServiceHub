import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Readiness probe: confirms the app can serve traffic (DB reachable).
 * Kept separate from liveness so orchestrators can stop routing traffic
 * without restarting the container.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ready: true });
  } catch (error) {
    return NextResponse.json(
      {
        ready: false,
        error: error instanceof Error ? error.message : "database unavailable",
      },
      { status: 503 }
    );
  }
}
