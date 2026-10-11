'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PaymentForm from '@/components/features/PaymentForm';
import { useAuth } from '@/context/AuthContext';

interface Booking {
  id: string;
  date: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
  paidAt?: string | null;
  refundedAt?: string | null;
  stripePaymentId?: string | null;
  service: {
    name: string;
    description: string;
  };
  provider: {
    name: string;
    email: string;
  };
}

export default function PayBookingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const bookingId = params.id as string;

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setBooking(data.booking);
        } else {
          setError(data.error || 'Failed to fetch booking');
        }
      } catch (error) {
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (user && bookingId) {
      fetchBooking();
    }
  }, [user, bookingId]);

  const handlePaymentSuccess = () => {
    // Redirect to booking confirmation or dashboard
    router.push('/bookings?payment=success');
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-300">
                {error || 'Booking not found'}
              </h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (booking.paymentStatus === 'paid') {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-emerald-300">
                Payment Already Completed
              </h3>
              <p className="text-sm text-emerald-400/80 mt-1">
                This booking has already been paid for. No further payment is required.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Complete Payment</h1>
        <p className="mt-2 text-sm text-slate-400">
          Review your booking and pay securely.
        </p>
      </div>

      {/* Booking Details */}
      <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-slate-100">
            Booking Details
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-slate-400">Service</dt>
              <dd className="mt-1 text-sm text-slate-100">{booking.service?.name || 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-400">Provider</dt>
              <dd className="mt-1 text-sm text-slate-100">{booking.provider?.name || 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-400">Date & Time</dt>
              <dd className="mt-1 text-sm text-slate-100">
                {new Date(booking.date).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-400">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                  booking.status === 'confirmed'
                    ? 'bg-blue-500/10 text-blue-300 ring-blue-500/20'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                }`}>
                  {booking.status.replace('_', ' ')}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-slate-400">Description</dt>
              <dd className="mt-1 text-sm text-slate-100">{booking.service?.description || 'No description available'}</dd>
            </div>
            {booking.paidAt && (
              <div>
                <dt className="text-sm font-medium text-slate-400">Paid at</dt>
                <dd className="mt-1 text-sm text-slate-100">
                  {new Date(booking.paidAt).toLocaleString()}
                </dd>
              </div>
            )}
            {booking.refundedAt && (
              <div>
                <dt className="text-sm font-medium text-slate-400">Refunded at</dt>
                <dd className="mt-1 text-sm text-slate-100">
                  {new Date(booking.refundedAt).toLocaleString()}
                </dd>
              </div>
            )}
            {booking.stripePaymentId && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-slate-400">Stripe payment ID</dt>
                <dd className="mt-1 text-sm break-all text-slate-100">{booking.stripePaymentId}</dd>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Form */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-300">
                {error}
              </h3>
            </div>
          </div>
        </div>
      )}

      <PaymentForm
        bookingId={booking.id}
        amount={booking.totalPrice}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
}