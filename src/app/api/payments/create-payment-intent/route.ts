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

    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
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

    // Check if payment already exists
    const existingPayment = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { paymentStatus: true },
    });

    if (existingPayment?.paymentStatus === 'paid') {
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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(booking.totalPrice, 'usd'),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingId: bookingId,
        userId: user.userId,
        serviceId: booking.serviceId,
      },
    });

    // Persist the payment intent id so webhooks/refunds can reconcile the
    // booking even if the client never calls the confirm endpoint.
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        stripePaymentId: paymentIntent.id,
        ...(typeof paymentIntent.customer === 'string'
          ? { stripeCustomerId: paymentIntent.customer }
          : {}),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}