import { POST } from '@/app/api/auth/login/route';
import { POST as RegisterPOST } from '@/app/api/auth/register/route';
import { createMockRequest, createMockResponse, createMockUser } from '../utils/test-utils';
import { prisma } from '@/lib/db/prisma';
import { comparePassword, generateToken } from '@/lib/auth';

jest.mock('@/lib/db/prisma');
jest.mock('@/lib/auth');

describe('Auth API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = createMockUser();
      const mockToken = 'mock_jwt_token';

      // Mock Prisma user findUnique
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock password comparison
      (comparePassword as jest.Mock).mockReturnValue(true);
      
      // Mock token generation
      (generateToken as jest.Mock).mockReturnValue(mockToken);

      const request = createMockRequest({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'correct_password'
        }
      });

      const response = createMockResponse();
      const result = await POST(request);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      
      expect(comparePassword).toHaveBeenCalledWith('correct_password', 'hashed_password');
      expect(generateToken).toHaveBeenCalledWith({
        userId: '123',
        email: 'test@example.com',
        role: 'customer'
      });
      
      expect(result.json).toHaveBeenCalledWith({
        message: 'Login successful',
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'customer'
        },
        token: mockToken
      });
    });

    it('should return 400 for missing email or password', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          email: 'test@example.com'
          // Missing password
        }
      });

      const response = createMockResponse();
      const result = await POST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Email and password are required'
      });
    });

    it('should return 401 for invalid email', async () => {
      // Mock user not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {
          email: 'nonexistent@example.com',
          password: 'password'
        }
      });

      const result = await POST(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Invalid credentials'
      });
    });

    it('should return 401 for invalid password', async () => {
      const mockUser = createMockUser();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockReturnValue(false);

      const request = createMockRequest({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'wrong_password'
        }
      });

      const result = await POST(request);

      expect(result.status).toHaveBeenCalledWith(401);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Invalid credentials'
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password'
        }
      });

      const result = await POST(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register successfully with valid data', async () => {
      const mockUser = createMockUser();
      const mockToken = 'mock_jwt_token';

      // Mock user not existing
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (generateToken as jest.Mock).mockReturnValue(mockToken);

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          phone: '1234567890',
          address: '123 Test St',
          role: 'customer'
        }
      });

      const result = await RegisterPOST(request);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: expect.any(String), // hashed password
          phone: '1234567890',
          address: '123 Test St',
          role: 'customer'
        }
      });
      
      expect(result.json).toHaveBeenCalledWith({
        message: 'User created successfully',
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'customer'
        },
        token: mockToken
      });
    });

    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test User'
          // Missing email and password
        }
      });

      const result = await RegisterPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Name, email, and password are required'
      });
    });

    it('should prevent multiple admin registrations', async () => {
      // Mock existing admin
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(createMockUser({ role: 'admin' }));

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'New Admin',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin'
        }
      });

      const result = await RegisterPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Admin account already exists. Please contact existing admin.'
      });
    });

    it('should enforce admin password strength', async () => {
      // Mock no existing admin
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Admin User',
          email: 'admin@example.com',
          password: '123', // Weak password
          role: 'admin'
        }
      });

      const result = await RegisterPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Admin passwords must be at least 8 characters long'
      });
    });

    it('should return 400 for existing email', async () => {
      // Mock existing user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(createMockUser());

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        }
      });

      const result = await RegisterPOST(request);

      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.json).toHaveBeenCalledWith({
        error: 'User already exists'
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        }
      });

      const result = await RegisterPOST(request);

      expect(result.status).toHaveBeenCalledWith(500);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});