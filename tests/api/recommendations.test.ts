import { GET as RecommendationsGET } from '@/app/api/recommendations/route';
import { createMockRequest, createMockResponse } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { recommendServices } from '@/lib/integrations/ai';

jest.mock('@/lib/db/prisma');
jest.mock('@/lib/integrations/ai');

// The route exports `GET = withAuth(handler)`. Supply a real pass-through so the
// wrapped handler is a callable function we can invoke directly. Requests built
// with `createMockRequest` have no authorization header, so `getUserFromRequest`
// resolves to null and the guard lets the handler run unauthenticated.
jest.mock('@/middleware/auth', () => ({
  withAuth: (handler: any) => handler,
}));

describe('Recommendations API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recommendations', () => {
    it('should return AI-powered service recommendations', async () => {
      const mockServices = [
        {
          id: 'service1',
          name: 'House Cleaning',
          description: 'Professional house cleaning service',
          category: 'cleaning',
          price: 100,
          rating: 4.8,
          reviewCount: 25,
          provider: {
            name: 'Clean Pro',
            email: 'clean@example.com',
          },
        },
        {
          id: 'service2',
          name: 'Laundry Service',
          description: 'Professional laundry and ironing',
          category: 'cleaning',
          price: 50,
          rating: 4.5,
          reviewCount: 15,
          provider: {
            name: 'Laundry Expert',
            email: 'laundry@example.com',
          },
        },
      ];

      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (recommendServices as jest.Mock).mockResolvedValue([0.9, 0.7]);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/recommendations?query=house%20cleaning&limit=5'
      });

      const result = await RecommendationsGET(request);

      expect(recommendServices).toHaveBeenCalledWith(
        'house cleaning',
        expect.arrayContaining([
          expect.stringContaining('House Cleaning'),
          expect.stringContaining('Laundry Service'),
        ])
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          provider: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
        take: 100,
      });

      expect(result.json).toHaveBeenCalledWith({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            id: 'service1',
            name: 'House Cleaning',
            similarity: 0.9,
          }),
          expect.objectContaining({
            id: 'service2',
            name: 'Laundry Service',
            similarity: 0.7,
          }),
        ]),
      });
    });

    it('should limit results by limit parameter', async () => {
      const mockServices = [
        { id: 'service1', name: 'Service 1', description: 'Description 1', category: 'cleaning', price: 100, rating: 4.5, reviewCount: 10, provider: { name: 'Provider 1', email: 'p1@example.com' } },
        { id: 'service2', name: 'Service 2', description: 'Description 2', category: 'cleaning', price: 100, rating: 4.5, reviewCount: 10, provider: { name: 'Provider 2', email: 'p2@example.com' } },
        { id: 'service3', name: 'Service 3', description: 'Description 3', category: 'cleaning', price: 100, rating: 4.5, reviewCount: 10, provider: { name: 'Provider 3', email: 'p3@example.com' } },
      ];

      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (recommendServices as jest.Mock).mockResolvedValue([0.9, 0.8, 0.7]);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/recommendations?query=cleaning&limit=2'
      });

      const result = await RecommendationsGET(request);

      expect(result.json).toHaveBeenCalledWith({
        recommendations: expect.arrayContaining([
          expect.objectContaining({ id: 'service1' }),
          expect.objectContaining({ id: 'service2' }),
        ]),
      });
    });

    it('should filter by category if provided', async () => {
      const mockServices = [
        { id: 'service1', name: 'Service 1', description: 'Description 1', category: 'cleaning', price: 100, rating: 4.5, reviewCount: 10, provider: { name: 'Provider 1', email: 'p1@example.com' } },
      ];

      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (recommendServices as jest.Mock).mockResolvedValue([0.9]);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/recommendations?query=clean&category=cleaning'
      });

      const result = await RecommendationsGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { 
          isActive: true,
          category: 'cleaning',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        take: 100,
      });
    });

    it('should handle empty results gracefully', async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([]);
      (recommendServices as jest.Mock).mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/recommendations?query=nonexistent'
      });

      const result = await RecommendationsGET(request);

      expect(result.json).toHaveBeenCalledWith({
        recommendations: [],
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.service.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'GET',
        url: '/api/recommendations?query=test'
      });

      const result = await RecommendationsGET(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});