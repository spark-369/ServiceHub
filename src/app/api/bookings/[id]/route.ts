import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withAuth } from "@/middleware/auth";

export const GET = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { pathname } = new URL(request.url);
    const id = pathname.split("/").pop();

    const booking = await prisma.booking.findUnique({
      where: { id },
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
            address: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Check if user has permission to view this booking
    // Allow access if user is the customer, provider, or admin
    const isCustomer = booking.userId === user.userId;
    const isProvider = booking.providerId === user.userId;
    const isAdmin = user.role === "admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if review exists
    const review = await prisma.review.findFirst({
      where: { bookingId: id, userId: user.userId },
    });

    return NextResponse.json({
      booking: {
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
        user: {
          id: booking.user.id,
          name: booking.user.name,
          email: booking.user.email,
          phone: booking.user.phone,
          address: booking.user.address,
        },
        provider: {
          id: booking.provider.id,
          name: booking.provider.name,
          email: booking.provider.email,
          phone: booking.provider.phone,
          address: booking.provider.address,
        },
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
      canReview: booking.status === "completed" && !review,
    });
  } catch (error) {
    console.error("Booking details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

export const PUT = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { pathname } = new URL(request.url);
    const id = pathname.split("/").pop();

    const booking = await prisma.booking.findUnique({
      where: { id },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { status, notes } = await request.json();

    // Authorization checks
    if (
      (user.role === "customer" || user.role === "user") &&
      booking.userId !== user.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (user.role === "provider" && booking.providerId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Status transition validation. Keyed by the customer-facing role names;
    // `user` is kept as a legacy alias for older JWTs.
    const allowedStatuses: { [key: string]: string[] } = {
      customer: ["cancelled"],
      user: ["cancelled"],
      provider: ["confirmed", "in_progress", "completed", "cancelled"],
      admin: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
    };

    if (status && !allowedStatuses[user.role]?.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status transition" },
        { status: 400 },
      );
    }

    // Guard against nonsensical transitions (e.g. re-opening a completed or
    // cancelled booking, or moving backwards).
    if (status) {
      const transitions: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["in_progress", "completed", "cancelled"],
        in_progress: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      const permitted = transitions[booking.status] ?? [];
      if (status !== booking.status && !permitted.includes(status)) {
        return NextResponse.json(
          { error: `Cannot change status from ${booking.status} to ${status}` },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Booking updated successfully",
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        notes: updatedBooking.notes,
      },
    });
  } catch (error) {
    console.error("Booking update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { pathname } = new URL(request.url);
    const id = pathname.split("/").pop();

    const booking = await prisma.booking.findUnique({
      where: { id },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only allow cancellation, not deletion
    if (booking.status === "completed" || booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot cancel completed or already cancelled booking" },
        { status: 400 },
      );
    }

    // Check permissions
    if (
      booking.userId !== user.userId &&
      booking.providerId !== user.userId &&
      user.role !== "admin"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.booking.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Booking cancellation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
