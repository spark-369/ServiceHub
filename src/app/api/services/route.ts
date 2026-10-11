import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withRole } from "@/middleware/auth";
import { recommendServices } from "@/lib/integrations/ai";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";

/**
 * Builds a case-insensitive Prisma `contains` filter for a single search token
 * across the fields users expect to match: name, description, category and tags.
 */
function keywordFilter(token: string): any {
  const contains = token;
  return {
    OR: [
      { name: { contains, mode: "insensitive" } },
      { description: { contains, mode: "insensitive" } },
      { category: { contains, mode: "insensitive" } },
      { tags: { has: token } },
    ],
  };
}

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const category = searchParams.get("category");
    const location = searchParams.get("location");
    const providerId = searchParams.get("providerId");
    const { page, limit, skip } = parsePagination(searchParams);

    let where: any = { isActive: true };

    if (category) where.category = category;
    if (providerId) where.providerId = providerId;
    if (location) {
      where.location = {
        contains: location,
        mode: "insensitive",
      };
    }

    // Free-text search: filter by keyword rather than only re-ranking everything.
    // Each whitespace-separated token must match name/description/category/tags
    // (case-insensitive), so "house cleaning" returns cleaning services, not the
    // entire catalogue.
    if (query) {
      const tokens = query
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0);

      if (tokens.length > 0) {
        where.AND = tokens.map(keywordFilter);
      }
    }

    let services;
    let total;

    if (query) {
      // Fetch the keyword-filtered set, then attempt to re-rank it by semantic
      // similarity (best-effort). When the AI model is unavailable the lexical
      // fallback still yields a sensible ordering, and the keyword filter above
      // guarantees relevant results either way.
      const matchServices = await prisma.service.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
      });

      const descriptions = matchServices.map(
        (s: any) =>
          `${s.name} ${s.description} ${(s.tags ?? []).join(" ")}`
      );
      const similarities = await recommendServices(query, descriptions);

      const sortedServices = matchServices
        .map((service: any, index: number) => ({
          service,
          similarity: similarities[index] ?? 0,
        }))
        .sort((a: any, b: any) => b.similarity - a.similarity);

      total = sortedServices.length;
      services = sortedServices
        .slice(skip, skip + limit)
        .map((item: any) => item.service);
    } else {
      services = await prisma.service.findMany({
        where,

        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
        skip,
        take: limit,
      });

      total = await prisma.service.count({ where });
    }

    return NextResponse.json({
      services: services.map((service: any) => ({
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
        isActive: service.isActive,
        provider: service.provider
          ? {
              id: service.provider.id,
              name: service.provider.name,
              email: service.provider.email,
              phone: service.provider.phone,
            }
          : null,
      })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error("Services list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const POST = withRole(["provider"])(
  async (request: NextRequest, user: any) => {
    try {
      const {
        name,
        description,
        category,
        price,
        duration,
        location,
        availability,
        tags,
      } = await request.json();

      // Validation
      if (
        !name ||
        !description ||
        !category ||
        !price ||
        !duration ||
        !location
      ) {
        return NextResponse.json(
          { error: "All required fields must be provided" },
          { status: 400 }
        );
      }

      const service = await prisma.service.create({
        data: {
          name,
          description,
          category,
          price,
          duration,
          location,
          availability,
          tags: tags || [],
          providerId: user.userId,
        },
      });

      return NextResponse.json(
        {
          message: "Service created successfully",
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
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Service creation error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);
