/**
 * End-to-end API flow tests.
 *
 * These exercise the REAL route handlers, REAL auth (`withAuth`/`withRole`,
 * JWT sign/verify, bcrypt) and the in-memory Prisma fake — no per-test mocks
 * of auth/middleware/next-server. The journey mirrors a real user session:
 *
 *   register → login → create service (provider) → public listing →
 *   book (customer) → provider completes → customer reviews → admin stats
 *
 * plus the negative paths the guards must enforce (401/403/404).
 */

import {
  createRequest,
  createAuthedRequest,
  jsonOf,
  statusOf,
  signTestToken,
  hashPassword,
} from "../utils/test-utils";
import { prisma } from "@/lib/db/prisma";

import { POST as RegisterPOST } from "@/app/api/auth/register/route";
import { POST as LoginPOST } from "@/app/api/auth/login/route";
import { POST as ServicesPOST, GET as ServicesGET } from "@/app/api/services/route";
import { GET as ServiceDetailGET } from "@/app/api/services/[id]/route";
import { GET as ServicesReviewsGET } from "@/app/api/services/[id]/reviews/route";
import { POST as BookingsPOST } from "@/app/api/bookings/route";
import { PUT as BookingUpdatePUT, GET as BookingGET } from "@/app/api/bookings/[id]/route";
import { POST as ReviewsPOST } from "@/app/api/reviews/route";
import { GET as AdminStatsGET } from "@/app/api/admin/stats/route";
import { GET as AdminUsersGET } from "@/app/api/admin/users/route";

describe("End-to-end API flow", () => {
  const provider = {
    name: "Ada Provider",
    email: "ada@example.com",
    password: "password123",
    role: "provider",
  };
  const customer = {
    name: "Sam Customer",
    email: "sam@example.com",
    password: "password123",
    role: "customer",
  };
  const admin = {
    name: "Root Admin",
    email: "root@example.com",
    password: "password123",
    role: "admin",
  };

  async function register(user: typeof provider) {
    const request = createRequest({
      method: "POST",
      url: "/api/auth/register",
      body: user,
    });
    const response = await RegisterPOST(request);
    return { response, body: await jsonOf(response) };
  }

  async function login(email: string, password: string) {
    const request = createRequest({
      method: "POST",
      url: "/api/auth/login",
      body: { email, password },
    });
    const response = await LoginPOST(request);
    return { response, body: await jsonOf(response) };
  }

  it("runs the full register → login → book → review → admin journey", async () => {
    // 1. Register a provider, a customer and an admin.
    const providerReg = await register(provider);
    expect(statusOf(providerReg.response)).toBe(201);
    expect(providerReg.body.user.role).toBe("provider");
    expect(providerReg.body.token).toBeTruthy();

    const customerReg = await register(customer);
    expect(statusOf(customerReg.response)).toBe(201);
    expect(customerReg.body.user.role).toBe("customer");

    const adminReg = await register(admin);
    expect(statusOf(adminReg.response)).toBe(201);
    expect(adminReg.body.user.role).toBe("admin");

    // 2. Log everyone in (real bcrypt + JWT).
    const providerLogin = await login(provider.email, provider.password);
    expect(statusOf(providerLogin.response)).toBe(200);
    expect(providerLogin.body.message).toBe("Login successful");

    const customerLogin = await login(customer.email, customer.password);
    expect(statusOf(customerLogin.response)).toBe(200);

    const adminLogin = await login(admin.email, admin.password);
    expect(statusOf(adminLogin.response)).toBe(200);

    const providerToken = providerLogin.body.token;
    const customerToken = customerLogin.body.token;
    const adminToken = adminLogin.body.token;

    // 3. The provider creates a service (guarded by withRole(['provider'])).
    const createService = await ServicesPOST(
      createAuthedRequest(providerToken, {
        method: "POST",
        url: "/api/services",
        body: {
          name: "Deep House Cleaning",
          description: "Professional house cleaning service",
          category: "cleaning",
          price: 120,
          duration: 90,
          location: "Brooklyn, NY",
          availability: { days: ["mon", "wed"], startTime: "09:00", endTime: "17:00" },
          tags: ["cleaning", "house"],
        },
      })
    );
    expect(statusOf(createService)).toBe(201);
    const serviceBody = await jsonOf(createService);
    const serviceId = serviceBody.service.id;
    expect(serviceId).toBeTruthy();
    expect(serviceBody.service.name).toBe("Deep House Cleaning");

    // 4. The service is publicly listable (no auth).
    const listServices = await ServicesGET(
      createRequest({ method: "GET", url: "/api/services" })
    );
    expect(statusOf(listServices)).toBe(200);
    const listBody = await jsonOf(listServices);
    expect(listBody.services).toHaveLength(1);
    expect(listBody.services[0].id).toBe(serviceId);
    expect(listBody.services[0].provider.name).toBe(provider.name);

    // 5. The customer books the service (guarded by withAuth).
    const bookingDate = new Date(Date.now() + 3 * 86400000).toISOString();
    const createBooking = await BookingsPOST(
      createAuthedRequest(customerToken, {
        method: "POST",
        url: "/api/bookings",
        body: { serviceId, date: bookingDate, notes: "Please bring eco supplies" },
      })
    );
    expect(statusOf(createBooking)).toBe(201);
    const bookingBody = await jsonOf(createBooking);
    const bookingId = bookingBody.booking.id;
    expect(bookingId).toBeTruthy();
    expect(bookingBody.booking.totalPrice).toBe(120);

    // 6. The provider advances the booking to `completed`.
    const confirmBooking = await BookingUpdatePUT(
      createAuthedRequest(providerToken, {
        method: "PUT",
        url: `/api/bookings/${bookingId}`,
        body: { status: "confirmed" },
      })
    );
    expect(statusOf(confirmBooking)).toBe(200);

    const finishBooking = await BookingUpdatePUT(
      createAuthedRequest(providerToken, {
        method: "PUT",
        url: `/api/bookings/${bookingId}`,
        body: { status: "completed" },
      })
    );
    expect(statusOf(finishBooking)).toBe(200);
    expect((await jsonOf(finishBooking)).booking.status).toBe("completed");

    // 7. The customer reviews the completed booking.
    const createReview = await ReviewsPOST(
      createAuthedRequest(customerToken, {
        method: "POST",
        url: "/api/reviews",
        body: { bookingId, rating: 5, comment: "Spotless!" },
      })
    );
    expect(statusOf(createReview)).toBe(201);
    const reviewBody = await jsonOf(createReview);
    expect(reviewBody.review.rating).toBe(5);

    // 8. The review is visible on the public service detail + reviews list.
    const serviceDetail = await ServiceDetailGET(
      createRequest({ method: "GET", url: `/api/services/${serviceId}` })
    );
    expect(statusOf(serviceDetail)).toBe(200);
    const detailBody = await jsonOf(serviceDetail);
    expect(detailBody.reviews).toHaveLength(1);
    expect(detailBody.reviews[0].rating).toBe(5);
    expect(detailBody.reviews[0].user.name).toBe(customer.name);

    const reviewsList = await ServicesReviewsGET(
      createRequest({ method: "GET", url: `/api/services/${serviceId}/reviews` })
    );
    expect(statusOf(reviewsList)).toBe(200);
    const reviewsBody = await jsonOf(reviewsList);
    expect(reviewsBody.reviews).toHaveLength(1);
    expect(reviewsBody.summary.averageRating).toBe(5);
    expect(reviewsBody.summary.total).toBe(1);

    // 9. The service's aggregate rating was recalculated.
    const listedAfterReview = await ServicesGET(
      createRequest({ method: "GET", url: "/api/services" })
    );
    const listedBody = await jsonOf(listedAfterReview);
    expect(listedBody.services[0].rating).toBe(5);
    expect(listedBody.services[0].reviewCount).toBe(1);

    // 10. Admin sees platform stats (real admin JWT through getUserFromRequest).
    const stats = await AdminStatsGET(
      createAuthedRequest(adminToken, { method: "GET", url: "/api/admin/stats" })
    );
    expect(statusOf(stats)).toBe(200);
    const statsBody = await jsonOf(stats);
    expect(statsBody.stats.users.total).toBe(3);
    expect(statsBody.stats.services.total).toBe(1);
    expect(statsBody.stats.bookings.total).toBe(1);
    expect(statsBody.stats.bookings.completed).toBe(1);
    expect(statsBody.stats.reviews.total).toBe(1);
    expect(statsBody.stats.reviews.averageRating).toBe(5);
  });


  it("rejects unauthenticated access to guarded routes (401)", async () => {
    const noAuthBooking = await BookingsPOST(
      createRequest({
        method: "POST",
        url: "/api/bookings",
        body: { serviceId: "x", date: new Date().toISOString() },
      })
    );
    expect(statusOf(noAuthBooking)).toBe(401);
    expect((await jsonOf(noAuthBooking)).error).toBe("Unauthorized");

    const noAuthReview = await ReviewsPOST(
      createRequest({
        method: "POST",
        url: "/api/reviews",
        body: { bookingId: "x", rating: 5 },
      })
    );
    expect(statusOf(noAuthReview)).toBe(401);

    const noAuthStats = await AdminStatsGET(
      createRequest({ method: "GET", url: "/api/admin/stats" })
    );
    expect(statusOf(noAuthStats)).toBe(403);
    expect((await jsonOf(noAuthStats)).error).toBe("Forbidden");
  });

  it("enforces role guards: customers cannot create services (403)", async () => {
    await register(customer);
    const customerLogin = await login(customer.email, customer.password);
    const token = customerLogin.body.token;
    expect(token).toBeTruthy();

    const response = await ServicesPOST(
      createAuthedRequest(token, {
        method: "POST",
        url: "/api/services",
        body: { name: "x", description: "x", category: "x", price: 1, duration: 1, location: "x" },
      })
    );
    expect(statusOf(response)).toBe(403);
    expect((await jsonOf(response)).error).toBe("Forbidden");
  });

  it("rejects invalid credentials (401) and duplicate registration (400)", async () => {
    await register(customer);

    const badPassword = await login(customer.email, "wrong-password");
    expect(statusOf(badPassword.response)).toBe(401);
    expect(badPassword.body.error).toBe("Invalid credentials");

    const unknownUser = await login("nobody@example.com", "password123");
    expect(statusOf(unknownUser.response)).toBe(401);

    const duplicate = await register(customer);
    expect(statusOf(duplicate.response)).toBe(400);
    expect(duplicate.body.error).toBe("User already exists");
  });

  it("returns 404 for a missing service and 403 for a non-owner booking view", async () => {
    const missing = await ServiceDetailGET(
      createRequest({ method: "GET", url: "/api/services/does-not-exist" })
    );
    expect(statusOf(missing)).toBe(404);
    expect((await jsonOf(missing)).error).toBe("Service not found");

    // Seed a booking owned by someone else, then try to view it as a stranger.
    const owner = await prisma.user.create({
      data: { name: "Owner", email: "owner@example.com", password: hashPassword("password123"), role: "customer" },
    });
    const providerUser = await prisma.user.create({
      data: { name: "Prov", email: "prov@example.com", password: hashPassword("password123"), role: "provider" },
    });
    const svc = await prisma.service.create({
      data: {
        name: "S",
        description: "D",
        category: "c",
        price: 10,
        duration: 30,
        location: "L",
        availability: {},
        tags: [],
        providerId: providerUser.id,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        userId: owner.id,
        serviceId: svc.id,
        providerId: providerUser.id,
        date: new Date(Date.now() + 86400000),
        totalPrice: 10,
      },
    });

    const strangerToken = signTestToken({ email: "stranger@example.com", role: "customer" });
    const strangerView = await BookingGET(
      createAuthedRequest(strangerToken, {
        method: "GET",
        url: `/api/bookings/${booking.id}`,
      })
    );
    expect(statusOf(strangerView)).toBe(403);
    expect((await jsonOf(strangerView)).error).toBe("Unauthorized");

    // The owner can view it.
    const ownerToken = signTestToken({ userId: owner.id, email: owner.email, role: "customer" });
    const ownerView = await BookingGET(
      createAuthedRequest(ownerToken, {
        method: "GET",
        url: `/api/bookings/${booking.id}`,
      })
    );
    expect(statusOf(ownerView)).toBe(200);
    const ownerBody = await jsonOf(ownerView);
    expect(ownerBody.booking.id).toBe(booking.id);
    expect(ownerBody.canReview).toBe(false); // booking not completed yet
  });

  it("blocks customers from the admin user list (401)", async () => {
    await register(customer);
    const token = (await login(customer.email, customer.password)).body.token;
    expect(token).toBeTruthy();

    const response = await AdminUsersGET(
      createAuthedRequest(token, { method: "GET", url: "/api/admin/users" })
    );
    expect(statusOf(response)).toBe(401);
    expect((await jsonOf(response)).error).toBe("Unauthorized");
  });
});
