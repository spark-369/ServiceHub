import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { parsePagination, paginationMeta } from '@/lib/api/pagination';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
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
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = body.userId;
    const updates = (body.updates ?? body) as Record<string, any>;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Whitelist updatable fields — never let a caller change the id, password
    // hash, or createdAt through this endpoint.
    const allowed: Record<string, unknown> = {};
    if (typeof updates === 'object' && updates !== null) {
      if (updates.name !== undefined) allowed.name = updates.name;
      if (updates.email !== undefined) allowed.email = updates.email;
      if (updates.phone !== undefined) allowed.phone = updates.phone;
      if (updates.address !== undefined) allowed.address = updates.address;
      if (updates.role !== undefined) {
        if (!['customer', 'provider', 'admin'].includes(updates.role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        allowed.role = updates.role;
      }
      if (updates.isVerified !== undefined) {
        allowed.isVerified = Boolean(updates.isVerified);
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: allowed,
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

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if user has active bookings or services
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        bookingsAsUser: { where: { status: { in: ['pending', 'confirmed', 'in_progress'] } } },
        bookingsAsProvider: { where: { status: { in: ['pending', 'confirmed', 'in_progress'] } } },
        providedServices: { where: { isActive: true } },
      },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasActiveBookings = userData.bookingsAsUser.length > 0 || userData.bookingsAsProvider.length > 0;
    const hasActiveServices = userData.providedServices.length > 0;

    if (hasActiveBookings || hasActiveServices) {
      return NextResponse.json(
        { 
          error: 'Cannot delete user with active bookings or services. Please resolve all active items first.',
          details: {
            activeUserBookings: userData.bookingsAsUser.length,
            activeProviderBookings: userData.bookingsAsProvider.length,
            activeServices: userData.providedServices.length,
          }
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}