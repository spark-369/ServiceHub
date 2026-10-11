// Jest setup file
import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ALLOWED_ORIGINS = '*';
process.env.DEBUG_API_KEY = '';
// Keep tests hermetic: never reach a real Redis instance.
delete process.env.REDIS_URL;

// Mock Next.js modules.
// `NextResponse.json()` returns an object whose `json` and `status` are jest
// mocks so tests can assert with `toHaveBeenCalledWith`, while still being
// awaitable/usable (json() resolves to the payload).
jest.mock('next/server', () => {
  const makeResponse = (data, init) => ({
    json: jest.fn(() => Promise.resolve(data)),
    status: jest.fn(() => init?.status || 200),
    headers: new Headers(),
  });

  return {
    NextRequest: jest.fn(),
    NextResponse: {
      json: jest.fn((data, init) => makeResponse(data, init)),
      next: jest.fn(() => ({
        headers: new Headers(),
        status: 200,
      })),
    },
  };
});

// Mock Prisma.
// Exposes BOTH a named `prisma` export and a `default` export because routes
// use `import prisma from '@/lib/db/prisma'` and `import { prisma } from ...`.
jest.mock('@/lib/db/prisma', () => {
  const model = (extra = {}) => ({
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({
      _avg: { rating: 0 },
      _sum: { totalPrice: 0 },
      _count: { id: 0, rating: 0 },
    }),
    groupBy: jest.fn().mockResolvedValue([]),
    ...extra,
  });

  const client = {
    user: model(),
    service: model(),
    booking: model(),
    review: model(),
    payment: model(),
    webhookEvent: model(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((arg) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(client)
    ),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  return { __esModule: true, prisma: client, default: client };
});

// Mock Redis (no real connections in tests)
jest.mock('@/lib/cache/redis', () => {
  const client = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(60000),
    pexpire: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    multi: jest.fn(() => ({
      incr: jest.fn().mockReturnThis(),
      pttl: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 60000],
      ]),
    })),
  };
  return {
    __esModule: true,
    default: client,
    getRedis: () => client,
    isRedisConfigured: () => true,
  };
});

// Mock authentication functions
jest.mock('@/lib/auth', () => {
  const verifyToken = jest.fn((token) => {
    if (
      token === 'valid_token' ||
      token === 'user_token' ||
      token === 'customer_token'
    ) {
      return { userId: '123', email: 'test@example.com', role: 'customer' };
    }
    if (token === 'admin_token') {
      return { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
    }
    if (token === 'provider_token') {
      return { userId: 'provider123', email: 'provider@example.com', role: 'provider' };
    }
    return null;
  });

  return {
    hashPassword: jest.fn((password) => `hashed_${password}`),
    comparePassword: jest.fn(
      (password, hashed) =>
        password === 'correct_password' || hashed === `hashed_${password}`
    ),
    generateToken: jest.fn(
      (payload) => `token_${payload.userId}_${payload.email}`
    ),
    verifyToken,
    getTokenFromRequest: jest.fn((request) => {
      const header = request?.headers?.get?.('authorization');
      return header?.startsWith('Bearer ') ? header.slice(7) : null;
    }),
    // Admin routes call getUserFromRequest directly and switch on user.role.
    getUserFromRequest: jest.fn((request) => {
      const header = request?.headers?.get?.('authorization');
      if (!header?.startsWith('Bearer ')) return null;
      return verifyToken(header.slice(7));
    }),
  };
});

// Mock middleware functions
jest.mock('@/middleware/auth', () => ({
  withAuth: jest.fn((handler) => {
    return async (request, user) => {
      // Mock user context for testing
      const mockUser = user || { userId: '123', email: 'test@example.com', role: 'customer' };
      return await handler(request, mockUser);
    };
  }),
  withRole: jest.fn((roles) => {
    return (handler) => {
      return async (request, user) => {
        // Mock user context for testing
        const mockUser = user || { userId: 'provider123', email: 'provider@example.com', role: 'provider' };
        return await handler(request, mockUser);
      };
    };
  }),
}));

// Mock AI recommendation
jest.mock('@/lib/integrations/ai', () => ({
  recommendServices: jest.fn(() => Promise.resolve([0.9, 0.8, 0.7])),
}));

// Mock Stripe
jest.mock('@/lib/integrations/stripe', () => {
  const stripeClient = {
    paymentIntents: {
      create: jest.fn().mockResolvedValue({}),
      retrieve: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      confirm: jest.fn().mockResolvedValue({}),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({ id: 're_test_1' }),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  return {
    __esModule: true,
    stripe: stripeClient,
    default: stripeClient,
    STRIPE_PUBLISHABLE_KEY: 'pk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    requireStripe: jest.fn(() => stripeClient),
    isStripePublishableConfigured: jest.fn(() => true),
    formatAmountForStripe: jest.fn((amount) => Math.round(amount * 100)),
    formatAmountFromStripe: jest.fn((amount) => amount / 100),
  };
});

// Setup global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});