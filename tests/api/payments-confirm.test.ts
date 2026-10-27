/**
 * Unit tests for `/api/payments/confirm` (POST).
 *
 * Covers the ownership guard, the payment-intent reconciliation checks
 * (booking/user/amount mismatch) and the happy path where a succeeded intent
 * flips the booking to `paid`. The Stripe client is mocked at the module
 * boundary (the harness default returns a `succeeded` intent), and Prisma runs
 * the real in-memory fake.
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

import { POST as ConfirmPOST } from "@/app/api/payments/confirm/route";
import { stripe } from "@/lib/integrations/stripe";

const mockStripe = stripe as any;

const CUSTOMER = { id: "cust_1", name: "Cust", email: "cust@example.com" };
const OTHER = { id: "cust_2", name: "Other", email: "other@example.com" };

const CUSTOMER_TOKEN = signTestToken({
  userId: CUSTOMER.id,
  email: CUSTOMER.email,
  role: "customer",
});
const OTHER_TOKEN = signTestToken({
  userId: OTHER.id,
  email: OTHER.email,
  role: "customer",
});

function seedBooking(overrides: Record<string, unknown> = {}) {
  seed("user", [
    { id: CUSTOMER.id, name: CUSTOMER.name, email: CUSTOMER.email, password: "x", role: "customer" },
    { id: OTHER.id, name: OTHER.name, email: OTHER.email, password: "x", role: "customer" },
  ]);
  seed("service", [
    {
      id: "svc_1",
      name: "Deep Clean",
      description: "D",
      category: "Cleaning",
      price: 100,
      duration: 60,
      location: "L",
      availability: {},
      tags: [],
      rating: 0,
      reviewCount: 0,
      isActive: true,
      providerId: "prov_1",
    },
  ]);
  seed("booking", [
    {
      id: "book_1",
      userId: CUSTOMER.id,
      serviceId: "svc_1",
      providerId: "prov_1",
      date: new Date("2030-01-01T10:00:00.000Z"),
      status: "confirmed",
      notes: null,
      totalPrice: 100,
      paymentStatus: "pending",
      ...overrides,
    },
  ]);
}

describe("API /api/payments/confirm", () => {
  it("marks the booking as paid for a succeeded intent", async () => {
    seedBooking();
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: "pi_test_1",
      status: "succeeded",
      amount: 10000,
      currency: "usd",
      customer: "cus_1",
      metadata: { bookingId: "book_1", userId: CUSTOMER.id },
    });

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(200);
    expect(await jsonOf(response)).toEqual({
      success: true,
      message: "Payment confirmed successfully",
    });

    const booking = store("booking")[0];
    expect(booking.paymentStatus).toBe("paid");
    expect(booking.stripePaymentId).toBe("pi_test_1");
    expect(booking.stripeCustomerId).toBe("cus_1");
    expect(booking.paidAt).toBeInstanceOf(Date);
  });

  it("returns 400 when the booking id or intent id is missing", async () => {
    seedBooking();

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1" },
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({
      error: "Booking ID and Payment Intent ID are required",
    });
    expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown booking", async () => {
    seedBooking();

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "missing", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(404);
    expect(await jsonOf(response)).toEqual({ error: "Booking not found" });
  });

  it("returns 403 when the caller does not own the booking", async () => {
    seedBooking();

    const response = await ConfirmPOST(
      createAuthedRequest(OTHER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(403);
    expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when the booking is already paid", async () => {
    seedBooking({ paymentStatus: "paid" });

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({ error: "Payment already completed" });
    expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it("returns 401 without a token", async () => {
    seedBooking();

    const response = await ConfirmPOST(
      createRequest({
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(401);
    expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when the intent belongs to a different booking", async () => {
    seedBooking();
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: "pi_test_1",
      status: "succeeded",
      metadata: { bookingId: "some_other_booking" },
    });

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({
      error: "Payment intent does not match this booking",
    });
    expect(store("booking")[0].paymentStatus).toBe("pending");
  });

  it("returns 403 when the intent belongs to a different user", async () => {
    seedBooking();
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: "pi_test_1",
      status: "succeeded",
      metadata: { bookingId: "book_1", userId: OTHER.id },
    });

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(403);
    expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when the intent amount does not match the booking total", async () => {
    seedBooking();
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: "pi_test_1",
      status: "succeeded",
      amount: 5000, // $50.00, but the booking is $100.00
      currency: "usd",
      metadata: { bookingId: "book_1", userId: CUSTOMER.id },
    });

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({
      error: "Payment amount does not match booking total",
    });
  });

  it("returns 400 when the intent has not succeeded yet", async () => {
    seedBooking();
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: "pi_test_1",
      status: "requires_payment_method",
      metadata: { bookingId: "book_1", userId: CUSTOMER.id },
    });

    const response = await ConfirmPOST(
      createAuthedRequest(CUSTOMER_TOKEN, {
        method: "POST",
        url: "/api/payments/confirm",
        body: { bookingId: "book_1", paymentIntentId: "pi_test_1" },
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({
      error: "Payment not completed",
      status: "requires_payment_method",
    });
    expect(store("booking")[0].paymentStatus).toBe("pending");
  });
});
