import { POST as CreatePaymentIntentPOST } from '@/app/api/payments/create-payment-intent/route';
import { createMockRequest } from '../utils/test-utils';
import { stripe } from '@/lib/integrations/stripe';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

// Type assertion for stripe to handle potential null in test environment
const mockStripe = stripe as any;

jest.mock('@/lib/integrations/stripe', () => ({
  __esModule: true,
  stripe: {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
    },
    refunds: { create: jest.fn() },
  },
  // The route converts the booking's major-unit price to cents.
  formatAmountForStripe: jest.fn((amount: number) => Math.round(amount * 100)),
}));
jest.mock('@/lib/db/prisma');

// The route authorizes via `getUserFromRequest(request)` directly (not
// `withAuth`). Stub it to return an authenticated user so we reach the handler.
jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(),
}));

describe('Payments API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/create-payment-intent', () => {
    const adminUser = { userId: '123', email: 'test@example.com', role: 'customer' };

    beforeEach(() => {
      (getUserFromRequest as jest.Mock).mockReturnValue(adminUser);
    });

    it('should create payment intent successfully', async () => {
      const booking = {
        id: 'booking123',
        userId: '123',
        serviceId: 'service123',
        totalPrice: 100,
        paymentStatus: 'pending',
      };
      (prisma.booking.findUnique as jest.Mock)
        .mockResolvedValueOnce(booking)      // booking lookup
        .mockResolvedValueOnce({ paymentStatus: 'pending' }); // existing-payment check
      (mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_123',
      });
      (prisma.booking.update as jest.Mock).mockResolvedValue({});

      const request = createMockRequest({
        method: 'POST',
        body: { bookingId: 'booking123' }
      });

      const result = await CreatePaymentIntentPOST(request);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000, // $100.00 in cents
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          bookingId: 'booking123',
          userId: '123',
          serviceId: 'service123',
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        clientSecret: 'pi_test123_secret_123',
        paymentIntentId: 'pi_test123',
      });
    });

    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {}
      });

      const result = await CreatePaymentIntentPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Booking ID is required'
      });
    });

    it('should handle Stripe errors gracefully', async () => {
      const booking = {
        id: 'booking123',
        userId: '123',
        serviceId: 'service123',
        totalPrice: 100,
        paymentStatus: 'pending',
      };
      (prisma.booking.findUnique as jest.Mock)
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce({ paymentStatus: 'pending' });
      (mockStripe.paymentIntents.create as jest.Mock).mockRejectedValue(
        new Error('Card declined')
      );

      const request = createMockRequest({
        method: 'POST',
        body: { bookingId: 'booking123' }
      });

      const result = await CreatePaymentIntentPOST(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});