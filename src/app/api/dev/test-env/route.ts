import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug helper: reports whether Stripe keys are present (never the values).
 *
 * Hard-disabled in production so it can never leak configuration.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Optionally require an API key even in non-production environments.
  const expectedKey = process.env.DEBUG_API_KEY;
  if (expectedKey) {
    const provided =
      request.headers.get('x-api-key') ||
      request.nextUrl.searchParams.get('key');
    if (provided !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return NextResponse.json({
    hasStripeSecretKey: !!stripeSecretKey,
    hasStripePublishableKey: !!stripePublishableKey,
    stripeSecretKeyLength: stripeSecretKey ? stripeSecretKey.length : 0,
    stripePublishableKeyLength: stripePublishableKey ? stripePublishableKey.length : 0,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasRedisUrl: !!process.env.REDIS_URL,
    env: process.env.NODE_ENV,
  });
}