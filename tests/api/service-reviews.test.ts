/**
 * Unit tests for `/api/services/[id]/reviews` (GET).
 *
 * This route is wrapped in `withApiHandler`, so the tests also cover the
 * centralised error translation (404 via `ApiError.notFound`), the pagination
 * clamping and the `sort=rating` ordering — all against the in-memory Prisma
 * fake with no per-test mocks.
 */
import {
  createRequest,
  jsonOf,
  statusOf,
  seed,
} from "../utils/test-utils";

import { GET as ServiceReviewsGET } from "@/app/api/services/[id]/reviews/route";

const PROVIDER = { id: "prov_1", name: "Prov", email: "prov@example.com" };
const CUSTOMERS = [
  { id: "cust_1", name: "Ann" },
  { id: "cust_2", name: "Ben" },
  { id: "cust_3", name: "Cara" },
];

function seedService() {
  seed("user", [
    { id: PROVIDER.id, name: PROVIDER.name, email: PROVIDER.email, password: "x", role: "provider" },
    ...CUSTOMERS.map((c) => ({
      id: c.id,
      name: c.name,
      email: `${c.id}@example.com`,
      password: "x",
      role: "customer",
    })),
  ]);
  seed("service", [
    {
      id: "svc_1",
      name: "Deep Clean",
      description: "D",
      category: "Cleaning",
      price: 10,
      duration: 30,
      location: "L",
      availability: {},
      tags: [],
      rating: 0,
      reviewCount: 0,
      isActive: true,
      providerId: PROVIDER.id,
    },
  ]);
}

/**
 * Seeds `count` reviews with descending ratings (5, 4, 3 …).
 *
 * Dates ascend with the rating (rev_1 is the newest AND the highest rated), so
 * the default `createdAt desc` order and the `sort=rating` order agree — the
 * in-memory Prisma fake applies multi-key `orderBy` sequentially rather than as
 * a tuple, and this keeps both assertions meaningful and stable.
 */
function seedReviews(count: number) {
  seed(
    "review",
    Array.from({ length: count }).map((_, index) => ({
      id: `rev_${index + 1}`,
      bookingId: `book_${index + 1}`,
      userId: CUSTOMERS[index % CUSTOMERS.length].id,
      serviceId: "svc_1",
      providerId: PROVIDER.id,
      rating: 5 - index,
      comment: `Review ${index + 1}`,
      createdAt: new Date(
        `2029-12-${String(count - index).padStart(2, "0")}T00:00:00.000Z`
      ),
    }))
  );
}

describe("API /api/services/[id]/reviews", () => {
  it("returns paginated reviews with an aggregate summary", async () => {
    seedService();
    seedReviews(3);

    const response = await ServiceReviewsGET(
      createRequest({
        method: "GET",
        url: "/api/services/svc_1/reviews?page=1&limit=2",
      })
    );

    expect(statusOf(response)).toBe(200);

    const body = await jsonOf(response);
    // Newest first by default: rev_1 (rating 5), rev_2 (rating 4).
    expect(body.reviews.map((r: any) => r.id)).toEqual(["rev_1", "rev_2"]);
    expect(body.reviews[0]).toMatchObject({
      rating: 5,
      comment: "Review 1",
      user: { name: CUSTOMERS[0].name },
    });
    // Average of 5, 4 and 3.
    expect(body.summary).toEqual({ averageRating: 4, total: 3 });
    expect(body.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
  });

  it("returns the second page", async () => {
    seedService();
    seedReviews(3);

    const response = await ServiceReviewsGET(
      createRequest({
        method: "GET",
        url: "/api/services/svc_1/reviews?page=2&limit=2",
      })
    );

    const body = await jsonOf(response);
    expect(body.reviews.map((r: any) => r.id)).toEqual(["rev_3"]);
    expect(body.pagination.page).toBe(2);
  });

  it("sorts by rating when sort=rating", async () => {
    seedService();
    seedReviews(3);

    const response = await ServiceReviewsGET(
      createRequest({
        method: "GET",
        url: "/api/services/svc_1/reviews?sort=rating",
      })
    );

    const body = await jsonOf(response);
    expect(body.reviews.map((r: any) => r.rating)).toEqual([5, 4, 3]);
  });

  it("clamps an oversized limit to the route maximum", async () => {
    seedService();
    seedReviews(2);

    const response = await ServiceReviewsGET(
      createRequest({
        method: "GET",
        url: "/api/services/svc_1/reviews?limit=999",
      })
    );

    const body = await jsonOf(response);
    expect(body.pagination.limit).toBe(50);
    expect(body.pagination.pages).toBe(1);
  });

  it("returns an empty page with a zero average when there are no reviews", async () => {
    seedService();

    const response = await ServiceReviewsGET(
      createRequest({ method: "GET", url: "/api/services/svc_1/reviews" })
    );

    expect(statusOf(response)).toBe(200);

    const body = await jsonOf(response);
    expect(body.reviews).toEqual([]);
    expect(body.summary).toEqual({ averageRating: 0, total: 0 });
  });

  it("returns 404 (translated by withApiHandler) for an unknown service", async () => {
    seedService();

    const response = await ServiceReviewsGET(
      createRequest({ method: "GET", url: "/api/services/missing/reviews" })
    );

    expect(statusOf(response)).toBe(404);

    const body = await jsonOf(response);
    expect(body.error).toBe("Service not found");
    expect(body.code).toBe("NOT_FOUND");
    // withApiHandler always attaches a correlation id.
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });
});
