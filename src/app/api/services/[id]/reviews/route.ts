import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ApiError, withApiHandler } from "@/lib/api/errors";

/**
 * Paginated reviews for a service.
 * Public endpoint (no auth) — mirrors the reviews embedded in the service
 * detail response but supports pagination + sorting for large catalogs.
 */

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

export const GET = withApiHandler(async (request) => {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/").filter(Boolean);
  // .../api/services/[id]/reviews  -> id is two segments from the end
  const serviceId = segments[segments.length - 2];
  if (!serviceId) {
    throw ApiError.badRequest("Service ID is required");
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
  );
  const sort = searchParams.get("sort") === "rating" ? "rating" : "recent";

  const skip = (page - 1) * limit;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true },
  });
  if (!service) {
    throw ApiError.notFound("Service not found");
  }

  const [reviews, total, aggregate] = await Promise.all([
    prisma.review.findMany({
      where: { serviceId },
      include: { user: { select: { name: true } } },
      orderBy:
        sort === "rating"
          ? [{ rating: "desc" }, { createdAt: "desc" }]
          : { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { serviceId } }),
    prisma.review.aggregate({
      where: { serviceId },
      _avg: { rating: true },
    }),
  ]);

  return NextResponse.json({
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      user: { name: review.user.name },
      createdAt: review.createdAt,
    })),
    summary: {
      averageRating: Math.round((aggregate._avg.rating || 0) * 10) / 10,
      total,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
