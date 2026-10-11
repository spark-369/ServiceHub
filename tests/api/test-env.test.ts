import { GET as TestEnvGET } from '@/app/api/dev/test-env/route';
import { createMockRequest, createMockResponse } from '../utils/test-utils';

describe('Test Environment API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dev/test-env', () => {
    it('should return environment configuration status', async () => {
      const request = createMockRequest({
        method: 'GET',
        url: '/api/dev/test-env'
      });

      const result = await TestEnvGET(request);

      expect(result.json).toHaveBeenCalledWith({
        hasStripeSecretKey: expect.any(Boolean),
        hasStripePublishableKey: expect.any(Boolean),
        stripeSecretKeyLength: expect.any(Number),
        stripePublishableKeyLength: expect.any(Number),
        hasWebhookSecret: expect.any(Boolean),
        hasRedisUrl: expect.any(Boolean),
        env: expect.any(String),
      });
    });

    it('should handle missing environment variables', async () => {
      // Mock missing environment variables
      const originalEnv = process.env.STRIPE_SECRET_KEY;
      const originalPublishableEnv = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      const request = createMockRequest({
        method: 'GET',
        url: '/api/dev/test-env'
      });

      const result = await TestEnvGET(request);

      expect(result.json).toHaveBeenCalledWith({
        hasStripeSecretKey: false,
        hasStripePublishableKey: false,
        stripeSecretKeyLength: 0,
        stripePublishableKeyLength: 0,
        hasWebhookSecret: expect.any(Boolean),
        hasRedisUrl: expect.any(Boolean),
        env: expect.any(String),
      });

      // Restore environment variables
      process.env.STRIPE_SECRET_KEY = originalEnv;
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalPublishableEnv;
    });

    it('should handle existing environment variables', async () => {
      // Mock existing environment variables
      const originalEnv = process.env.STRIPE_SECRET_KEY;
      const originalPublishableEnv = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      
      process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123456789';

      const request = createMockRequest({
        method: 'GET',
        url: '/api/dev/test-env'
      });

      const result = await TestEnvGET(request);

      expect(result.json).toHaveBeenCalledWith({
        hasStripeSecretKey: true,
        hasStripePublishableKey: true,
        stripeSecretKeyLength: 19,
        stripePublishableKeyLength: 19,
        hasWebhookSecret: expect.any(Boolean),
        hasRedisUrl: expect.any(Boolean),
        env: expect.any(String),
      });

      // Restore environment variables
      process.env.STRIPE_SECRET_KEY = originalEnv;
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalPublishableEnv;
    });
  });
});