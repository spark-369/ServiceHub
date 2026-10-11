"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/features/StatCard";
import { Badge, StatusBadge } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatMoney, formatRating } from "@/lib/format";

interface AdminStats {
  users: { total: number; providers: number; customers: number };
  services: { total: number; active: number; inactive: number };
  bookings: {
    total: number;
    completed: number;
    pending: number;
    byStatus: Record<string, number>;
  };
  reviews: { total: number; averageRating: number };
  revenue: { total: number; paidBookings: number };
}

const EMPTY_STATS: AdminStats = {
  users: { total: 0, providers: 0, customers: 0 },
  services: { total: 0, active: 0, inactive: 0 },
  bookings: { total: 0, completed: 0, pending: 0, byStatus: {} },
  reviews: { total: 0, averageRating: 0 },
  revenue: { total: 0, paidBookings: 0 },
};

const bookingStatuses = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        if (response.ok) {
          if (active) setStats(data.stats);
        } else {
          const message = data.error || "Failed to load overview";
          if (active) setError(message);
          toast.error(message);
        }
      } catch (err) {
        console.error("Overview fetch error:", err);
        if (active) setError("Failed to load overview");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchStats();
    return () => {
      active = false;
    };
  }, [toast]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatMoney(stats.revenue.total)}
          hint={`${stats.revenue.paidBookings} paid bookings`}
        />
        <StatCard
          label="Bookings"
          value={stats.bookings.total}
          hint={`${stats.bookings.completed} completed`}
        />
        <StatCard
          label="Active services"
          value={stats.services.active}
          hint={`${stats.services.inactive} inactive`}
        />
        <StatCard
          label="Avg. rating"
          value={`${formatRating(stats.reviews.averageRating)} ★`}
          hint={`${stats.reviews.total} reviews`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-base font-semibold text-slate-100">Users</h3>
          <dl className="mt-4 space-y-3">
            <Row label="Total users" value={stats.users.total} />
            <Row label="Providers" value={stats.users.providers} />
            <Row label="Customers" value={stats.users.customers} />
          </dl>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-base font-semibold text-slate-100">Booking status</h3>
          <dl className="mt-4 space-y-3">
            {bookingStatuses.map((status) => (
              <div key={status} className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">
                  <StatusBadge status={status} />
                </dt>
                <dd className="text-sm font-medium text-slate-100">
                  {stats.bookings.byStatus[status] ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">Services</h3>
          <Badge tone="info">{stats.services.total} total</Badge>
        </div>
        <div className="mt-4 flex items-end gap-4">
          <Bar value={stats.services.active} label="Active" tone="bg-indigo-500" />
          <Bar value={stats.services.inactive} label="Inactive" tone="bg-slate-600" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-100">{value}</dd>
    </div>
  );
}

function Bar({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  const width = Math.min(100, Math.max(4, value * 10));
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-100">{value}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

