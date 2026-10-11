import Stripe from "stripe";
import { getEnv, isStripeConfigured } from "@/lib/config/env";

/**
 * Stripe server client.
 *
 * `stripe` is `null` when credentials are not configured, allowing routes to
 * degrade gracefully. Use {@link requireStripe} when Stripe is mandatory.
 */

const STRIPE_API_VERSION = "2026-01-28.clover" as const;

const env = getEnv();

const stripeSecretKey = env.STRIPE_SECRET_KEY;
const stripePublishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

export const stripe: Stripe | null =
  stripeSecretKey && isStripeConfigured()
    ? new Stripe(stripeSecretKey, {
        apiVersion: STRIPE_API_VERSION,
        typescript: true,
        maxNetworkRetries: 2,
        timeout: 20000,
        appInfo: {
          name: "Homely",
          version: "1.0.0",
        },
      })
    : null;

/** Throws if Stripe is not configured. */
export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments."
    );
  }
  return stripe;
}

export const STRIPE_PUBLISHABLE_KEY = stripePublishableKey;

export const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;

/** Whether the publishable key looks usable on the client. */
export function isStripePublishableConfigured(): boolean {
  return /^pk_(test|live)_/.test(stripePublishableKey);
}

/**
 * Convert a major-unit amount (e.g. dollars) into Stripe's minor units (cents).
 *
 * Stripe expects integer amounts in the currency's smallest unit for
 * "decimal" currencies (USD, EUR, …) but the raw integer for zero-decimal
 * currencies (JPY, KRW, …). We detect zero-decimal currencies via the
 * presence of a decimal separator in the formatted output — if there is no
 * decimal part the currency is zero-decimal and must NOT be multiplied.
 */
export const formatAmountForStripe = (
  amount: number,
  currency: string,
): number => {
  if (isZeroDecimalCurrency(currency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
};

export const formatAmountFromStripe = (
  amount: number,
  currency: string,
): number => {
  if (isZeroDecimalCurrency(currency)) {
    return amount;
  }
  return amount / 100;
};

/** A currency is zero-decimal when formatting adds no decimal separator. */
function isZeroDecimalCurrency(currency: string): boolean {
  try {
    const numberFormat = new Intl.NumberFormat(["en-US"], {
      style: "currency",
      currency: currency,
      currencyDisplay: "symbol",
    });
    const parts = numberFormat.formatToParts(1);
    return !parts.some((part) => part.type === "decimal");
  } catch {
    // Unknown/invalid currency code — assume a decimal currency (2 minors).
    return false;
  }
}
