import { POST as ReviewsPOST } from '@/app/api/reviews/route';
import { createMockRequest, createMockResponse, createMockReview, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { withAuth } from '@/middleware/auth';

jest.mock('@/lib/db/prisma');
jest.mock('@/middleware/auth');

describe('Reviews API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/reviews', () => {
    it('should create review successfully with valid data', async () => {
      const mockReview = createMockReview();
      const mockBooking = { 
        id: 'booking123', 
        userId: '123', 
        serviceId: 'service123', 
        providerId: 'provider123',
        status: 'completed' 
      };
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.review.create as jest.Mock).mockResolvedValue(mockReview);
      (prisma.service.update as jest.Mock).mockResolvedValue({});

      const request = createMockRequest({
        method: 'POST',
        body: {
          bookingId: 'booking123',
          rating: 5,
          comment: 'Great service!'
        }
      });

      const result = await ReviewsPOST(request);

      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: 'booking123' },
        include: {
          service: true,
          provider: true,
        },
      });

      expect(prisma.review.findUnique).toHaveBeenCalledWith({
        where: { bookingId: 'booking123' },
      });

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          userId: '123',
          serviceId: 'service123',
          providerId: 'provider123',
          bookingId: 'booking123',
          rating: 5,
          comment: 'Great service!',
        },
      });

      expect(result.json).toHaveBeenCalledWith({
        message: 'Review created successfully',
        review: expect.objectContaining({
          id: 'review123',
          rating: 5,
          comment: 'Great service!',
        }),
      });
    });

    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          rating: 5
          // Missing bookingId
        }
      });

      const result = await ReviewsPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Booking ID and rating are required'
      });
    });

    it('should validate rating range', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          bookingId: 'booking123',
          rating: 10, // Invalid rating
          comment: 'Great service!'
        }
      });

      const result = await ReviewsPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Rating must be between 1 and 5'
      });
    });

    it('should prevent duplicate reviews for same booking', async () => {
      // Mock existing review
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
        id: 'booking123',
        userId: '123',
        serviceId: 'service123',
        providerId: 'provider123',
        status: 'completed'
      });
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(createMockReview());

      const request = createMockRequest({
        method: 'POST',
        body: {
          bookingId: 'booking123',
          rating: 5,
          comment: 'Great service!'
        }
      });

      const result = await ReviewsPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Review already exists for this booking'
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.booking.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'POST',
        body: {
          bookingId: 'booking123',
          rating: 5,
          comment: 'Great service!'
        }
      });

      const result = await ReviewsPOST(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});