import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import redis, { isRedisConfigured } from "@/lib/cache/redis";
import { logger } from "@/lib/config/logger";

/** Read live positions on every request — never cache or statically optimise. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Headers that make a response uncacheable end to end. */
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

/** Namespaced key so location data is unambiguous in Redis. */
const locationKey = (userId: string) => `location:${userId}`;

/** Locations expire so a user who stops sharing doesn't show a stale position. */
const LOCATION_TTL_SECONDS = 5 * 60;
const LOCATION_TTL_MS = LOCATION_TTL_SECONDS * 1000;

/**
 * In-process fallback used when Redis is not configured (local development /
 * demos). It mirrors the Redis semantics (TTL expiry) closely enough for a
 * single-instance deployment, so the map feature still works end-to-end
 * without requiring Redis.
 *
 * The store is pinned to `globalThis` for the same reason the Prisma/Redis
 * clients are: Next.js can evaluate this module more than once (separate route
 * bundles, dev hot-reload, parallel workers in one process), and a per-module
 * Map meant a location written by one request could be invisible to the next —
 * which surfaced as "…is not currently sharing their location".
 */
interface MemoryLocation {
  value: string;
  expiresAt: number;
}

const globalForLocations = globalThis as unknown as {
  __locationMemoryStore?: Map<string, MemoryLocation>;
};

const memoryStore: Map<string, MemoryLocation> =
  globalForLocations.__locationMemoryStore ??
  (globalForLocations.__locationMemoryStore = new Map());

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string) {
  memoryStore.set(key, { value, expiresAt: Date.now() + LOCATION_TTL_MS });
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { latitude, longitude, accuracy } = await request.json();

    // Validate input. Full double precision is preserved (no rounding), so the
    // stored fix keeps all the accuracy the device reported.
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Valid latitude (-90..90) and longitude (-180..180) are required" },
        { status: 400 },
      );
    }

    // Accuracy (metres, 95% confidence radius) is optional but, when supplied,
    // must be a non-negative finite number.
    const normalisedAccuracy =
      typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0
        ? accuracy
        : null;

    const key = locationKey(String(user.userId));
    const value = JSON.stringify({
      latitude,
      longitude,
      accuracy: normalisedAccuracy,
      updatedAt: Date.now(),
    });

    // Always write the in-process copy so a Redis outage (or an unconfigured
    // Redis) can't lose the most recent position; also write to Redis when it
    // is available so the value is shared across instances.
    memorySet(key, value);

    if (redis) {
      try {
        // Store location in Redis with a TTL so it expires when sharing stops.
        await redis.set(key, value, "EX", LOCATION_TTL_SECONDS);
      } catch (error) {
        // Non-fatal: the memory copy above keeps single-instance flows working.
        logger.warn("Redis write failed; kept in-memory copy", { error });
      }
    }

    return NextResponse.json(
      {
        message: "Location updated successfully",
        user: {
          id: user.userId,
          latitude,
          longitude,
          accuracy: normalisedAccuracy,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logger.error("Error updating location", { error });
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetId = request.nextUrl.searchParams.get("targetId"); // get from query
    if (!targetId) {
      return NextResponse.json({ error: "targetId required" }, { status: 400 });
    }

    // Fetch the target's profile alongside their coordinates so the map
    // tooltip always shows accurate, server-sourced information (name, phone,
    // role) instead of relying on whatever partial object the caller had.
    const key = locationKey(targetId);

    const readLocation = async (): Promise<string | null> => {
      if (redis) {
        try {
          const value = await redis.get(key);
          if (value) return value;
        } catch (error) {
          // Redis configured but unreachable — fall through to the memory
          // store so we can still serve a recently-written location.
          logger.warn("Redis read failed; checking memory fallback", { error });
        }
      }
      return memoryGet(key);
    };

    const [locationData, targetUser] = await Promise.all([
      readLocation(),
      prisma.user
        .findUnique({
          where: { id: targetId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        })
        .catch(() => null),
    ]);

    const target = targetUser
      ? {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          phone: targetUser.phone ?? null,
          role: targetUser.role,
        }
      : null;

    if (!locationData) {
      // The target simply hasn't shared a location (yet). This is a normal
      // state, not an error — return 200 with `location: null` so polling
      // clients don't treat it as a failure. The profile is still returned so
      // the UI can label the (not-yet-located) person correctly.
      return NextResponse.json({ location: null, target });
    }

    const parsed = JSON.parse(locationData) as {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      updatedAt: number;
    };

    return NextResponse.json(
      {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracy: parsed.accuracy ?? null,
        updatedAt: parsed.updatedAt,
        location: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          accuracy: parsed.accuracy ?? null,
          updatedAt: parsed.updatedAt,
        },
        target,
        /** Whether the coordinates come from a shared Redis-backed store. */
        realtime: isRedisConfigured(),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logger.error("Error fetching location", { error });
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: 500 },
    );
  }
}
