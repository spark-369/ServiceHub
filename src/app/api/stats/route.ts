import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/stats
 *
 * Public, cacheable platform statistics used by the marketing "trust" strip on
 * the home page: verified providers, average rating, completed bookings and
 * active services. No authentication required.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const [verifiedProviders, averageRating, completedBookings, activeServices] =
      await Promise.all([
        prisma.user.count({ where: { role: "provider", isVerified: true } }),
        prisma.review.aggregate({ _avg: { rating: true } }),
        prisma.booking.count({ where: { status: "completed" } }),
        prisma.service.count({ where: { isActive: true } }),
      ]);

    return NextResponse.json({
      stats: {
        verifiedProviders,
        averageRating: averageRating._avg.rating ?? 0,
        completedBookings,
        activeServices,
      },
    });
  } catch (error) {
    console.error("Public stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
