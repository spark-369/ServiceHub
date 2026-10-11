"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/context/ToastContext";

interface Payment {
  id: string;
  date: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  /** Payment lifecycle timestamps + Stripe references from the booking row. */
  paidAt?: string | null;
  refundedAt?: string | null;
  stripePaymentId?: string | null;
  stripeCustomerId?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  provider: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  service: {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  statusDistribution: Array<{
    paymentStatus: string;
    count: number;
    totalRevenue: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    count: number;
    revenue: number;
  }>;
}

interface PaymentManagementProps {
  onDataChange?: () => void;
}

export default function PaymentManagement({
  onDataChange,
}: PaymentManagementProps) {
  const toast = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [filters, setFilters] = useState<{ statuses: string[] }>({
    statuses: [],
  });
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/admin/payments?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setPayments(data.payments);
        setPagination(data.pagination);
        setStats(data.stats);
        setFilters(data.filters);
      } else {
        setError(data.error || "Failed to fetch payments");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [currentPage, searchTerm, statusFilter]);

  const handlePaymentAction = async (
    bookingId: string,
    action: string,
    amount?: number
  ) => {
    try {
      setBusyPaymentId(bookingId);
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ action, bookingId, amount }),
      });

      const data = await response.json();

      if (response.ok) {
        fetchPayments();
        onDataChange?.();
        toast.success(data.message || "Action completed successfully");
      } else {
        setError(data.error || `Failed to ${action} payment`);
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setBusyPaymentId(null);
    }
  };

  // Admin CRUD — update a payment's status via the PUT endpoint.
  const handleUpdateStatus = async (bookingId: string, paymentStatus: string) => {
    try {
      setBusyPaymentId(bookingId);
      const response = await fetch("/api/admin/payments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ bookingId, paymentStatus }),
      });

      const data = await response.json();

      if (response.ok) {
        fetchPayments();
        onDataChange?.();
        toast.success("Payment updated");
      } else {
        toast.error(data.error || "Failed to update payment");
      }
    } catch (error) {
      toast.error("Network error occurred");
    } finally {
      setBusyPaymentId(null);
    }
  };

  // Admin CRUD — delete the payment record (resets the booking's payment fields).
  const handleDeletePayment = async (bookingId: string) => {
    if (
      !confirm(
        "Delete this payment record? The booking is kept, but its payment fields are reset."
      )
    ) {
      return;
    }

    try {
      setBusyPaymentId(bookingId);
      const response = await fetch(
        `/api/admin/payments?bookingId=${encodeURIComponent(bookingId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        fetchPayments();
        onDataChange?.();
        toast.success("Payment record deleted");
      } else {
        toast.error(data.error || "Failed to delete payment");
      }
    } catch (error) {
      toast.error("Network error occurred");
    } finally {
      setBusyPaymentId(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20";
      case "refunded":
        return "bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20";
      default:
        return "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20";
    }
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg leading-6 font-medium text-slate-100">
            Payment Management
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Monitor transactions, process refunds, and view payment analytics
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 text-slate-100 px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-40"
          >
            <option value="" className="bg-slate-900 text-slate-100">All Status</option>
            {filters.statuses.map((status) => (
              <option key={status} value={status} className="bg-slate-900 text-slate-100">
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">$</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">
                    Total Revenue
                  </dt>
                  <dd className="text-lg font-medium text-slate-100">
                    ${stats.totalRevenue.toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">#</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">
                    Total Transactions
                  </dt>
                  <dd className="text-lg font-medium text-slate-100">
                    {stats.totalTransactions}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">%</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">
                    Paid Transactions
                  </dt>
                  <dd className="text-lg font-medium text-slate-100">
                    {stats.statusDistribution.find(
                      (s) => s.paymentStatus === "paid"
                    )?.count || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">↺</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">
                    Refunded
                  </dt>
                  <dd className="text-lg font-medium text-slate-100">
                    {stats.statusDistribution.find(
                      (s) => s.paymentStatus === "refunded"
                    )?.count || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-slate-800">
          {payments.map((payment) => (
            <li key={payment.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-slate-100">
                        {payment.service.name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Customer: {payment.user.name} ({payment.user.email})
                      </p>
                      <p className="text-sm text-slate-400">
                        Provider: {payment.provider?.name ?? "Unknown"}
                        {payment.provider?.email ? ` (${payment.provider.email})` : ""}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Category: {payment.service.category}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-slate-100">
                        ${payment.totalPrice}
                      </div>
                      <div className="text-sm text-slate-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center space-x-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        payment.paymentStatus
                      )}`}
                    >
                      {payment.paymentStatus}
                    </span>
                    <span className="text-sm text-slate-500">
                      Service Price: ${payment.service.price}
                    </span>
                  </div>

                  {/* Payment lifecycle + Stripe references stored on the booking. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    {payment.paidAt && (
                      <span>
                        Paid: {new Date(payment.paidAt).toLocaleString()}
                      </span>
                    )}
                    {payment.refundedAt && (
                      <span>
                        Refunded:{" "}
                        {new Date(payment.refundedAt).toLocaleString()}
                      </span>
                    )}
                    {payment.stripePaymentId && (
                      <span className="break-all">
                        Stripe payment: {payment.stripePaymentId}
                      </span>
                    )}
                    {payment.stripeCustomerId && (
                      <span className="break-all">
                        Stripe customer: {payment.stripeCustomerId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex space-x-2">
                {payment.paymentStatus === "paid" && (
                  <>
                    <button
                      onClick={() =>
                        handleUpdateStatus(
                          payment.id,
                          payment.paymentStatus === "paid" ? "pending" : "paid"
                        )
                      }
                      disabled={busyPaymentId === payment.id}
                      className="inline-flex items-center px-3 py-1 border border-slate-700 text-sm font-medium rounded-md text-indigo-300 bg-slate-800 hover:bg-indigo-500/10 disabled:opacity-50"
                    >
                      {busyPaymentId === payment.id
                        ? "Saving..."
                        : payment.paymentStatus === "paid"
                          ? "Mark Unpaid"
                          : "Mark Paid"}
                    </button>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={busyPaymentId === payment.id}
                      className="inline-flex items-center px-3 py-1 border border-red-500/30 text-sm font-medium rounded-md text-red-300 bg-slate-800 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
                {payment.paymentStatus === "pending" && (
                  <button
                    onClick={() => handlePaymentAction(payment.id, "mark_paid")}
                    className="inline-flex items-center px-3 py-1 border border-emerald-500/30 text-sm font-medium rounded-md text-emerald-300 bg-slate-800 hover:bg-emerald-500/10"
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {payments.length === 0 && !loading && (
          <div className="px-6 py-8 text-center text-slate-400">
            No payments found
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-slate-300">
              Page {currentPage} of {pagination.pages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pagination.pages}
              className="px-3 py-2 text-sm border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Monthly Revenue Chart (if data available) */}
      {stats?.monthlyRevenue && stats.monthlyRevenue.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-slate-100 mb-4">
            Monthly Revenue (Last 12 Months)
          </h4>
          <div className="space-y-2">
            {stats.monthlyRevenue.slice(0, 6).map((month, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-slate-800 last:border-b-0"
              >
                <span className="text-sm text-slate-400">
                  {new Date(month.month).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <div className="text-sm">
                  <span className="font-medium text-slate-100">
                    ${Number(month.revenue).toFixed(2)}
                  </span>
                  <span className="text-slate-500 ml-2">
                    ({month.count} transactions)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
