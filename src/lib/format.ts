/**
 * Presentation helpers shared across the UI.
 *
 * Kept framework-free (no React) so they can be used in server and client
 * components, and unit-tested in isolation.
 */

/** Formats a numeric amount as USD, e.g. `12` → "$12.00". */
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Formats an ISO date/timestamp for display. Falls back to the raw value when
 * the input is not a valid date so bad data never renders "Invalid Date".
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats an ISO timestamp with both date and time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Renders a service duration in minutes, e.g. `90` → "1h 30m". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Formats an average rating to one decimal, guarding against NaN. */
export function formatRating(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return "0.0";
  return rating.toFixed(1);
}

/** Clamps a 0–1 relevance score into a whole-percent string, e.g. 0.834 → "83%". */
export function formatMatchScore(score: number): string {
  const clamped = Math.max(0, Math.min(1, score));
  return `${Math.round(clamped * 100)}%`;
}
