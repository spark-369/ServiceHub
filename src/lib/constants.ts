/**
 * Shared UI constants.
 *
 * Centralised so the home page, provider form and admin console all offer the
 * same category list (they previously each declared their own copy).
 */

export const SERVICE_CATEGORIES = [
  "Cleaning",
  "Plumbing",
  "Electrical",
  "Gardening",
  "Tutoring",
  "Fitness",
  "Beauty",
  "Automotive",
  "Other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** Booking lifecycle options used by filters and status selects. */
export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "refunded"] as const;

/** Human-friendly labels for the database role enum. */
export const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  user: "Customer",
  provider: "Provider",
  admin: "Admin",
};

/** Title-cases a snake_case status value, e.g. `in_progress` → "In Progress". */
export function humanizeStatus(status: string): string {
  return status
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
