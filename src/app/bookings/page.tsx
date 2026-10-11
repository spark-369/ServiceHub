"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import PaymentForm from "@/components/features/PaymentForm";
import LocationMap from "@/components/features/LocationMap";

interface Booking {
  id: string;
  date: string;
  status: string;
  notes?: string;
  totalPrice: number;
  paymentStatus: string;
  /** Payment timestamps / Stripe references stored on the booking row. */
  paidAt?: string | null;
  refundedAt?: string | null;
  stripePaymentId?: string | null;
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

/**
 * Work out which party on a booking the current viewer is NOT — i.e. the person
 * whose location they want to see. Never returns the viewer's own id, so a
 * provider/admin can't accidentally open their own location as the "target".
 */
function resolveCounterpartyId(
  booking: Booking | null,
  viewer: { id?: string; role?: string } | null,
): string | undefined {
  if (!booking) return undefined;

  const viewerId = viewer?.id;

  // The customer of a booking is `booking.user`; the professional is
  // `booking.provider`.
  const customer = booking.user;
  const provider = booking.provider;

  // A customer always wants to see the provider.
  if (viewer?.role === "customer") return provider?.id;

  // A provider wants the customer they're servicing.
  if (viewer?.role === "provider") return customer?.id;

  // An admin (or any other role) should see the customer's location, falling
  // back to the provider when the customer isn't present or is the viewer.
  const candidates = [customer, provider].filter(Boolean) as Array<{
    id: string;
  }>;
  const other = candidates.find((c) => c.id !== viewerId);
  return other?.id;
}

export default function BookingsDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] =
    useState<Booking | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [selectedBookingForMap, setSelectedBookingForMap] =
    useState<Booking | null>(null);

  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/bookings?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingStatus(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (response.ok) {
        setBookings(
          bookings.map((booking) =>
            booking.id === bookingId
              ? { ...booking, status: newStatus }
              : booking,
          ),
        );
      } else {
        toast.error(data.error || "Failed to update booking status");
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error("Failed to update booking status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    setUpdatingStatus(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.ok) {
        setBookings(bookings.filter((booking) => booking.id !== bookingId));
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePayment = (booking: Booking) => {
    setPaymentLoading(true);
    setSelectedBookingForPayment(booking);
    setShowPaymentForm(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentLoading(false);
    setShowPaymentForm(false);
    setSelectedBookingForPayment(null);
    // Refresh bookings to show updated payment status
    fetchBookings();
  };

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`);
    setPaymentLoading(false);
  };

  const handleShowProviderLocation = (booking: Booking) => {
    setSelectedBookingForMap(booking);
    setShowLocationMap(true);
  };

  const handleShowCustomerLocation = (booking: Booking) => {
    setSelectedBookingForMap(booking);
    setShowLocationMap(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20";
      case "confirmed":
        return "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20";
      case "in_progress":
        return "bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20";
      case "refunded":
        return "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20";
      default:
        return "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-slate-100">My Bookings</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage your service bookings and appointments
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 text-slate-100 border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm w-44"
        >
          <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>All Statuses</option>
          <option value="pending" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>Pending</option>
          <option value="confirmed" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>Confirmed</option>
          <option value="in_progress" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>In Progress</option>
          <option value="completed" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>Completed</option>
          <option value="cancelled" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>Cancelled</option>
        </select>
      </div>

      {/* Bookings List */}
      <div className="mt-8">
        {bookings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No bookings found.</p>
            <Link
              href="/"
              className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block"
            >
              Browse services
            </Link>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-slate-800">
              {bookings.map((booking) => (
                <li key={booking.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-slate-100">
                            {booking.service.name}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {booking.service.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-slate-100">
                            ${booking.totalPrice}
                          </div>
                          <div className="text-sm text-slate-500">
                            {booking.service.duration} min
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center space-x-4 text-sm text-slate-400">
                        <span>
                          📅 {new Date(booking.date).toLocaleString()}
                        </span>
                        <h1
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-md font-medium ${getStatusColor(
                            booking.status,
                          )}`}
                        >
                          {booking.status.replace("_", " ")}
                        </h1>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(
                            booking.paymentStatus,
                          )}`}
                        >
                          Payment: {booking.paymentStatus}
                        </span>
                      </div>

                      {user?.role === "provider" && booking.user && (
                        <div className="mt-2 text-sm text-slate-400">
                          👤 Customer: {booking.user.name} ({booking.user.email}
                          )
                        </div>
                      )}

                      {user?.role === "customer" && booking.provider && (
                        <div className="mt-2 text-sm text-slate-400">
                          👨‍💼 Provider: {booking.provider.name} (
                          {booking.provider.email})
                        </div>
                      )}

                      {booking.notes && (
                        <div className="mt-2 text-sm text-slate-400">
                          📝 Notes: {booking.notes}
                        </div>
                      )}

                      {booking.paidAt && (
                        <div className="mt-2 text-sm text-slate-400">
                          💳 Paid: {new Date(booking.paidAt).toLocaleString()}
                        </div>
                      )}

                      {booking.refundedAt && (
                        <div className="mt-2 text-sm text-slate-400">
                          ↩️ Refunded:{" "}
                          {new Date(booking.refundedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex space-x-2">
                    {user?.role === "provider" &&
                      booking.status === "pending" && (
                        <button
                          onClick={() =>
                            updateBookingStatus(booking.id, "confirmed")
                          }
                          disabled={updatingStatus === booking.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {updatingStatus === booking.id
                            ? "Updating..."
                            : "Confirm"}
                        </button>
                      )}

                    {user?.role === "provider" &&
                      booking.status === "confirmed" && (
                        <button
                          onClick={() =>
                            updateBookingStatus(booking.id, "in_progress")
                          }
                          disabled={updatingStatus === booking.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                        >
                          {updatingStatus === booking.id
                            ? "Updating..."
                            : "Start Service"}
                        </button>
                      )}

                    {user?.role === "provider" &&
                      booking.status === "in_progress" && (
                        <button
                          onClick={() =>
                            updateBookingStatus(booking.id, "completed")
                          }
                          disabled={updatingStatus === booking.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
                        >
                          {updatingStatus === booking.id
                            ? "Updating..."
                            : "Complete"}
                        </button>
                      )}

                    {booking.status !== "completed" &&
                      booking.status !== "cancelled" && (
                        <button
                          onClick={() => cancelBooking(booking.id)}
                          disabled={updatingStatus === booking.id}
                          className="inline-flex items-center px-3 py-1 border border-slate-700 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                        >
                          {updatingStatus === booking.id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      )}

                    {booking.status === "completed" &&
                      user?.role === "customer" && (
                        <>
                          <Link
                            href={`/services/${booking.service.id}/bookings/${booking.id}/review`}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500"
                          >
                            Leave Review
                          </Link>
                          {booking.paymentStatus !== "paid" && (
                            <button
                              onClick={() => handlePayment(booking)}
                              disabled={paymentLoading}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {paymentLoading ? "Processing..." : "Pay Now"}
                            </button>
                          )}
                          {booking.provider && (
                            <button
                              onClick={() =>
                                handleShowProviderLocation(booking)
                              }
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-500"
                            >
                              Provider Location
                            </button>
                          )}
                        </>
                      )}

                    {user?.role === "customer" &&
                      booking.status === "confirmed" &&
                      booking.provider && (
                        <button
                          onClick={() => handleShowProviderLocation(booking)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-500"
                        >
                          Provider Location
                        </button>
                      )}

                    {user?.role === "customer" &&
                      booking.status === "in_progress" &&
                      booking.provider && (
                        <button
                          onClick={() => handleShowProviderLocation(booking)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-500"
                        >
                          Provider Location
                        </button>
                      )}

                    {user?.role === "provider" &&
                      booking.status !== "cancelled" &&
                      booking.user && (
                        <button
                          onClick={() => handleShowCustomerLocation(booking)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-500"
                        >
                          Customer Location
                        </button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedBookingForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-slate-100">
                Payment for {selectedBookingForPayment.service.name}
              </h3>
              <button
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedBookingForPayment(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <PaymentForm
              bookingId={selectedBookingForPayment.id}
              amount={selectedBookingForPayment.totalPrice}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        </div>
      )}

      {/* Location Map Modal */}
      {showLocationMap && selectedBookingForMap && (
        <LocationMap
          showLocationMap={showLocationMap}
          targetId={resolveCounterpartyId(selectedBookingForMap, user)}
          onClose={() => {
            setShowLocationMap(false);
            setSelectedBookingForMap(null);
            fetchBookings();
          }}
          selectedBookingForMap={selectedBookingForMap}
        />
      )}
    </div>
  );
}
