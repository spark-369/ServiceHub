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
    const category = searchParams.get('category') || '';
    const isActive = searchParams.get('isActive');
    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
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
      }),
      prisma.service.count({ where }),
    ]);

    // Get unique categories for filtering
    const categories = await prisma.service.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    return NextResponse.json({
      services,
      pagination: paginationMeta(page, limit, total),
      categories: categories.map(c => c.category),
    });
  } catch (error) {
    console.error('Error fetching services:', error);
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
    const serviceId = body.serviceId;
    const updates = (body.updates ?? body) as Record<string, any>;

    if (!serviceId) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    // Whitelist + coerce numeric fields (form values arrive as strings, which
    // Prisma rejects for Float/Int columns).
    const data: Record<string, unknown> = {};
    if (typeof updates === 'object' && updates !== null) {
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.category !== undefined) data.category = updates.category;
      if (updates.location !== undefined) data.location = updates.location;
      if (updates.price !== undefined) {
        const price = Number(updates.price);
        if (!Number.isFinite(price)) {
          return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
        }
        data.price = price;
      }
      if (updates.duration !== undefined) {
        const duration = Number.parseInt(String(updates.duration), 10);
        if (!Number.isFinite(duration)) {
          return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
        }
        data.duration = duration;
      }
      if (updates.isActive !== undefined) data.isActive = Boolean(updates.isActive);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data,
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

    return NextResponse.json({ service: updatedService });
  } catch (error) {
    console.error('Error updating service:', error);
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
    const serviceId = searchParams.get('id');

    if (!serviceId) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    // Check if service has active bookings
    const serviceData = await prisma.service.findUnique({
      where: { id: serviceId },
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

    if (!serviceData) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (serviceData.bookings.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete service with active bookings. Please resolve all active bookings first.',
          details: {
            activeBookings: serviceData.bookings.length,
          }
        },
        { status: 400 }
      );
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return NextResponse.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}