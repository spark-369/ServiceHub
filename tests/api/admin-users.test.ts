import { GET as AdminUsersGET, PATCH as AdminUsersPATCH, DELETE as AdminUsersDELETE } from '@/app/api/admin/users/route';
import { createMockRequest, createMockResponse, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth';

jest.mock('@/lib/db/prisma');
jest.mock('@/lib/auth');

describe('Admin Users API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should return users for admin role', async () => {
      const mockUsers = [createMockUser()];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/users?page=1&limit=10'
      });

      const result = await AdminUsersGET(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isVerified: true,
          phone: true,
          address: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bookingsAsUser: true,
              bookingsAsProvider: true,
              providedServices: true,
            },
          },
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        users: expect.arrayContaining([
          expect.objectContaining({
            id: '123',
            name: 'Test User',
            email: 'test@example.com',
            role: 'customer',
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

    it('should filter users by search term', async () => {
      const mockUsers = [createMockUser({ name: 'John Doe' })];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/users?search=John'
      });

      const result = await AdminUsersGET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'John', mode: 'insensitive' } },
            { email: { contains: 'John', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });

    it('should filter users by role', async () => {
      const mockUsers = [createMockUser({ role: 'provider' })];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/users?role=provider'
      });

      const result = await AdminUsersGET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'provider',
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/users'
      });

      const result = await AdminUsersGET(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 401 for unauthenticated user', async () => {
      // Mock unauthenticated user
      (getUserFromRequest as jest.Mock).mockReturnValue(null);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/users'
      });

      const result = await AdminUsersGET(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle server errors gracefully', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock server error
      (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'GET',
        url: '/api/admin/users'
      });

      const result = await AdminUsersGET(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('PATCH /api/admin/users', () => {
    it('should update user successfully', async () => {
      const mockUpdatedUser = createMockUser({ name: 'Updated User' });
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          userId: '123',
          updates: { name: 'Updated User' }
        }
      });

      const result = await AdminUsersPATCH(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { name: 'Updated User' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isVerified: true,
          phone: true,
          address: true,
          updatedAt: true,
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: '123',
          name: 'Updated User',
          email: 'test@example.com',
          role: 'customer',
        }),
      });
    });

    it('should return 400 for missing userId', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          updates: { name: 'Updated User' }
          // Missing userId
        }
      });

      const result = await AdminUsersPATCH(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'User ID is required'
      });
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          userId: '123',
          updates: { name: 'Updated User' }
        }
      });

      const result = await AdminUsersPATCH(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle server errors gracefully', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock server error
      (prisma.user.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'PATCH',
        body: {
          userId: '123',
          updates: { name: 'Updated User' }
        }
      });

      const result = await AdminUsersPATCH(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('DELETE /api/admin/users', () => {
    it('should delete user successfully', async () => {
      const mockUser = createMockUser();
      const mockUserWithRelations = {
        ...mockUser,
        bookingsAsUser: [],
        bookingsAsProvider: [],
        providedServices: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithRelations);
      (prisma.user.delete as jest.Mock).mockResolvedValue(mockUser);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users?id=123'
      });

      const result = await AdminUsersDELETE(request);

      expect(getUserFromRequest).toHaveBeenCalledWith(request);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
        include: {
          bookingsAsUser: { where: { status: { in: ['pending', 'confirmed', 'in_progress'] } } },
          bookingsAsProvider: { where: { status: { in: ['pending', 'confirmed', 'in_progress'] } } },
          providedServices: { where: { isActive: true } },
        },
      });

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'User deleted successfully'
      });
    });

    it('should return 400 for missing userId', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users' // No id parameter
      });

      const result = await AdminUsersDELETE(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'User ID is required'
      });
    });

    it('should return 404 for non-existent user', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock user not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users?id=nonexistent'
      });

      const result = await AdminUsersDELETE(request);

      expect(result.status).toHaveBeenCalledWith(404);
      expect(result.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
    });

    it('should prevent deletion of user with active bookings', async () => {
      const mockUserWithActiveBookings = {
        ...createMockUser(),
        bookingsAsUser: [{ id: 'booking1' }],
        bookingsAsProvider: [],
        providedServices: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithActiveBookings);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users?id=123'
      });

      const result = await AdminUsersDELETE(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Cannot delete user with active bookings or services. Please resolve all active items first.',
        details: {
          activeUserBookings: 1,
          activeProviderBookings: 0,
          activeServices: 0,
        }
      });
    });

    it('should prevent deletion of user with active services', async () => {
      const mockUserWithActiveServices = {
        ...createMockUser(),
        bookingsAsUser: [],
        bookingsAsProvider: [],
        providedServices: [{ id: 'service1' }]
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithActiveServices);

      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users?id=123'
      });

      const result = await AdminUsersDELETE(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Cannot delete user with active bookings or services. Please resolve all active items first.',
        details: {
          activeUserBookings: 0,
          activeProviderBookings: 0,
          activeServices: 1,
        }
      });
    });

    it('should return 401 for non-admin user', async () => {
      // Mock non-admin user
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockUser);

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users?id=123'
      });

      const result = await AdminUsersDELETE(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle server errors gracefully', async () => {
      // Mock admin user
      const mockAdminUser = { userId: 'admin123', email: 'admin@example.com', role: 'admin' };
      (getUserFromRequest as jest.Mock).mockReturnValue(mockAdminUser);

      // Mock server error
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'DELETE',
        url: '/api/admin/users?id=123'
      });

      const result = await AdminUsersDELETE(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});