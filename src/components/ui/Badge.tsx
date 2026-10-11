import type { ReactNode } from "react";
import { humanizeStatus } from "@/lib/constants";

/**
 * Pill primitive. Tones reuse the exact ring-inset treatment already present
 * on payment/active badges, so this is a visual no-op where it replaces them.
 */

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
  info: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
  success: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  danger: "bg-red-500/10 text-red-300 ring-red-500/20",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Domain status → tone mapping (the "one place").
// ---------------------------------------------------------------------------

const BOOKING_TONES: Record<string, BadgeTone> = {
  pending: "warning",
  confirmed: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "danger",
};

const PAYMENT_TONES: Record<string, BadgeTone> = {
  pending: "warning",
  paid: "success",
  refunded: "danger",
};

/** Tone for a booking lifecycle status (unknown values fall back to neutral). */
export function bookingTone(status: string): BadgeTone {
  return BOOKING_TONES[status] ?? "neutral";
}

/** Tone for a payment status. */
export function paymentTone(status: string): BadgeTone {
  return PAYMENT_TONES[status] ?? "neutral";
}

export function StatusBadge({
  status,
  kind = "booking",
}: {
  status: string;
  kind?: "booking" | "payment";
}) {
  const tone = kind === "payment" ? paymentTone(status) : bookingTone(status);
  return <Badge tone={tone}>{humanizeStatus(status)}</Badge>;
}

/** Active/Inactive badge used by provider and admin service lists. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "danger"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
