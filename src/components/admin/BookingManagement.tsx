'use client';

import { useState, useEffect } from 'react';

interface Booking {
  id: string;
  date: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  /** Payment lifecycle timestamps + Stripe refs stored on the booking row. */
  paidAt?: string | null;
  refundedAt?: string | null;
  stripePaymentId?: string | null;
  stripeCustomerId?: string | null;
  notes?: string;
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
  review?: {
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
  };
}

interface BookingManagementProps {
  onDataChange?: () => void;
}

export default function BookingManagement({ onDataChange }: BookingManagementProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState<{ statuses: string[]; paymentStatuses: string[] }>({ statuses: [], paymentStatuses: [] });
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(paymentStatusFilter && { paymentStatus: paymentStatusFilter }),
      });

      const response = await fetch(`/api/admin/bookings?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setBookings(data.bookings);
        setPagination(data.pagination);
        setFilters(data.filters);
      } else {
        setError(data.error || 'Failed to fetch bookings');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [currentPage, searchTerm, statusFilter, paymentStatusFilter]);

  const handleUpdateBooking = async (bookingId: string, updates: any) => {
    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ bookingId, updates }),
      });

      if (response.ok) {
        setEditingBooking(null);
        fetchBookings();
        onDataChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update booking');
      }
    } catch (error) {
      setError('Network error occurred');
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/bookings?id=${bookingId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        fetchBookings();
        onDataChange?.();
      } else {
        setError(data.error || 'Failed to delete booking');
      }
    } catch (error) {
      setError('Network error occurred');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20';
      case 'confirmed':
        return 'bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20';
      case 'in_progress':
        return 'bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20';
    }
  };

  const getPaymentStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20';
      case 'refunded':
        return 'bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20';
    }
  };

  if (loading && bookings.length === 0) {
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
          <h3 className="text-lg leading-6 font-medium text-slate-100">Booking Management</h3>
          <p className="mt-1 text-sm text-slate-400">
            Monitor and manage all service bookings
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 text-slate-100 px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-40"
          >
            <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "160px" }}>All Status</option>
            {filters.statuses.map((status) => (
              <option key={status} value={status} className="bg-slate-900 text-slate-100" style={{ minWidth: "160px" }}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="bg-slate-900 text-slate-100 px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-48"
          >
            <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "192px" }}>All Payment Status</option>
            {filters.paymentStatuses.map((status) => (
              <option key={status} value={status} className="bg-slate-900 text-slate-100" style={{ minWidth: "192px" }}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {/* Bookings Table */}
      <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-slate-800">
          {bookings.map((booking) => (
            <li key={booking.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-slate-100">
                        {booking.service.name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Customer: {booking.user.name} ({booking.user.email})
                      </p>
                      <p className="text-sm text-slate-400">
                        Provider: {booking.provider?.name ?? "Unknown"}
                        {booking.provider?.email ? ` (${booking.provider.email})` : ""}
                      </p>
                      {booking.notes && (
                        <p className="text-sm text-slate-500 mt-1">
                          Notes: {booking.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-slate-100">
                        ${booking.totalPrice}
                      </div>
                      <div className="text-sm text-slate-500">
                        {new Date(booking.date).toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-500">
                        Created: {new Date(booking.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center space-x-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(booking.status)}`}
                    >
                      {booking.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusBadgeColor(booking.paymentStatus)}`}
                    >
                      Payment: {booking.paymentStatus}
                    </span>
                    {booking.review && (
                      <span className="text-sm text-slate-400">
                        ⭐ {booking.review.rating} - {booking.review.comment || 'No comment'}
                      </span>
                    )}
                  </div>

                  {/* Payment lifecycle + Stripe references stored on the booking. */}
                  {(booking.paidAt ||
                    booking.refundedAt ||
                    booking.stripePaymentId ||
                    booking.stripeCustomerId) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {booking.paidAt && (
                        <span>
                          Paid: {new Date(booking.paidAt).toLocaleString()}
                        </span>
                      )}
                      {booking.refundedAt && (
                        <span>
                          Refunded:{" "}
                          {new Date(booking.refundedAt).toLocaleString()}
                        </span>
                      )}
                      {booking.stripePaymentId && (
                        <span className="break-all">
                          Stripe payment: {booking.stripePaymentId}
                        </span>
                      )}
                      {booking.stripeCustomerId && (
                        <span className="break-all">
                          Stripe customer: {booking.stripeCustomerId}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => setEditingBooking(booking)}
                  className="inline-flex items-center px-3 py-1 border border-slate-700 text-sm font-medium rounded-md text-indigo-300 bg-slate-800 hover:bg-indigo-500/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteBooking(booking.id)}
                  className="inline-flex items-center px-3 py-1 border border-red-500/30 text-sm font-medium rounded-md text-red-300 bg-slate-800 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {bookings.length === 0 && !loading && (
          <div className="px-6 py-8 text-center text-slate-400">
            No bookings found
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
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

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Edit Booking</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const updates = {
                  status: formData.get('status'),
                  paymentStatus: formData.get('paymentStatus'),
                  notes: formData.get('notes'),
                };
                handleUpdateBooking(editingBooking.id, updates);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300">Booking Status</label>
                <select
                  name="status"
                  defaultValue={editingBooking.status}
                  className="mt-1 block w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="pending" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Pending</option>
                  <option value="confirmed" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Confirmed</option>
                  <option value="in_progress" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>In Progress</option>
                  <option value="completed" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Completed</option>
                  <option value="cancelled" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Payment Status</label>
                <select
                  name="paymentStatus"
                  defaultValue={editingBooking.paymentStatus}
                  className="mt-1 block w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="pending" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Pending</option>
                  <option value="paid" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Paid</option>
                  <option value="refunded" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Refunded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Notes</label>
                <textarea
                  name="notes"
                  defaultValue={editingBooking.notes || ''}
                  rows={3}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}