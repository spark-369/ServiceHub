import { GET as ServicesGET, POST as ServicesPOST } from '@/app/api/services/route';
import { createMockRequest, createMockResponse, createMockService, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { withRole } from '@/middleware/auth';
import { recommendServices } from '@/lib/integrations/ai';

jest.mock('@/lib/db/prisma');
jest.mock('@/middleware/auth');
jest.mock('@/lib/integrations/ai');

describe('Services API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/services', () => {
    it('should return services with basic filtering', async () => {
      const mockServices = [createMockService()];
      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/services?page=1&limit=10'
      });

      const result = await ServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
        skip: 0,
        take: 10,
      });

      expect(prisma.service.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });

      expect(result.json).toHaveBeenCalledWith({
        services: expect.arrayContaining([
          expect.objectContaining({
            id: 'service123',
            name: 'Test Service',
            isActive: true,
            provider: expect.objectContaining({
              id: 'provider123',
              name: expect.any(String),
              email: expect.any(String),
              phone: expect.any(String),
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

    it('should filter services by category', async () => {
      const mockServices = [createMockService({ category: 'cleaning' })];
      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/services?category=cleaning'
      });

      const result = await ServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'cleaning' },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 10,
      });
    });

    it('should filter services by location', async () => {
      const mockServices = [createMockService({ location: 'New York' })];
      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (prisma.service.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/services?location=New%20York'
      });

      const result = await ServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          location: {
            contains: 'New York',
            mode: 'insensitive',
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 0,
        take: 10,
      });
    });

    it('should perform keyword-filtered search when query is provided', async () => {
      const mockServices = [
        createMockService(),
        createMockService({ id: 'service456', name: 'Another Service' })
      ];
      
      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (recommendServices as jest.Mock).mockResolvedValue([0.9, 0.7]);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/services?q=cleaning'
      });

      const result = await ServicesGET(request);

      expect(recommendServices).toHaveBeenCalledWith(
        'cleaning',
        expect.arrayContaining([
          expect.stringContaining('Test Service'),
          expect.stringContaining('Another Service')
        ])
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { name: { contains: 'cleaning', mode: 'insensitive' } },
                { description: { contains: 'cleaning', mode: 'insensitive' } },
                { category: { contains: 'cleaning', mode: 'insensitive' } },
                { tags: { has: 'cleaning' } },
              ],
            },
          ],
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('should handle pagination correctly', async () => {
      const mockServices = Array(10).fill(null).map((_, i) => createMockService({ id: `service${i}` }));
      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);
      (prisma.service.count as jest.Mock).mockResolvedValue(25);

      const request = createMockRequest({
        method: 'GET',
        url: '/api/services?page=2&limit=10'
      });

      const result = await ServicesGET(request);

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 10, // Second page
        take: 10,
      });

      expect(result.json).toHaveBeenCalledWith({
        services: expect.arrayContaining([]),
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
      (prisma.service.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'GET',
        url: '/api/services'
      });

      const result = await ServicesGET(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /api/services', () => {
    it('should create service successfully with valid data', async () => {
      const mockService = createMockService();
      (prisma.service.create as jest.Mock).mockResolvedValue(mockService);

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test Service',
          description: 'Test service description',
          category: 'cleaning',
          price: 100,
          duration: 60,
          location: 'Test Location',
          availability: 'Test availability',
          tags: ['test', 'service']
        }
      });

      const result = await ServicesPOST(request);

      expect(prisma.service.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Service',
          description: 'Test service description',
          category: 'cleaning',
          price: 100,
          duration: 60,
          location: 'Test Location',
          availability: 'Test availability',
          tags: ['test', 'service'],
          providerId: 'provider123',
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'Service created successfully',
        service: {
          id: 'service123',
          name: 'Test Service',
          description: 'Test service description',
          category: 'cleaning',
          price: 100,
          duration: 60,
          location: 'Test Location',
          availability: 'Test availability',
          tags: ['test', 'service'],
        },
      });
    });

    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test Service'
          // Missing other required fields
        }
      });

      const result = await ServicesPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'All required fields must be provided'
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.service.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test Service',
          description: 'Test description',
          category: 'cleaning',
          price: 100,
          duration: 60,
          location: 'Test Location'
        }
      });

      const result = await ServicesPOST(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});