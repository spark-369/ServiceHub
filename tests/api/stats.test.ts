/**
 * Stats API tests.
 *
 * These exercise the REAL route handlers against the in-memory Prisma fake
 * installed by `jest.setup.js` — no per-test mocks of prisma or auth.
 * Authentication is handled with real JWTs (`signTestToken` / `createAuthedRequest`)
 * so `getUserFromRequest` runs its real verification path.
 */
import {
  createRequest,
  createAuthedRequest,
  jsonOf,
  statusOf,
  signTestToken,
  seed,
  store,
} from "../utils/test-utils";
import { prisma } from "@/lib/db/prisma";

import { GET as PublicStatsGET } from "@/app/api/stats/route";
import { GET as AdminStatsGET } from "@/app/api/admin/stats/route";

describe("Stats API Tests", () => {
  describe("GET /api/stats (public)", () => {
    it("should return platform statistics without authentication", async () => {
      seed("user", [
        { id: "u1", role: "provider", isVerified: true },
        { id: "u2", role: "provider", isVerified: true },
        { id: "u3", role: "provider", isVerified: false },
        { id: "u4", role: "customer", isVerified: true },
      ]);
      seed("review", [
        { id: "r1", rating: 5 },
        { id: "r2", rating: 4 },
        { id: "r3", rating: 5 },
        { id: "r4", rating: 3 },
      ]);
      seed("booking", [
        { id: "b1", status: "completed" },
        { id: "b2", status: "pending" },
        { id: "b3", status: "confirmed" },
      ]);
      seed("service", [
        { id: "s1", isActive: true },
        { id: "s2", isActive: false },
      ]);

      // The public stats route declares `GET()` with no parameters — it reads
      // nothing from the request — so it must be invoked without arguments.
      const response = await PublicStatsGET();

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.stats).toEqual({
        verifiedProviders: 2,
        averageRating: 4.25,
        completedBookings: 1,
        activeServices: 1,
      });
    });

    it("should default the average rating to 0 when there are no reviews", async () => {
      const response = await PublicStatsGET();

      expect(statusOf(response)).toBe(200);
      const body = await jsonOf(response);
      expect(body.stats).toEqual({
        verifiedProviders: 0,
        averageRating: 0,
        completedBookings: 0,
        activeServices: 0,
      });
    });

    it("should return 500 when a query fails", async () => {
      // The fake's model methods are `jest.fn`s, so a one-off throwing
      // implementation simulates a database failure. The global `beforeEach`
      // in `jest.setup.js` clears this mock (and resets the DB) afterwards.
      (prisma.user.count as jest.Mock).mockImplementationOnce(() => {
        throw new Error("db down");
      });

      const response = await PublicStatsGET();

      expect(statusOf(response)).toBe(500);
      expect(await jsonOf(response)).toEqual({ error: "Internal server error" });
    });
  });

  describe("GET /api/admin/stats", () => {
    const adminToken = signTestToken({
      userId: "admin123",
      email: "admin@example.com",
      role: "admin",
    });
    const customerToken = signTestToken({
      userId: "123",
      email: "user@example.com",
      role: "customer",
    });

    it("should return 403 for a non-admin user", async () => {
      const response = await AdminStatsGET(
        createAuthedRequest(customerToken, { method: "GET", url: "/api/admin/stats" })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Forbidden" });
      // No queries should run when the guard rejects.
      expect(store("user")).toHaveLength(0);
      expect(store("booking")).toHaveLength(0);
    });

    it("should return 403 when unauthenticated", async () => {
      const response = await AdminStatsGET(
        createRequest({ method: "GET", url: "/api/admin/stats" })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Forbidden" });
    });

    it("should return platform KPIs for an admin", async () => {
      seed("user", [
        { id: "admin123", role: "admin", isVerified: true },
        { id: "u1", role: "provider", isVerified: true },
        { id: "u2", role: "provider", isVerified: true },
        { id: "u3", role: "customer", isVerified: true },
        { id: "u4", role: "customer", isVerified: true },
        { id: "u5", role: "customer", isVerified: true },
        { id: "u6", role: "customer", isVerified: true },
      ]);
      seed("service", [
        { id: "s1", isActive: true },
        { id: "s2", isActive: true },
        { id: "s3", isActive: true },
        { id: "s4", isActive: true },
        { id: "s5", isActive: true },
        { id: "s6", isActive: true },
        { id: "s7", isActive: true },
        { id: "s8", isActive: true },
        { id: "s9", isActive: true },
        { id: "s10", isActive: true },
        { id: "s11", isActive: true },
        { id: "s12", isActive: true },
        { id: "s13", isActive: true },
        { id: "s14", isActive: true },
        { id: "s15", isActive: true },
        { id: "s16", isActive: false },
        { id: "s17", isActive: false },
        { id: "s18", isActive: false },
        { id: "s19", isActive: false },
        { id: "s20", isActive: false },
      ]);
      seed("booking", [
        { id: "b1", status: "completed", paymentStatus: "paid", totalPrice: 100 },
        { id: "b2", status: "completed", paymentStatus: "paid", totalPrice: 120 },
        { id: "b3", status: "completed", paymentStatus: "paid", totalPrice: 200 },
        { id: "b4", status: "pending", paymentStatus: "paid", totalPrice: 50 },
        { id: "b5", status: "pending", paymentStatus: "pending", totalPrice: 80 },
        { id: "b6", status: "confirmed", paymentStatus: "pending", totalPrice: 60 },
        { id: "b7", status: "confirmed", paymentStatus: "pending", totalPrice: 70 },
        { id: "b8", status: "confirmed", paymentStatus: "pending", totalPrice: 90 },
      ]);
      seed("review", [
        { id: "r1", rating: 5 },
        { id: "r2", rating: 4 },
        { id: "r3", rating: 5 },
        { id: "r4", rating: 3 },
        { id: "r5", rating: 4 },
      ]);

      const response = await AdminStatsGET(
        createAuthedRequest(adminToken, { method: "GET", url: "/api/admin/stats" })
      );

      expect(statusOf(response)).toBe(200);
      const body = await jsonOf(response);
      expect(body.stats).toEqual({
        users: { total: 7, providers: 2, customers: 4 },
        services: { total: 20, active: 15, inactive: 5 },
        bookings: {
          total: 8,
          completed: 3,
          pending: 2,
          byStatus: { completed: 3, pending: 2, confirmed: 3 },
        },
        reviews: { total: 5, averageRating: 4.2 },
        // 100 + 120 + 200 + 50 (the four `paid` bookings).
        revenue: { total: 470, paidBookings: 4 },
      });
    });
  });
});
