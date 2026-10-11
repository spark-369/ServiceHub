import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withAuth } from "@/middleware/auth";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";

export const GET = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const { page, limit, skip } = parsePagination(searchParams);

    let where: any = {};

    if (user.role === "customer" || user.role === "user") {
      where.userId = user.userId;
    } else if (user.role === "provider") {
      where.providerId = user.userId;
    }

    if (status) where.status = status;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
          },
        },
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
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    const total = await prisma.booking.count({ where });

    return NextResponse.json({
      bookings: bookings.map((booking: any) => ({
        id: booking.id,
        date: booking.date,
        status: booking.status,
        notes: booking.notes,
        totalPrice: booking.totalPrice,
        paymentStatus: booking.paymentStatus,
        paidAt: booking.paidAt,
        refundedAt: booking.refundedAt,
        stripePaymentId: booking.stripePaymentId,
        stripeCustomerId: booking.stripeCustomerId,
        service: {
          id: booking.service.id,
          name: booking.service.name,
          description: booking.service.description,
          price: booking.service.price,
          duration: booking.service.duration,
        },
        user:
          user.role === "customer" || user.role === "user"
            ? undefined
            : {
                id: booking.user.id,
                name: booking.user.name,
                email: booking.user.email,
                phone: booking.user.phone,
              },
        provider:
          user.role === "provider"
            ? undefined
            : {
                id: booking.provider.id,
                name: booking.provider.name,
                email: booking.provider.email,
                phone: booking.provider.phone,
              },
        createdAt: booking.createdAt,
      })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error("Bookings list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { serviceId, date, notes } = await request.json();

    // Validation
    if (!serviceId || !date) {
      return NextResponse.json(
        { error: "Service ID and date are required" },
        { status: 400 },
      );
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date" },
        { status: 400 },
      );
    }

    // Bookings must be for a (roughly) future point in time. A small grace
    // window avoids rejecting a request that races with the clock.
    if (parsedDate.getTime() < Date.now() - 60 * 1000) {
      return NextResponse.json(
        { error: "Booking date must be in the future" },
        { status: 400 },
      );
    }

    // Check if service exists and is active
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.isActive) {
      return NextResponse.json(
        { error: "Service not found or unavailable" },
        { status: 404 },
      );
    }

    // Check if user is not booking their own service
    if (service.providerId === user.userId) {
      return NextResponse.json(
        { error: "Cannot book your own service" },
        { status: 400 },
      );
    }

    // Check for conflicting bookings for the same service at the same time.
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        serviceId: serviceId,
        date: parsedDate,
        status: {
          in: ["pending", "confirmed", "in_progress"],
        },
      },
    });

    if (conflictingBooking) {
      return NextResponse.json(
        { error: "Service is not available at this time" },
        { status: 400 },
      );
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: user.userId,
        serviceId: serviceId,
        providerId: service.providerId,
        date: parsedDate,
        notes,
        totalPrice: service.price,
      },
    });

    return NextResponse.json(
      {
        message: "Booking created successfully",
        booking: {
          id: booking.id,
          date: booking.date,
          status: booking.status,
          totalPrice: booking.totalPrice,
          service: {
            id: service.id,
            name: service.name,
            description: service.description,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Booking creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
