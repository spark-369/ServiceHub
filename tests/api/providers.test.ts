import { GET as ProvidersGET } from '@/app/api/providers/route';
import { createMockRequest, createMockResponse, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma');

// The route exports `GET = withAuth(handler)` and `POST = withRole(['admin'])`.
// Supply real pass-throughs so both wrapped handlers are callable directly.
// Requests built with `createMockRequest` have no authorization header, so
// `getUserFromRequest` resolves to null and `withAuth` lets the handler run
// unauthenticated — the assertions below target the query the handler builds.
jest.mock('@/middleware/auth', () => ({
  withAuth: (handler: any) => handler,
  withRole: (_roles: string[]) => (handler: any) => handler,
}));

describe('Providers API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/providers', () => {
    it('should return list of providers', async () => {
      const mockProviders = [
        createMockUser({ id: 'provider1', role: 'provider', name: 'Provider One' }),
        createMockUser({ id: 'provider2', role: 'provider', name: 'Provider Two' })
      ];
      
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockProviders);
      (prisma.user.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/providers?page=1&limit=10'
      });

      const result = await ProvidersGET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'provider' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              providedServices: true,
              bookingsAsProvider: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });

      expect(result.json).toHaveBeenCalledWith({
        providers: expect.arrayContaining([
          expect.objectContaining({
            id: 'provider1',
            name: 'Provider One',
            role: 'provider',
          }),
          expect.objectContaining({
            id: 'provider2',
            name: 'Provider Two',
            role: 'provider',
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1,
        },
      });
    });

    it('should filter providers by verification status', async () => {
      const mockProviders = [
        createMockUser({ id: 'provider1', role: 'provider', isVerified: true }),
      ];
      
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockProviders);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/providers?verified=true'
      });

      const result = await ProvidersGET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'provider', isVerified: true },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should handle pagination correctly', async () => {
      const mockProviders = Array(10).fill(null).map((_, i) => 
        createMockUser({ id: `provider${i}`, role: 'provider', name: `Provider ${i}` })
      );
      
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockProviders);
      (prisma.user.count as jest.Mock).mockResolvedValue(25);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/providers?page=2&limit=10'
      });

      const result = await ProvidersGET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'provider' },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 10, // Second page
        take: 10,
      });

      expect(result.json).toHaveBeenCalledWith({
        providers: expect.arrayContaining([]),
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
      (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'GET',
        url: '/api/providers'
      });

      const result = await ProvidersGET(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});
