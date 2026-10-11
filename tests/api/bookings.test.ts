import { GET as BookingsGET, POST as BookingsPOST } from '@/app/api/bookings/route';
import { createMockRequest, createMockResponse, createMockBooking, createMockService, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { withAuth } from '@/middleware/auth';

jest.mock('@/lib/db/prisma');
jest.mock('@/middleware/auth');

describe('Bookings API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/bookings', () => {
    it('should return bookings for authenticated user', async () => {
      const mockBookings = [createMockBooking()];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings?page=1&limit=10'
      });

      const result = await BookingsGET(request);

      expect(withAuth).toHaveBeenCalledWith(expect.any(Function));
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { userId: '123' },
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
        where: { userId: '123', status: 'confirmed' },
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

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { providerId: 'provider123' },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 10,
      });
    });

    it('should handle pagination correctly', async () => {
      const mockBookings = Array(10).fill(null).map((_, i) => createMockBooking({ id: `booking${i}` }));
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(25);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/bookings?page=2&limit=10'
      });

      const result = await BookingsGET(request);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { userId: '123' },
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
          date: new Date().toISOString(),
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

      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: {
          userId: '123',
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
          date: new Date().toISOString()
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
          date: new Date().toISOString()
        }
      });

      const result = await BookingsPOST(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service not found or unavailable'
      });
    });

    it('should return 400 for booking own service', async () => {
      const service = createMockService({ providerId: '123' }); // Same as userId
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(service);

      const request = createMockRequest({
        method: 'POST',
        body: {
          serviceId: 'service123',
          date: new Date().toISOString()
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
          date: new Date().toISOString()
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
          date: new Date().toISOString()
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