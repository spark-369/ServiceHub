import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withAuth } from "@/middleware/auth";
import { stripe, formatAmountForStripe } from "@/lib/integrations/stripe";

/**
 * POST /api/bookings/[id]/refund
 *
 * Lets a *service provider* refund the customer for a booking they serviced.
 * Only the provider who owns the booking may call this, and only a booking that
 * is currently `paid` can be refunded.
 *
 * The refund is issued through Stripe (when a payment intent is on record) and
 * the booking's `paymentStatus` is moved to `refunded`.
 */
export const POST = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { pathname } = new URL(request.url);
    // Path is /api/bookings/<id>/refund — the id is the second-to-last segment.
    const segments = pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 2];

    if (!id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Body is optional; `amount` allows a partial refund (major units).
    let amount: number | undefined;
    try {
      const body = await request.json();
      if (body?.amount !== undefined && body?.amount !== null) {
        amount = Number(body.amount);
      }
    } catch {
      // No/invalid body — treat as a full refund.
    }

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only the provider who owns this booking may refund it. Admins have their
    // own payments console and customers cannot move money back to themselves.
    if (booking.providerId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (booking.paymentStatus !== "paid") {
      return NextResponse.json(
        { error: "Only paid bookings can be refunded" },
        { status: 400 },
      );
    }

    // Validate a partial amount against the booking total.
    if (amount !== undefined) {
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > booking.totalPrice
      ) {
        return NextResponse.json(
          { error: "Invalid refund amount" },
          { status: 400 },
        );
      }
    }

    const anyBooking = booking as any;

    // Issue the Stripe refund when we have a payment intent on record. If the
    // booking was settled without Stripe we still mark it refunded so the two
    // parties' records stay in sync.
    let refundResult = null;
    if (anyBooking.stripePaymentId && stripe) {
      try {
        refundResult = await stripe.refunds.create({
          payment_intent: anyBooking.stripePaymentId,
          amount:
            amount !== undefined
              ? formatAmountForStripe(amount, "usd")
              : undefined,
        });
      } catch (stripeError: any) {
        console.error("Provider refund error:", stripeError);
        return NextResponse.json(
          { error: "Refund processing failed: " + stripeError.message },
          { status: 400 },
        );
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: "refunded",
        refundedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      booking: {
        id: updatedBooking.id,
        paymentStatus: updatedBooking.paymentStatus,
      },
      refund: refundResult,
      message: "Refund processed successfully",
    });
  } catch (error) {
    console.error("Provider refund error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
