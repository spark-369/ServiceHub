import { POST as StripeWebhookPOST } from "@/app/api/webhooks/stripe/route";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/integrations/stripe";
import { createMockRequest } from '../utils/test-utils';

jest.mock("@/lib/db/prisma");
jest.mock("@/lib/integrations/stripe", () => ({
  __esModule: true,
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
}));

const mockStripe = stripe as any;

function buildEvent(overrides: any = {}) {
  return {
    id: "evt_test_1",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_1",
        metadata: { bookingId: "booking123" },
        amount_received: 10000,
        customer: "cus_test_1",
      },
    },
    ...overrides,
  };
}

describe("Stripe Webhook API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reject requests without a signature header", async () => {
    const request = createMockRequest({ method: "POST" });
    const response = await StripeWebhookPOST(request as any);

    expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "BAD_REQUEST" })
    );
  });

  it("should reject invalid webhook signatures", async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found");
    });

    const request = createMockRequest({
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bad" },
    });
    (request as any).text = jest.fn().mockResolvedValue("{}");

    const response = await StripeWebhookPOST(request as any);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid webhook signature" })
    );
  });

  it("should mark a booking as paid on payment_intent.succeeded", async () => {
    const event = buildEvent();
    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: event.id });
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
      id: "booking123",
      paymentStatus: "pending",
    });
    (prisma.booking.update as jest.Mock).mockResolvedValue({ id: "booking123" });

    const request = createMockRequest({
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=good" },
    });
    (request as any).text = jest.fn().mockResolvedValue(JSON.stringify(event));

    const response = await StripeWebhookPOST(request as any);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "booking123" },
      data: expect.objectContaining({
        paymentStatus: "paid",
        stripePaymentId: "pi_test_1",
        stripeCustomerId: "cus_test_1",
      }),
    });
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });

  it("should ignore duplicate deliveries of the same event", async () => {
    const event = buildEvent();
    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    // Simulate Prisma unique constraint violation (already processed).
    (prisma.webhookEvent.create as jest.Mock).mockRejectedValue({ code: "P2002" });

    const request = createMockRequest({
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=good" },
    });
    (request as any).text = jest.fn().mockResolvedValue(JSON.stringify(event));

    const response = await StripeWebhookPOST(request as any);

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  it("should mark a booking as refunded on charge.refunded", async () => {
    const event = buildEvent({
      id: "evt_refund_1",
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_test_1" } },
    });
    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: event.id });
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
      id: "booking123",
      paymentStatus: "paid",
    });
    (prisma.booking.update as jest.Mock).mockResolvedValue({ id: "booking123" });

    const request = createMockRequest({
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=good" },
    });
    (request as any).text = jest.fn().mockResolvedValue(JSON.stringify(event));

    await StripeWebhookPOST(request as any);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "booking123" },
      data: expect.objectContaining({ paymentStatus: "refunded" }),
    });
  });
});
