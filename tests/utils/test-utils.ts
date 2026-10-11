import { jest } from '@jest/globals';

// Test data factories
export const createMockUser = (overrides: any = {}) => ({
  id: '123',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed_password',
  role: 'customer',
  phone: '1234567890',
  address: '123 Test St',
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockService = (overrides: any = {}) => ({
  id: 'service123',
  name: 'Test Service',
  description: 'Test service description',
  category: 'cleaning',
  price: 100,
  duration: 60,
  location: 'Test Location',
  availability: 'Test availability',
  tags: ['test', 'service'],
  rating: 4.5,
  reviewCount: 10,
  isActive: true,
  providerId: 'provider123',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockBooking = (overrides: any = {}) => ({
  id: 'booking123',
  userId: '123',
  serviceId: 'service123',
  providerId: 'provider123',
  date: new Date(),
  status: 'pending',
  notes: 'Test booking notes',
  totalPrice: 100,
  paymentStatus: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockReview = (overrides: any = {}) => ({
  id: 'review123',
  bookingId: 'booking123',
  userId: '123',
  rating: 5,
  comment: 'Great service!',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPayment = (overrides: any = {}) => ({
  id: 'payment123',
  bookingId: 'booking123',
  amount: 100,
  currency: 'usd',
  status: 'pending',
  stripePaymentIntentId: 'pi_test123',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock request/response helpers
export const createMockRequest = (options: any = {}) => {
  const { method = 'GET', url = '/', body = null, headers = {} as Record<string, string>, user = null } = options;

  // Next.js always hands route handlers an *absolute* `NextRequest.url`
  // (e.g. `http://localhost/api/bookings?page=1`). Route handlers parse it with
  // `new URL(request.url)`, which throws on a relative path, so mirror the real
  // runtime by giving relative test URLs a base origin.
  const absoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
    ? url
    : `http://localhost${url.startsWith('/') ? '' : '/'}${url}`;

  const mockRequest: any = {
    method,
    url: absoluteUrl,
    headers: new Map<string, string>(Object.entries(headers)),
    json: jest.fn(),
  };

  // Mock URL parsing
  Object.defineProperty(mockRequest, 'url', {
    get: () => absoluteUrl,
  });

  // Mock headers
  mockRequest.headers.get = jest.fn((key: string) => headers[key] || null);

  // Mock JSON parsing
  if (body) {
    (mockRequest.json as any).mockResolvedValue(body);
  }

  return mockRequest;
};

export const createMockResponse = () => {
  const response: any = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    headers: new Headers(),
  };
  
  return response;
};

// Authentication helpers
export const createAuthenticatedRequest = (userRole = 'customer', userId = '123') => {
  const token = `${userRole}_token`;
  return createMockRequest({
    headers: {
      'authorization': `Bearer ${token}`,
    },
  });
};

// Test assertion helpers
export const expectResponse = (response: any, status = 200, data: any = null) => {
  expect(response.status).toHaveBeenCalledWith(status);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
    ...(data ? data : {}),
    ...(status >= 400 && { error: expect.any(String) }),
  }));
};

// Clean up all mocks
export const clearAllMocks = () => {
  jest.clearAllMocks();
};