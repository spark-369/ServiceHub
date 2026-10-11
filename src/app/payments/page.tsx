"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface PaymentBooking {
  id: string;
  date: string;
  status: string;
  totalPrice: number;
  paymentStatus: "pending" | "paid" | "refunded";
  /** Timestamp the payment was captured (null until paid). */
  paidAt?: string | null;
  /** Timestamp a refund was issued (null unless refunded). */
  refundedAt?: string | null;
  /** Stripe PaymentIntent id (null when settled outside Stripe). */
  stripePaymentId?: string | null;
  /** Stripe customer id on record for this booking. */
  stripeCustomerId?: string | null;
  service: {
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  provider?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  createdAt: string;
}

type StatusFilter = "" | "pending" | "paid" | "refunded";

/** Full booking detail returned by GET /api/bookings/[id]. */
interface BookingDetail {
  id: string;
  date: string;
  status: string;
  notes?: string | null;
  totalPrice: number;
  paymentStatus: string;
  paidAt?: string | null;
  refundedAt?: string | null;
  stripePaymentId?: string | null;
  stripeCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
  service: {
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
  provider?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
}

/** Tailwind classes per payment status — one source of truth for the badge. */
const PAYMENT_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20",
  refunded: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
};

function paymentBadgeClass(status: string): string {
  return (
    PAYMENT_BADGE[status] ||
    "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20"
  );
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function PaymentsDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState<PaymentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const isProvider = user?.role === "provider";

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // The bookings endpoint is already scoped to the caller (a customer sees
      // only their own bookings, a provider only the ones they service), so a
      // single request gives us exactly the payments that concern this user.
      const params = new URLSearchParams({ limit: "100" });
      const response = await fetch(`/api/bookings?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load payments");
        setBookings([]);
        return;
      }

      setBookings(data.bookings || []);
    } catch {
      setError("Network error occurred");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user, fetchPayments]);

  // Detail modal state — the list payload is intentionally light, so we fetch
  // the full booking (address, notes, timestamps, Stripe refs) on demand.
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Refund state — only a provider can refund their own bookings.
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const openDetails = useCallback(async (bookingId: string) => {
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setDetail(data.booking);
      } else {
        setDetailError(data.error || "Failed to load details");
      }
    } catch {
      setDetailError("Network error occurred");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetails = () => {
    setDetail(null);
    setDetailError("");
  };

  const handleRefund = async (bookingId: string) => {
    if (
      !confirm(
        "Refund this payment to the customer? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setRefundingId(bookingId);
      const response = await fetch(`/api/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Refund failed");
        return;
      }

      toast.success("Payment refunded");
      // Refresh the list so the row reflects the new status.
      await fetchPayments();
    } catch {
      toast.error("Network error occurred");
    } finally {
      setRefundingId(null);
    }
  };


  // Roll up totals for the summary cards from the (already role-scoped) list.
  const totals = bookings.reduce(
    (acc, booking) => {
      const amount = Number(booking.totalPrice) || 0;
      if (booking.paymentStatus === "paid") acc.paid += amount;
      else if (booking.paymentStatus === "pending") acc.pending += amount;
      else if (booking.paymentStatus === "refunded") acc.refunded += amount;
      return acc;
    },
    { paid: 0, pending: 0, refunded: 0 },
  );

  const visibleBookings = statusFilter
    ? bookings.filter((b) => b.paymentStatus === statusFilter)
    : bookings;

  const filters: StatusFilter[] = ["", "pending", "paid", "refunded"];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-slate-100">Payments</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isProvider
              ? "Track the payments you've received and those still outstanding."
              : "Review your payments and settle any outstanding balances."}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-slate-900 border border-slate-800 shadow rounded-lg p-5">
          <p className="text-sm font-medium text-slate-400">
            {isProvider ? "Received" : "Paid"}
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {formatMoney(totals.paid)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 shadow rounded-lg p-5">
          <p className="text-sm font-medium text-slate-400">
            {isProvider ? "Outstanding" : "Due"}
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-400">
            {formatMoney(totals.pending)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 shadow rounded-lg p-5">
          <p className="text-sm font-medium text-slate-400">Refunded</p>
          <p className="mt-1 text-2xl font-semibold text-red-400">
            {formatMoney(totals.refunded)}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filters.map((value) => (
          <button
            key={value || "all"}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              statusFilter === value
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {value === ""
              ? "All"
              : value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Payments list */}
      <div className="mt-6 bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400">
              {bookings.length === 0
                ? "No payments yet."
                : "No payments match this filter."}
            </p>
            {bookings.length === 0 && !isProvider && (
              <Link
                href="/"
                className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block"
              >
                Browse services
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {visibleBookings.map((booking) => {
              // Only a customer can (and should) settle a balance, and only
              // while the booking is still awaiting payment.
              const canPay =
                !isProvider &&
                booking.paymentStatus === "pending" &&
                booking.status !== "cancelled";

              // Only a provider can refund, and only a booking that has been
              // paid (and not already refunded).
              const canRefund =
                isProvider && booking.paymentStatus === "paid";

              return (
                <li key={booking.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-indigo-400">
                          {booking.service?.name || "Service"}
                        </p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentBadgeClass(
                            booking.paymentStatus,
                          )}`}
                        >
                          {booking.paymentStatus}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {isProvider
                          ? `Customer: ${booking.user?.name || "Unknown"}`
                          : `Provider: ${booking.provider?.name || "Unknown"}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(booking.date).toLocaleString()}
                      </p>
                      {booking.paidAt && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Paid {new Date(booking.paidAt).toLocaleString()}
                        </p>
                      )}
                      {booking.refundedAt && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Refunded {new Date(booking.refundedAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="text-lg font-semibold text-slate-100">
                        {formatMoney(Number(booking.totalPrice) || 0)}
                      </span>
                      <button
                        onClick={() => openDetails(booking.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-slate-700 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
                      >
                        Details
                      </button>
                      {canPay && (
                        <Link
                          href={`/bookings/${booking.id}/pay`}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500"
                        >
                          Pay now
                        </Link>
                      )}
                      {canRefund && (
                        <button
                          onClick={() => handleRefund(booking.id)}
                          disabled={refundingId === booking.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
                        >
                          {refundingId === booking.id
                            ? "Refunding…"
                            : "Refund"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Showing {visibleBookings.length} of {bookings.length} payments.
      </p>

      {/* Payment details modal — every field we have on the booking/payment. */}
      {(detailLoading || detail || detailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-slate-900 border border-slate-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-100">
                Payment details
              </h3>
              <button
                onClick={closeDetails}
                className="text-slate-400 hover:text-slate-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-500" />
              </div>
            ) : detailError ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {detailError}
              </div>
            ) : detail ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailRow label="Service" value={detail.service?.name} />
                <DetailRow
                  label="Amount"
                  value={formatMoney(Number(detail.totalPrice) || 0)}
                />
                <DetailRow
                  label="Payment status"
                  value={
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadgeClass(
                        detail.paymentStatus,
                      )}`}
                    >
                      {detail.paymentStatus}
                    </span>
                  }
                />
                <DetailRow
                  label="Booking status"
                  value={detail.status?.replace("_", " ")}
                />
                <DetailRow
                  label="Paid at"
                  value={
                    detail.paidAt
                      ? new Date(detail.paidAt).toLocaleString()
                      : "—"
                  }
                />
                <DetailRow
                  label="Refunded at"
                  value={
                    detail.refundedAt
                      ? new Date(detail.refundedAt).toLocaleString()
                      : "—"
                  }
                />
                <DetailRow
                  label="Stripe payment ID"
                  value={
                    detail.stripePaymentId ? (
                      <span className="break-all">{detail.stripePaymentId}</span>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailRow
                  label="Stripe customer ID"
                  value={
                    detail.stripeCustomerId ? (
                      <span className="break-all">{detail.stripeCustomerId}</span>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailRow
                  label="Scheduled for"
                  value={new Date(detail.date).toLocaleString()}
                />
                <DetailRow
                  label="Duration"
                  value={
                    detail.service?.duration
                      ? `${detail.service.duration} min`
                      : undefined
                  }
                />
                <DetailRow
                  label="Customer"
                  value={detail.user?.name || "—"}
                />
                <DetailRow
                  label="Customer email"
                  value={detail.user?.email || "—"}
                />
                <DetailRow
                  label="Customer phone"
                  value={detail.user?.phone || "—"}
                />
                <DetailRow
                  label="Customer address"
                  value={detail.user?.address || "—"}
                />
                <DetailRow
                  label="Provider"
                  value={detail.provider?.name || "—"}
                />
                <DetailRow
                  label="Provider email"
                  value={detail.provider?.email || "—"}
                />
                <DetailRow
                  label="Provider phone"
                  value={detail.provider?.phone || "—"}
                />
                <DetailRow
                  label="Provider address"
                  value={detail.provider?.address || "—"}
                />
                <DetailRow
                  label="Created"
                  value={new Date(detail.createdAt).toLocaleString()}
                />
                <DetailRow
                  label="Last updated"
                  value={new Date(detail.updatedAt).toLocaleString()}
                />
                {detail.service?.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Description
                    </dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {detail.service.description}
                    </dd>
                  </div>
                )}
                {detail.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Notes
                    </dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {detail.notes}
                    </dd>
                  </div>
                )}
              </dl>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small definition-list row used by the details modal. */
function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-100">{value || "—"}</dd>
    </div>
  );
}
