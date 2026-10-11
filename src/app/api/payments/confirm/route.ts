import { NextRequest, NextResponse } from 'next/server';
import { stripe, formatAmountForStripe } from '@/lib/integrations/stripe';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, paymentIntentId } = await request.json();

    if (!bookingId || !paymentIntentId) {
      return NextResponse.json(
        { error: 'Booking ID and Payment Intent ID are required' },
        { status: 400 }
      );
    }

    // Get the booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify the user owns this booking
    if (booking.userId !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if payment already exists and is paid
    if (booking.paymentStatus === 'paid') {
      return NextResponse.json(
        { error: 'Payment already completed' },
        { status: 400 }
      );
    }

    // Check if Stripe is properly initialized
    if (!stripe) {
      return NextResponse.json(
        { error: 'Payment system not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Retrieve the payment intent from Stripe to verify payment status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Ensure the intent actually belongs to this booking and this user before
    // marking anything paid (prevents "confirm" being used with an unrelated
    // succeeded intent id).
    const meta = paymentIntent.metadata ?? {};
    if (meta.bookingId && meta.bookingId !== bookingId) {
      return NextResponse.json(
        { error: "Payment intent does not match this booking" },
        { status: 400 }
      );
    }
    if (meta.userId && meta.userId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If we already stored this intent id, it must match too.
    if (
      booking.stripePaymentId &&
      booking.stripePaymentId !== paymentIntent.id
    ) {
      return NextResponse.json(
        { error: "Payment intent does not match this booking" },
        { status: 400 }
      );
    }

    // Optionally sanity-check the amount when both are present.
    if (
      typeof paymentIntent.amount === "number" &&
      paymentIntent.amount !==
        formatAmountForStripe(booking.totalPrice, paymentIntent.currency)
    ) {
      return NextResponse.json(
        { error: "Payment amount does not match booking total" },
        { status: 400 }
      );
    }

    if (paymentIntent.status === 'succeeded') {
      // Update booking payment status
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'paid',
          paidAt: new Date(),
          stripePaymentId: paymentIntent.id,
          ...(typeof paymentIntent.customer === 'string'
            ? { stripeCustomerId: paymentIntent.customer }
            : {}),
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Payment confirmed successfully' 
      });
    } else {
      return NextResponse.json(
        { error: 'Payment not completed', status: paymentIntent.status },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}