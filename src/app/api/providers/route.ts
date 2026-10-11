import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withAuth, withRole } from "@/middleware/auth";
import { hashPassword } from "@/lib/auth";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const verified = searchParams.get("verified");
    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = { role: "provider" };
    if (verified === "true" || verified === "false") {
      where.isVerified = verified === "true";
    }

    // Fetch providers and their aggregate counts in a single round-trip
    // (previously this was an N+1: one query set per provider).
    const [providers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              providedServices: true,
              bookingsAsProvider: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      providers: providers.map((provider: any) => ({
        id: provider.id,
        name: provider.name,
        email: provider.email,
        phone: provider.phone,
        address: provider.address,
        role: provider.role,
        isVerified: provider.isVerified,
        servicesCount: provider._count?.providedServices ?? 0,
        totalBookings: provider._count?.bookingsAsProvider ?? 0,
        createdAt: provider.createdAt,
      })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error("Providers list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

export const POST = withRole(["admin"])(
  async (request: NextRequest) => {
    try {
      const { name, email, password, phone, address } = await request.json();

      // Validation
      if (!name || !email || !password) {
        return NextResponse.json(
          { error: "Name, email, and password are required" },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "User already exists" },
          { status: 400 }
        );
      }

      // Create provider
      const provider = await prisma.user.create({
        data: {
          name,
          email,
          password: hashPassword(password),
          phone,
          address,
          role: "provider",
        },
      });

      return NextResponse.json(
        {
          message: "Provider created successfully",
          provider: {
            id: provider.id,
            name: provider.name,
            email: provider.email,
            phone: provider.phone,
            address: provider.address,
            role: provider.role,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Provider creation error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);
