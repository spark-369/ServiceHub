import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, phone, address, role } =
      await request.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Reject unknown roles early (otherwise Prisma throws a 500 on the enum).
    // `user` is still accepted as an alias and mapped to the `customer` role.
    const requestedRole = role === "user" ? "customer" : role ?? "customer";
    if (!["customer", "provider", "admin"].includes(requestedRole)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Password policy. Admins get a distinct (specific) message to match the
    // documented behaviour; everyone else shares a generic minimum length.
    if (typeof password !== "string" || password.length < 8) {
      if (requestedRole === "admin") {
        return NextResponse.json(
          { error: "Admin passwords must be at least 8 characters long" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Admin registration security
    if (requestedRole === "admin") {
      // Check if admin already exists
      const existingAdmin = await prisma.user.findFirst({
        where: { role: "admin" },
      });
      if (existingAdmin) {
        return NextResponse.json(
          { error: "Admin account already exists. Please contact existing admin." },
          { status: 400 }
        );
      }
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

    // Hash password
    const hashedPassword = hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        role: requestedRole,
        // Location will be set via separate API call from client
      },
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
