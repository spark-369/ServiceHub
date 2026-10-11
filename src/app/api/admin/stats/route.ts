import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

/**
 * GET /api/admin/stats
 *
 * Platform-wide KPIs for the admin overview tab: user/service/booking/review
 * counts, revenue totals, and breakdowns by status and role.
 */
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [
      totalUsers,
      totalProviders,
      totalCustomers,
      totalServices,
      activeServices,
      totalBookings,
      completedBookings,
      pendingBookings,
      totalReviews,
      revenueAgg,
      bookingsByStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "provider" } }),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.service.count(),
      prisma.service.count({ where: { isActive: true } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "completed" } }),
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.review.count(),
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        _count: true,
        where: { paymentStatus: "paid" },
      }),
      prisma.booking.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const averageRating = await prisma.review
      .aggregate({ _avg: { rating: true } })
      .catch(() => ({ _avg: { rating: 0 } }));

    return NextResponse.json({
      stats: {
        users: {
          total: totalUsers,
          providers: totalProviders,
          customers: totalCustomers,
        },
        services: {
          total: totalServices,
          active: activeServices,
          inactive: totalServices - activeServices,
        },
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          pending: pendingBookings,
          byStatus: Object.fromEntries(
            bookingsByStatus.map((b) => [b.status, b._count.status])
          ),
        },
        reviews: {
          total: totalReviews,
          averageRating: averageRating._avg.rating ?? 0,
        },
        revenue: {
          total: revenueAgg._sum.totalPrice ?? 0,
          paidBookings: revenueAgg._count,
        },
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
