import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withRole } from "@/middleware/auth";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const { pathname } = new URL(request.url);
    const id = pathname.split("/").pop();

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
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

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Get reviews for this service
    const reviews = await prisma.review.findMany({
      where: { serviceId: id },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        price: service.price,
        duration: service.duration,
        location: service.location,
        availability: service.availability,
        tags: service.tags,
        rating: service.rating,
        reviewCount: service.reviewCount,
        provider: service.provider
          ? {
              id: service.provider.id,
              name: service.provider.name,
              email: service.provider.email,
              phone: service.provider.phone,
              address: service.provider.address,
            }
          : null,
      },
      reviews: reviews.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        user: {
          name: review.user.name,
        },
        createdAt: review.createdAt,
      })),
    });
  } catch (error) {
    console.error("Service details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const PUT = withRole(["provider"])(
  async (request: NextRequest, user: any) => {
    try {
      const { pathname } = new URL(request.url);
      const id = pathname.split("/").pop();

      const service = await prisma.service.findFirst({
        where: { id, providerId: user.userId },
      });
      if (!service) {
        return NextResponse.json(
          { error: "Service not found or unauthorized" },
          { status: 404 }
        );
      }

      const body = await request.json();
      const {
        name,
        description,
        category,
        price,
        duration,
        location,
        availability,
        tags,
        isActive,
      } = body;

      // Build a partial update so callers can send only the fields they change
      // (previously every field was written unconditionally, so a partial body
      // would wipe the omitted columns).
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (category !== undefined) data.category = category;
      if (price !== undefined) data.price = price;
      if (duration !== undefined) data.duration = duration;
      if (location !== undefined) data.location = location;
      if (availability !== undefined) data.availability = availability;
      if (tags !== undefined) data.tags = tags;
      if (isActive !== undefined) data.isActive = isActive;

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields to update" },
          { status: 400 }
        );
      }

      const updatedService = await prisma.service.update({
        where: { id },
        data,
      });

      return NextResponse.json({
        message: "Service updated successfully",
        service: {
          id: updatedService.id,
          name: updatedService.name,
          description: updatedService.description,
          category: updatedService.category,
          price: updatedService.price,
          duration: updatedService.duration,
          location: updatedService.location,
          availability: updatedService.availability,
          tags: updatedService.tags,
          isActive: updatedService.isActive,
        },
      });
    } catch (error) {
      console.error("Service update error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

export const DELETE = withRole(["provider"])(
  async (request: NextRequest, user: any) => {
    try {
      const { pathname } = new URL(request.url);
      const id = pathname.split("/").pop();

      const service = await prisma.service.deleteMany({
        where: {
          id,
          providerId: user.userId,
        },
      });

      if (service.count === 0) {
        return NextResponse.json(
          { error: "Service not found or unauthorized" },
          { status: 404 }
        );
      }

      return NextResponse.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Service deletion error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);
