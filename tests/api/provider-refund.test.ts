import { POST as RefundPOST } from "@/app/api/bookings/[id]/refund/route";
import { createMockRequest, createMockBooking } from "../utils/test-utils";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/integrations/stripe";

const mockStripe = stripe as any;

jest.mock("@/lib/db/prisma");
jest.mock("@/lib/integrations/stripe");

// The route exports `POST = withAuth(handler)`. Return a function that invokes
// the handler with a fake authenticated user so `user.userId` is defined — the
// ownership check compares it against `booking.providerId`.
jest.mock("@/middleware/auth", () => ({
  withAuth: (handler: any) => (request: any) =>
    handler(request, { userId: null, email: "provider@example.com", role: "provider" }),
}));

describe("Provider Refund API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/bookings/[id]/refund", () => {
    it("should refund a paid booking for the owning provider", async () => {
      // No token → the handler receives `user === null`, so make the booking's
      // provider null to satisfy the ownership check and exercise the happy path.
      const mockBooking = createMockBooking({
        id: "booking123",
        providerId: null as any,
        paymentStatus: "paid",
        totalPrice: 100,
        stripePaymentId: "pi_test123",
      });

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.booking.update as jest.Mock).mockResolvedValue({
        ...mockBooking,
        paymentStatus: "refunded",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/bookings/booking123/refund",
        body: {},
      });

      const result = await RefundPOST(request);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: "pi_test123",
        amount: undefined,
      });

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: "booking123" },
        data: {
          paymentStatus: "refunded",
          refundedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        booking: expect.objectContaining({
          id: "booking123",
          paymentStatus: "refunded",
        }),
        refund: expect.anything(),
        message: "Refund processed successfully",
      });
    });

    it("should return 404 when the booking does not exist", async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/bookings/missing/refund",
        body: {},
      });

      const result = await RefundPOST(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({ error: "Booking not found" });
    });

    it("should return 403 when the provider does not own the booking", async () => {
      const mockBooking = createMockBooking({
        id: "booking123",
        providerId: "someOtherProvider",
        paymentStatus: "paid",
      });

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const request = createMockRequest({
        method: "POST",
        url: "/api/bookings/booking123/refund",
        body: {},
      });

      const result = await RefundPOST(request);

      expect(result.status).toHaveBeenCalledWith(403);
      expect(result.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it("should return 400 when the booking is not paid", async () => {
      const mockBooking = createMockBooking({
        id: "booking123",
        providerId: null as any,
        paymentStatus: "pending",
      });

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const request = createMockRequest({
        method: "POST",
        url: "/api/bookings/booking123/refund",
        body: {},
      });

      const result = await RefundPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: "Only paid bookings can be refunded",
      });
    });

    it("should reject an invalid partial refund amount", async () => {
      const mockBooking = createMockBooking({
        id: "booking123",
        providerId: null as any,
        paymentStatus: "paid",
        totalPrice: 100,
      });

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const request = createMockRequest({
        method: "POST",
        url: "/api/bookings/booking123/refund",
        body: { amount: 500 },
      });

      const result = await RefundPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: "Invalid refund amount",
      });
    });
  });
});
