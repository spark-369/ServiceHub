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
    const status = searchParams.get('status') || '';
    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = {
      paymentStatus: { not: 'pending' }, // Only show completed payments
    };

    if (search) {
      where.OR = [
        { service: { name: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) {
      where.paymentStatus = status;
    }

    const [payments, total, revenueStats] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
              category: true,
              price: true,
            },
          },
        },
      }),
      prisma.booking.count({ where }),
      // Get revenue statistics
      prisma.booking.aggregate({
        where: {
          paymentStatus: 'paid',
        },
        _sum: {
          totalPrice: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Get payment status distribution
    const statusDistribution = await prisma.booking.groupBy({
      by: ['paymentStatus'],
      where: {
        paymentStatus: { not: 'pending' },
      },
      _count: {
        id: true,
      },
      _sum: {
        totalPrice: true,
      },
    });

    // Serialize status distribution to handle BigInt values
    const serializedStatusDistribution = statusDistribution.map((item: any) => ({
      paymentStatus: item.paymentStatus,
      count: Number(item._count.id) || 0,
      totalRevenue: Number(item._sum.totalPrice) || 0,
    }));

    // Get monthly revenue data (last 12 months)
    const monthlyRevenue = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as count,
        SUM("totalPrice") as revenue
      FROM "bookings" 
      WHERE "paymentStatus" = 'paid' 
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month DESC
    `;

    // Convert BigInt values to regular numbers for JSON serialization
    const serializedMonthlyRevenue = (monthlyRevenue as any[]).map((item) => ({
      month: item.month ? new Date(item.month).toISOString() : null,
      count: Number(item.count) || 0,
      revenue: Number(item.revenue) || 0,
    }));

    return NextResponse.json({
      payments,
      pagination: paginationMeta(page, limit, total),
      stats: {
        totalRevenue: revenueStats._sum.totalPrice || 0,
        totalTransactions: revenueStats._count.id || 0,
        statusDistribution: serializedStatusDistribution,
        monthlyRevenue: serializedMonthlyRevenue,
      },
      filters: {
        statuses: ['paid', 'refunded'],
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, bookingId } = await request.json();

    if (!action || !bookingId) {
      return NextResponse.json({ error: 'Action and booking ID are required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        service: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    switch (action) {
      case 'mark_paid':
        if (booking.paymentStatus === 'paid') {
          return NextResponse.json({ error: 'Booking already paid' }, { status: 400 });
        }

        const paidBooking = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'paid',
            updatedAt: new Date(),
          },
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
                category: true,
                price: true,
              },
            },
          },
        });

        return NextResponse.json({
          booking: paidBooking,
          message: 'Payment marked as paid',
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing payment action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/payments
 *
 * Admin CRUD — update a booking's payment fields. Only a whitelist of payment
 * columns can be changed; anything else (e.g. the booking's price or status) is
 * ignored so an admin cannot silently rewrite the booking itself.
 *
 * Body: { bookingId, paymentStatus?, stripePaymentId?, stripeCustomerId? }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, paymentStatus, stripePaymentId, stripeCustomerId } =
      await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const validPaymentStatuses = ['pending', 'paid', 'refunded'];
    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (paymentStatus !== undefined) {
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return NextResponse.json(
          { error: 'Invalid payment status' },
          { status: 400 }
        );
      }
      data.paymentStatus = paymentStatus;
      // Keep the paid/refunded timestamps coherent with the status.
      if (paymentStatus === 'paid') data.paidAt = new Date();
      if (paymentStatus === 'refunded') data.refundedAt = new Date();
    }

    if (stripePaymentId !== undefined) data.stripePaymentId = stripePaymentId;
    if (stripeCustomerId !== undefined) data.stripeCustomerId = stripeCustomerId;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        provider: {
          select: { id: true, name: true, email: true, phone: true },
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            price: true,
          },
        },
      },
    });

    return NextResponse.json({
      booking: updated,
      message: 'Payment updated successfully',
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/payments
 *
 * Admin CRUD — delete a payment *record*. Because payments live on the booking
 * row (there is no separate payments table), this resets the booking's payment
 * fields back to their defaults while keeping the booking itself intact.
 *
 * Query: ?bookingId=<id>
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const reset = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'pending',
        paidAt: null,
        refundedAt: null,
        stripePaymentId: null,
        stripeCustomerId: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      booking: { id: reset.id, paymentStatus: reset.paymentStatus },
      message: 'Payment record deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
