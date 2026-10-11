import { GET as AdminBookingsGET, PATCH as AdminBookingsPATCH, DELETE as AdminBookingsDELETE } from '@/app/api/admin/bookings/route';
import { createMockRequest, createMockResponse, createMockBooking, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth';

jest.mock('@/lib/db/prisma');
jest.mock('@/lib/auth');

describe('Admin Bookings API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/bookings', () => {
    it('should return bookings for admin', async () => {
      const mockBookings = [createMockBooking()];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/bookings?page=1&limit=10'
      });

      const result = await AdminBookingsGET(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
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
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              duration: true,
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
            status: 'pending',
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

    it('should filter bookings by status', async () => {
      const mockBookings = [createMockBooking({ status: 'confirmed' })];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/bookings?status=confirmed'
      });

      const result = await AdminBookingsGET(request);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { status: 'confirmed' },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 10,
      });
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/bookings'
      });

      const result = await AdminBookingsGET(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('PATCH /api/admin/bookings', () => {
    it('should update booking status successfully', async () => {
      const mockUpdatedBooking = createMockBooking({ status: 'confirmed' });
      (prisma.booking.update as jest.Mock).mockResolvedValue(mockUpdatedBooking);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          bookingId: 'booking123',
          status: 'confirmed',
          notes: 'Admin updated booking status'
        }
      });

      const result = await AdminBookingsPATCH(request);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking123' },
        data: {
          status: 'confirmed',
          notes: 'Admin updated booking status',
        },
        include: expect.any(Object),
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'Booking updated successfully',
        booking: expect.objectContaining({
          id: 'booking123',
          status: 'confirmed',
        }),
      });
    });

    it('should return 400 for missing bookingId', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          status: 'confirmed'
          // Missing bookingId
        }
      });

      const result = await AdminBookingsPATCH(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Booking ID is required'
      });
    });
  });

  describe('DELETE /api/admin/bookings', () => {
    it('should delete booking successfully', async () => {
      const mockBooking = createMockBooking();
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.booking.delete as jest.Mock).mockResolvedValue(mockBooking);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/bookings?id=booking123'
      });

      const result = await AdminBookingsDELETE(request);

      expect(prisma.booking.delete).toHaveBeenCalledWith({
        where: { id: 'booking123' },
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'Booking deleted successfully'
      });
    });

    it('should return 400 for missing bookingId', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/bookings' // No id parameter
      });

      const result = await AdminBookingsDELETE(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Booking ID is required'
      });
    });

    it('should return 404 for non-existent booking', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock booking not found
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/bookings?id=nonexistent'
      });

      const result = await AdminBookingsDELETE(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Booking not found'
      });
    });
  });
});