import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withAuth } from "@/middleware/auth";

export const GET = withAuth(async (request: NextRequest, user: any) => {
  try {
    const userDoc = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: userDoc,
    });
  } catch (error) {
    console.error("Profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest, user: any) => {
  try {
    const { name, phone, address } = await request.json();

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: { name, phone, address },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        isVerified: true,
      },
    });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
