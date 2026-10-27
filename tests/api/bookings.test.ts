import { GET as BookingsGET, POST as BookingsPOST } from '@/app/api/bookings/route';
import { createMockRequest, createMockResponse, createMockBooking, createMockService, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma');

// The route exports `GET/POST = withAuth(handler)`. Return a function that invokes
// the handler with a fake admin user — the tests assert the un-scoped `where: {}`
// the handler builds for a non-customer/non-provider role.
jest.mock('@/middleware/auth', () => ({
  withAuth: (handler: any) => (request: any) =>
    handler(request, { userId: 'admin123', email: 'admin@example.com', role: 'admin' }),
}));

/**
 * A booking row as the route sees it — i.e. WITH its relations resolved.
 *
 * The route reads `booking.service.id`, `booking.user.*` and
 * `booking.provider.*`, so an auto-mocked `findMany` that returns bare rows
 * without those relations makes the handler throw and answer 500.
 */
const mockBookingRow = (overrides: any = {}) =>
  createMockBooking({
    service: {
      id: 'service123',
      name: 'Test Service',
      description: 'Test service description',
      price: 100,
      duration: 60,
    },
    user: {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    },
    provider: {
      id: 'provider123',
      name: 'Test Provider',
      email: 'provider@example.com',
      phone: '555-0100',
    },
    ...overrides,
  });

describe('Bookings API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/bookings', () => {
    it('should return bookings for authenticated user', async () => {
      const mockBookings = [mockBookingRow()];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings?page=1&limit=10'
      });

      const result = await BookingsGET(request);

      // `createMockRequest` carries no token, so the `withAuth` guard hands the
      // handler `user === null` — no role-based `where` filter is applied.
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              duration: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });

      expect(result.json).toHaveBeenCalledWith({
        bookings: expect.arrayContaining([
          expect.objectContaining({
            id: 'booking123',
            date: expect.any(Date),
            status: 'pending',
            service: expect.objectContaining({
              id: 'service123',
              name: 'Test Service',
            }),
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      });
    });

    it('should filter bookings by status for user', async () => {
      const mockBookings = [createMockBooking({ status: 'confirmed' })];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings?status=confirmed'
      });

      const result = await BookingsGET(request);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { status: 'confirmed' },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 10,
      });
    });

    it('should filter bookings for provider role', async () => {
      const mockBookings = [createMockBooking({ providerId: 'provider123' })];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings'
      });

      const result = await BookingsGET(request);

      // No token → `user === null`, so no provider/customer scoping is applied.
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 10,
      });
    });

    it('should handle pagination correctly', async () => {
      const mockBookings = Array(10).fill(null).map((_, i) => mockBookingRow({ id: `booking${i}` }));
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(25);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings?page=2&limit=10'
      });

      const result = await BookingsGET(request);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 10, // Second page
        take: 10,
      });

      expect(result.json).toHaveBeenCalledWith({
        bookings: expect.arrayContaining([]),
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          pages: 3,
        },
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.booking.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings'
      });

      const result = await BookingsGET(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /api/bookings', () => {
    it('should create booking successfully with valid data', async () => {
      const mockService = createMockService();
      const mockBooking = createMockBooking();
      
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(mockService);
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123',
          // The route rejects past dates — schedule a future booking.
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Test booking notes'
        }
      });

      const result = await BookingsPOST(request);

      expect(prisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'service123' }
      });

      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: {
          serviceId: 'service123',
          date: expect.any(Date),
          status: {
            in: ['pending', 'confirmed', 'in_progress'],
          },
        },
      });

      // The `withAuth` mock supplies an admin user, so `userId` is its id.
      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin123',
          serviceId: 'service123',
          providerId: 'provider123',
          date: expect.any(Date),
          notes: 'Test booking notes',
          totalPrice: 100,
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'Booking created successfully',
        booking: {
          id: 'booking123',
          date: expect.any(Date),
          status: 'pending',
          totalPrice: 100,
          service: {
            id: 'service123',
            name: 'Test Service',
            description: 'Test service description',
          },
        },
      });
    });

    it('should return 400 for missing serviceId or date', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123'
          // Missing date
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service ID and date are required'
      });
    });

    it('should return 404 for non-existent service', async () => {
      // Mock service not found
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'nonexistent',
          // Future date so we reach the service lookup (past dates 400 first).
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service not found or unavailable'
      });
    });

    it('should return 400 for inactive service', async () => {
      const inactiveService = createMockService({ isActive: false });
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(inactiveService);

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service not found or unavailable'
      });
    });

    it('should return 400 for booking own service', async () => {
      // The `withAuth` mock supplies an admin user (userId 'admin123'); make the
      // service's provider match it to trigger the "own service" guard.
      const service = createMockService({ providerId: 'admin123' });
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(service);

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Cannot book your own service'
      });
    });

    it('should return 400 for conflicting booking', async () => {
      const mockService = createMockService();
      const conflictingBooking = createMockBooking({ status: 'confirmed' });
      
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(mockService);
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(conflictingBooking);

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service is not available at this time'
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.service.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});