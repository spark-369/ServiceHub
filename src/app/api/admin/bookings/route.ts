import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";
    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = {};
    if (search) {
      where.OR = [
        { service: { name: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { provider: { name: { contains: search, mode: "insensitive" } } },
        { provider: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
          review: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    // Get unique statuses and payment statuses for filtering
    const statuses = [
      "pending",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
    ];
    const paymentStatuses = ["pending", "paid", "refunded"];

    return NextResponse.json({
      bookings,
      pagination: paginationMeta(page, limit, total),
      filters: {
        statuses,
        paymentStatuses,
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const bookingId = body.bookingId;
    // Accept both `{ bookingId, updates: {...} }` (used by the admin UI) and
    // `{ bookingId, status, notes }` (top-level fields) for compatibility.
    const updates = (body.updates ?? body) as Record<string, any>;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 },
      );
    }

    // Validate status transitions
    if (updates.status) {
      const validStatuses = [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
    }

    // Validate payment status transitions
    if (updates.paymentStatus) {
      const validPaymentStatuses = ["pending", "paid", "refunded"];
      if (!validPaymentStatuses.includes(updates.paymentStatus)) {
        return NextResponse.json(
          { error: "Invalid payment status" },
          { status: 400 },
        );
      }
    }

    // Whitelist mutable fields (never allow id/foreign keys to change here).
    const data: Record<string, unknown> = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.paymentStatus !== undefined)
      data.paymentStatus = updates.paymentStatus;
    if (updates.notes !== undefined) data.notes = updates.notes;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data,
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
      message: "Booking updated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("id");

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 },
      );
    }

    // Check if booking has a review
    const bookingData = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true,
      },
    });

    if (!bookingData) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Don't allow deletion of completed bookings with reviews
    if (bookingData.review) {
      return NextResponse.json(
        { error: "Cannot delete booking with existing review" },
        { status: 400 },
      );
    }

    await prisma.booking.delete({
      where: { id: bookingId },
    });

    return NextResponse.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
