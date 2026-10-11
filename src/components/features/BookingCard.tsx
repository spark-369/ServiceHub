import type { ReactNode } from "react";
import type { Booking } from "@/lib/types";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

/**
 * A single booking row. Used by the customer bookings dashboard and can be
 * reused by provider/payment views. Actions are passed in as a node so the
 * caller controls which buttons apply to the current role.
 */
export default function BookingCard({
  booking,
  actions,
  children,
}: {
  booking: Booking;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const counterparty =
    booking.provider?.name ?? booking.user?.name ?? "—";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-medium text-slate-100">
              {booking.service.name}
            </h3>
            <StatusBadge status={booking.status} kind="booking" />
            <StatusBadge status={booking.paymentStatus} kind="payment" />
          </div>

          <p className="mt-1 line-clamp-2 text-sm text-slate-400">
            {booking.service.description}
          </p>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-500">Date</dt>
              <dd className="text-slate-300">{formatDate(booking.date)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-500">With</dt>
              <dd className="text-slate-300">{counterparty}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-500">Booked</dt>
              <dd className="text-slate-300">{formatDateTime(booking.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <span className="text-2xl font-bold text-slate-100">
            {formatMoney(booking.totalPrice)}
          </span>
          {actions && (
            <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
          )}
        </div>
      </div>

      {children && (
        <div className="border-t border-slate-800 px-6 py-4">{children}</div>
      )}
    </div>
  );
}
