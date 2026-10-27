import { GET as AdminServicesGET, PATCH as AdminServicesPATCH, DELETE as AdminServicesDELETE } from '@/app/api/admin/services/route';
import { createMockRequest, createMockResponse, createMockService, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth';

jest.mock('@/lib/db/prisma');
jest.mock('@/lib/auth');

describe('Admin Services API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/services', () => {
    it('should return services for admin', async () => {
      const mockService = createMockService();
      const mockServices = [mockService];
      
      (prisma.service.findMany as jest.Mock)
        // First call: the paginated listing. Second call: the distinct-category
        // query (`select: { category: true }, distinct: ['category']`).
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce([{ category: 'cleaning' }]);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/services?page=1&limit=10'
      });

      const result = await AdminServicesGET(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
            },
          },
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        services: expect.arrayContaining([
          expect.objectContaining({
            id: 'service123',
            name: 'Test Service',
            category: 'cleaning',
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
        categories: ['cleaning'],
      });
    });

    it('should filter services by category', async () => {
      const mockServices = [createMockService({ category: 'plumbing' })];
      (prisma.service.findMany as jest.Mock)
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce([{ category: 'plumbing' }]);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/services?category=plumbing'
      });

      const result = await AdminServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          category: 'plumbing',
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should search services by name or description', async () => {
      const mockServices = [createMockService({ name: 'Premium Cleaning' })];
      (prisma.service.findMany as jest.Mock)
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce([{ category: 'cleaning' }]);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/services?search=Premium'
      });

      const result = await AdminServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'Premium', mode: 'insensitive' } },
            { description: { contains: 'Premium', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter services by active status', async () => {
      const mockServices = [createMockService({ isActive: false })];
      (prisma.service.findMany as jest.Mock)
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce([{ category: 'cleaning' }]);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/services?isActive=false'
      });

      const result = await AdminServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          isActive: false,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/services'
      });

      const result = await AdminServicesGET(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle server errors gracefully', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock server error
      (prisma.service.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/services'
      });

      const result = await AdminServicesGET(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('PATCH /api/admin/services', () => {
    it('should update service successfully', async () => {
      const mockUpdatedService = createMockService({ name: 'Updated Service', isActive: false });
      (prisma.service.update as jest.Mock).mockResolvedValue(mockUpdatedService);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          serviceId: 'service123',
          updates: { name: 'Updated Service', isActive: false }
        }
      });

      const result = await AdminServicesPATCH(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 'service123' },
        data: { name: 'Updated Service', isActive: false },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        service: expect.objectContaining({
          id: 'service123',
          name: 'Updated Service',
          isActive: false,
        }),
      });
    });

    it('should return 400 for missing serviceId', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          updates: { name: 'Updated Service' }
          // Missing serviceId
        }
      });

      const result = await AdminServicesPATCH(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service ID is required'
      });
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          serviceId: 'service123',
          updates: { name: 'Updated Service' }
        }
      });

      const result = await AdminServicesPATCH(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle server errors gracefully', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock server error
      (prisma.service.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          serviceId: 'service123',
          updates: { name: 'Updated Service' }
        }
      });

      const result = await AdminServicesPATCH(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('DELETE /api/admin/services', () => {
    it('should delete service successfully', async () => {
      const mockService = createMockService();
      const mockServiceWithBookings = {
        ...mockService,
        bookings: []
      };

      (prisma.service.findUnique as jest.Mock).mockResolvedValue(mockServiceWithBookings);
      (prisma.service.delete as jest.Mock).mockResolvedValue(mockService);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/services?id=service123'
      });

      const result = await AdminServicesDELETE(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'service123' },
        include: {
          bookings: {
            where: {
              status: {
                in: ['pending', 'confirmed', 'in_progress']
              }
            }
          },
        },
      });

      expect(prisma.service.delete).toHaveBeenCalledWith({
        where: { id: 'service123' },
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'Service deleted successfully'
      });
    });

    it('should return 400 for missing serviceId', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/services' // No id parameter
      });

      const result = await AdminServicesDELETE(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service ID is required'
      });
    });

    it('should return 404 for non-existent service', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock service not found
      (prisma.service.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/services?id=nonexistent'
      });

      const result = await AdminServicesDELETE(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Service not found'
      });
    });

    it('should prevent deletion of service with active bookings', async () => {
      const mockServiceWithActiveBookings = {
        ...createMockService(),
        bookings: [{ id: 'booking1' }, { id: 'booking2' }]
      };

      (prisma.service.findUnique as jest.Mock).mockResolvedValue(mockServiceWithActiveBookings);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/services?id=service123'
      });

      const result = await AdminServicesDELETE(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Cannot delete service with active bookings. Please resolve all active bookings first.',
        details: {
          activeBookings: 2,
        }
      });

      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/services?id=service123'
      });

      const result = await AdminServicesDELETE(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle server errors gracefully', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock server error
      (prisma.service.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/services?id=service123'
      });

      const result = await AdminServicesDELETE(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});