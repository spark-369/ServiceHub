import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/integrations/stripe";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/config/logger";
import { ApiError, withApiHandler } from "@/lib/api/errors";

/**
 * Stripe webhook handler.
 *
 * This is the authoritative source of truth for payment state. Relying solely
 * on the client calling `/api/payments/confirm` is unreliable (a user could
 * close the tab after paying) and spoofable. Idempotency is guaranteed by the
 * {@link WebhookEvent} table: duplicate deliveries are ignored.
 */

// Stripe needs the raw body to verify signatures, so this route must run on the
// Node.js runtime and must never be statically optimised / cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeWebhookEvent = Stripe.Event;

async function markEventProcessed(event: StripeWebhookEvent): Promise<boolean> {
  // Returns false when the event was already recorded (duplicate delivery).
  try {
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        provider: "stripe",
      },
    });
    return true;
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return false; // already processed
    }
    throw error;
  }
}

async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent
): Promise<void> {
  const bookingId = intent.metadata?.bookingId;
  if (!bookingId) {
    logger.warn("payment_intent.succeeded without bookingId metadata", {
      paymentIntentId: intent.id,
    });
    return;
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    logger.warn("payment_intent.succeeded for unknown booking", {
      bookingId,
      paymentIntentId: intent.id,
    });
    return;
  }

  if (booking.paymentStatus === "paid") {
    return; // already reconciled
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: "paid",
      paidAt: new Date(),
      stripePaymentId: intent.id,
      ...(typeof intent.customer === "string"
        ? { stripeCustomerId: intent.customer }
        : {}),
    },
  });

  logger.info("Booking marked as paid via webhook", {
    bookingId,
    paymentIntentId: intent.id,
    amount: intent.amount_received,
  });
}

async function handlePaymentIntentFailed(
  intent: Stripe.PaymentIntent
): Promise<void> {
  const bookingId = intent.metadata?.bookingId;
  if (!bookingId) return;

  logger.warn("payment_intent.payment_failed", {
    bookingId,
    paymentIntentId: intent.id,
    reason: intent.last_payment_error?.message,
  });

  // Ensure the booking stays in a payable state and record the intent id.
  await prisma.booking
    .update({
      where: { id: bookingId },
      data: { stripePaymentId: intent.id },
    })
    .catch(() => undefined);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!intentId) return;

  const booking = await prisma.booking.findFirst({
    where: { stripePaymentId: intentId },
  });

  if (!booking) {
    logger.warn("charge.refunded for unknown payment intent", { intentId });
    return;
  }

  if (booking.paymentStatus === "refunded") return;

  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: "refunded", refundedAt: new Date() },
  });

  logger.info("Booking marked as refunded via webhook", {
    bookingId: booking.id,
    intentId,
  });
}

async function dispatch(event: StripeWebhookEvent): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;
    default:
      logger.debug("Unhandled Stripe event type", { type: event.type });
  }
}

export const POST = withApiHandler(async (request) => {
  if (!stripe) {
    throw ApiError.serviceUnavailable("Payment system not configured");
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    throw ApiError.serviceUnavailable("Stripe webhook secret not configured");
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    throw ApiError.badRequest("Missing stripe-signature header");
  }

  const rawBody = await request.text();

  let event: StripeWebhookEvent;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    logger.warn("Stripe webhook signature verification failed", { error });
    throw ApiError.badRequest("Invalid webhook signature");
  }

  const isNew = await markEventProcessed(event);
  if (!isNew) {
    // Acknowledge duplicates so Stripe stops retrying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await dispatch(event);
  } catch (error) {
    logger.error("Error processing Stripe webhook", {
      error,
      eventId: event.id,
      eventType: event.type,
    });
    // Return 500 so Stripe retries, but remove the idempotency marker so the
    // retry is actually processed.
    await prisma.webhookEvent
      .delete({ where: { id: event.id } })
      .catch(() => undefined);
    throw error;
  }

  return NextResponse.json({ received: true });
});

// Stripe only sends POST; respond to others with a clear 405.
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    { status: 405 }
  );
}
