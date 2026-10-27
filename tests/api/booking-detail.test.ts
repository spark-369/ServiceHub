/**
 * Unit tests for `/api/bookings/[id]` (GET, PUT, DELETE).
 *
 * The handlers run unmocked against the in-memory Prisma fake, so the real
 * ownership checks, status-transition rules and `canReview` derivation are all
 * exercised. Authentication uses real JWTs, one per role.
 */
import {
  createRequest,
  createAuthedRequest,
  jsonOf,
  statusOf,
  signTestToken,
  seed,
} from "../utils/test-utils";

import {
  GET as BookingGET,
  PUT as BookingPUT,
  DELETE as BookingDELETE,
} from "@/app/api/bookings/[id]/route";

const PROVIDER = { id: "prov_1", name: "Prov", email: "prov@example.com" };
const CUSTOMER = { id: "cust_1", name: "Cust", email: "cust@example.com" };
const STRANGER = { id: "str_1", name: "Stranger", email: "stranger@example.com" };
const ADMIN = { id: "adm_1", name: "Root", email: "root@example.com" };

const TOKENS = {
  provider: signTestToken({ userId: PROVIDER.id, email: PROVIDER.email, role: "provider" }),
  customer: signTestToken({ userId: CUSTOMER.id, email: CUSTOMER.email, role: "customer" }),
  stranger: signTestToken({ userId: STRANGER.id, email: STRANGER.email, role: "customer" }),
  admin: signTestToken({ userId: ADMIN.id, email: ADMIN.email, role: "admin" }),
};

/** Seeds the users + service a booking row needs for its relations to resolve. */
function seedUsersAndService() {
  seed("user", [
    { id: PROVIDER.id, name: PROVIDER.name, email: PROVIDER.email, password: "x", role: "provider", isVerified: true },
    { id: CUSTOMER.id, name: CUSTOMER.name, email: CUSTOMER.email, password: "x", role: "customer", isVerified: true },
    { id: STRANGER.id, name: STRANGER.name, email: STRANGER.email, password: "x", role: "customer", isVerified: true },
    { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, password: "x", role: "admin", isVerified: true },
  ]);
  seed("service", [
    {
      id: "svc_1",
      name: "Deep Clean",
      description: "A thorough clean",
      category: "Cleaning",
      price: 100,
      duration: 60,
      location: "Testville",
      availability: {},
      tags: [],
      rating: 0,
      reviewCount: 0,
      isActive: true,
      providerId: PROVIDER.id,
    },
  ]);
}

/** Seeds a single booking (relations included) with optional overrides. */
function seedBooking(overrides: Record<string, unknown> = {}) {
  seedUsersAndService();
  seed("booking", [
    {
      id: "book_1",
      userId: CUSTOMER.id,
      serviceId: "svc_1",
      providerId: PROVIDER.id,
      date: new Date("2030-01-01T10:00:00.000Z"),
      status: "pending",
      notes: null,
      totalPrice: 100,
      paymentStatus: "pending",
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
      updatedAt: new Date("2029-12-01T00:00:00.000Z"),
      ...overrides,
    },
  ]);
}

describe("API /api/bookings/[id]", () => {
  describe("GET", () => {
    it("returns the booking for the owning customer", async () => {
      seedBooking();

      const response = await BookingGET(
        createAuthedRequest(TOKENS.customer, {
          method: "GET",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.booking).toMatchObject({
        id: "book_1",
        status: "pending",
        paymentStatus: "pending",
        totalPrice: 100,
        service: { id: "svc_1", name: "Deep Clean" },
        user: { id: CUSTOMER.id },
        provider: { id: PROVIDER.id },
      });
      expect(body.canReview).toBe(false);
    });

    it("allows the servicing provider to read the booking", async () => {
      seedBooking();

      const response = await BookingGET(
        createAuthedRequest(TOKENS.provider, {
          method: "GET",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).booking.id).toBe("book_1");
    });

    it("allows an admin to read any booking", async () => {
      seedBooking();

      const response = await BookingGET(
        createAuthedRequest(TOKENS.admin, {
          method: "GET",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).booking.id).toBe("book_1");
    });

    it("derives canReview=true for a completed booking without a review", async () => {
      seedBooking({ status: "completed" });

      const response = await BookingGET(
        createAuthedRequest(TOKENS.customer, {
          method: "GET",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).canReview).toBe(true);
    });

    it("derives canReview=false once the customer has reviewed", async () => {
      seedBooking({ status: "completed" });
      seed("review", [
        {
          id: "rev_1",
          bookingId: "book_1",
          userId: CUSTOMER.id,
          serviceId: "svc_1",
          providerId: PROVIDER.id,
          rating: 5,
          comment: "Great",
        },
      ]);

      const response = await BookingGET(
        createAuthedRequest(TOKENS.customer, {
          method: "GET",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).canReview).toBe(false);
    });

    it("returns 404 for an unknown booking", async () => {
      seedUsersAndService();

      const response = await BookingGET(
        createAuthedRequest(TOKENS.customer, {
          method: "GET",
          url: "/api/bookings/does-not-exist",
        })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({ error: "Booking not found" });
    });

    it("returns 403 for an unrelated user", async () => {
      seedBooking();

      const response = await BookingGET(
        createAuthedRequest(TOKENS.stranger, {
          method: "GET",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 without a token", async () => {
      seedBooking();

      const response = await BookingGET(
        createRequest({ method: "GET", url: "/api/bookings/book_1" })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });

  describe("PUT", () => {
    it("lets the customer cancel their own pending booking", async () => {
      seedBooking();

      const response = await BookingPUT(
        createAuthedRequest(TOKENS.customer, {
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { status: "cancelled" },
        })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.message).toBe("Booking updated successfully");
      expect(body.booking).toMatchObject({ id: "book_1", status: "cancelled" });
    });

    it("lets the provider confirm a pending booking", async () => {
      seedBooking();

      const response = await BookingPUT(
        createAuthedRequest(TOKENS.provider, {
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { status: "confirmed" },
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).booking.status).toBe("confirmed");
    });

    it("rejects a status the caller's role may not set (400)", async () => {
      seedBooking();

      // Customers may only cancel.
      const response = await BookingPUT(
        createAuthedRequest(TOKENS.customer, {
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { status: "completed" },
        })
      );

      expect(statusOf(response)).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: "Invalid status transition" });
    });

    it("rejects an invalid lifecycle transition (400)", async () => {
      seedBooking({ status: "completed" });

      // Admin may set any status, but completed is terminal.
      const response = await BookingPUT(
        createAuthedRequest(TOKENS.admin, {
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { status: "in_progress" },
        })
      );

      expect(statusOf(response)).toBe(400);
      expect(await jsonOf(response)).toEqual({
        error: "Cannot change status from completed to in_progress",
      });
    });

    it("updates notes without touching the status", async () => {
      seedBooking({ status: "confirmed" });

      const response = await BookingPUT(
        createAuthedRequest(TOKENS.provider, {
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { notes: "Bring your own ladder" },
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).booking).toMatchObject({
        status: "confirmed",
        notes: "Bring your own ladder",
      });
    });

    it("returns 403 when the customer does not own the booking", async () => {
      seedBooking();

      const response = await BookingPUT(
        createAuthedRequest(TOKENS.stranger, {
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { status: "cancelled" },
        })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });

    it("returns 404 for an unknown booking", async () => {
      seedUsersAndService();

      const response = await BookingPUT(
        createAuthedRequest(TOKENS.admin, {
          method: "PUT",
          url: "/api/bookings/missing",
          body: { status: "confirmed" },
        })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({ error: "Booking not found" });
    });

    it("returns 401 without a token", async () => {
      seedBooking();

      const response = await BookingPUT(
        createRequest({
          method: "PUT",
          url: "/api/bookings/book_1",
          body: { status: "cancelled" },
        })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });

  describe("DELETE", () => {
    it("cancels an active booking instead of deleting it", async () => {
      seedBooking();

      const response = await BookingDELETE(
        createAuthedRequest(TOKENS.customer, {
          method: "DELETE",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(200);
      expect(await jsonOf(response)).toEqual({
        message: "Booking cancelled successfully",
      });
    });

    it("returns 400 when the booking is already cancelled", async () => {
      seedBooking({ status: "cancelled" });

      const response = await BookingDELETE(
        createAuthedRequest(TOKENS.customer, {
          method: "DELETE",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(400);
      expect(await jsonOf(response)).toEqual({
        error: "Cannot cancel completed or already cancelled booking",
      });
    });

    it("returns 400 when the booking is completed", async () => {
      seedBooking({ status: "completed" });

      const response = await BookingDELETE(
        createAuthedRequest(TOKENS.provider, {
          method: "DELETE",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(400);
      expect(await jsonOf(response)).toEqual({
        error: "Cannot cancel completed or already cancelled booking",
      });
    });

    it("returns 403 for an unrelated user", async () => {
      seedBooking();

      const response = await BookingDELETE(
        createAuthedRequest(TOKENS.stranger, {
          method: "DELETE",
          url: "/api/bookings/book_1",
        })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });

    it("returns 404 for an unknown booking", async () => {
      seedUsersAndService();

      const response = await BookingDELETE(
        createAuthedRequest(TOKENS.admin, {
          method: "DELETE",
          url: "/api/bookings/missing",
        })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({ error: "Booking not found" });
    });

    it("returns 401 without a token", async () => {
      seedBooking();

      const response = await BookingDELETE(
        createRequest({ method: "DELETE", url: "/api/bookings/book_1" })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });
});
