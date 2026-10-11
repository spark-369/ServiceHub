'use client';

import { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Read the publishable key directly from the public env var so the client
// bundle never pulls in the server-only Stripe SDK / env validation.
const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Only create the Stripe promise when the key actually looks valid; calling
// loadStripe("") emits a noisy console error and never resolves.
const stripePromise = /^pk_(test|live)_/.test(STRIPE_PUBLISHABLE_KEY)
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

interface PaymentFormProps {
  bookingId: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

function CheckoutForm({ bookingId, amount, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  // Keep the latest callbacks in refs so the intent-creation effect below can
  // depend solely on `bookingId`. Inline `onError` props change identity on
  // every parent render, which previously re-created a Stripe PaymentIntent
  // each time the parent re-rendered.
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
  }, [onError, onSuccess]);

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/payments/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ bookingId }),
        });

        const data = await response.json();

        if (response.ok) {
          setClientSecret(data.clientSecret);
        } else {
          onErrorRef.current(data.error || 'Failed to create payment intent');
        }
      } catch (error) {
        onErrorRef.current('Network error occurred');
      }
    };

    createPaymentIntent();
  }, [bookingId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      onErrorRef.current('Card element not found');
      setLoading(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
      },
    });

    if (error) {
      onErrorRef.current(error.message || 'Payment failed');
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Confirm payment with our server
      try {
        const confirmResponse = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ 
            bookingId, 
            paymentIntentId: paymentIntent.id 
          }),
        });

        const confirmData = await confirmResponse.json();

        if (confirmResponse.ok) {
          onSuccessRef.current();
        } else {
          onErrorRef.current(confirmData.error || 'Payment confirmation failed');
        }
      } catch (confirmError) {
        onErrorRef.current('Payment confirmation failed');
      }
    }

    setLoading(false);
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#e2e8f0",
        "::placeholder": {
          color: "#64748b",
        },
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-slate-100 mb-4">
          Payment Details
        </h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Card Information
          </label>
          <div className="border border-slate-700 bg-slate-950 rounded-md p-3">
            <CardElement options={cardElementOptions} />
          </div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-800 p-4 rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-300">Total Amount:</span>
            <span className="text-lg font-semibold text-slate-100">${amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading || !clientSecret}
        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          loading || !stripe || !clientSecret
            ? 'bg-slate-700 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing Payment...
          </>
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </button>
    </form>
  );
}

export default function PaymentForm(props: PaymentFormProps) {
  // Check if Stripe is properly configured (accepts test and live keys).
  const stripeKey = STRIPE_PUBLISHABLE_KEY;
  if (!/^pk_(test|live)_/.test(stripeKey) || !stripePromise) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
        <div className="text-red-300 text-sm">
          Payment system is not properly configured. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  );
}