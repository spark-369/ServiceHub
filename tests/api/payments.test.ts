import { POST as CreatePaymentIntentPOST, POST as ConfirmPaymentPOST } from '@/app/api/payments/create-payment-intent/route';
import { createMockRequest, createMockResponse } from '../utils/test-utils';
import { stripe } from '@/lib/integrations/stripe';
import { withAuth } from '@/middleware/auth';

// Type assertion for stripe to handle potential null in test environment
const mockStripe = stripe as any;

jest.mock('@/lib/integrations/stripe');
jest.mock('@/middleware/auth');

describe('Payments API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/create-payment-intent', () => {
    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_123',
        amount: 10000, // $100.00
        currency: 'usd',
        status: 'requires_payment_method',
      };

      (mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue(mockPaymentIntent);

      const request = createMockRequest({
        method: 'POST',
        body: {
          bookingId: 'booking123',
          amount: 10000
        }
      });

      const result = await CreatePaymentIntentPOST(request);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'usd',
        metadata: {
          bookingId: 'booking123',
          userId: '123',
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
        body: {
          bookingId: 'booking123'
          // Missing amount
        }
      });

      const result = await CreatePaymentIntentPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Booking ID and amount are required'
      });
    });

    it('should handle Stripe errors gracefully', async () => {
      // Mock Stripe error
      (mockStripe.paymentIntents.create as jest.Mock).mockRejectedValue(
        new Error('Card declined')
      );

      const request = createMockRequest({
        method: 'POST',
        body: {
          bookingId: 'booking123',
          amount: 10000
        }
      });

      const result = await CreatePaymentIntentPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Card declined'
      });
    });
  });

  describe('POST /api/payments/confirm', () => {
    it('should confirm payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 10000,
      };

      (mockStripe.paymentIntents.confirm as jest.Mock).mockResolvedValue(mockPaymentIntent);

      const request = createMockRequest({
        method: 'POST',
        body: {
          paymentIntentId: 'pi_test123',
          bookingId: 'booking123'
        }
      });

      const result = await ConfirmPaymentPOST(request);

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith('pi_test123');

      expect(result.json).toHaveBeenCalledWith({
        message: 'Payment confirmed successfully',
        payment: {
          id: 'pi_test123',
          status: 'succeeded',
          amount: 10000,
        },
      });
    });

    it('should return 400 for payment confirmation failure', async () => {
      // Mock failed payment
      (mockStripe.paymentIntents.confirm as jest.Mock).mockResolvedValue({
        id: 'pi_test123',
        status: 'requires_payment_method',
      });

      const request = createMockRequest({
        method: 'POST',
        body: {
          paymentIntentId: 'pi_test123',
          bookingId: 'booking123'
        }
      });

      const result = await ConfirmPaymentPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Payment confirmation failed'
      });
    });
  });
});