import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { withAuth } from "@/middleware/auth";
import { recommendServices } from "@/lib/integrations/ai";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    // Accept both `?q=` (frontend) and `?query=` (documented API alias).
    const query = searchParams.get("q") || searchParams.get("query");
    const category = searchParams.get("category");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      Math.max(Number.parseInt(limitParam || "10", 10) || 10, 1),
      50
    );

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    const where: any = { isActive: true };
    if (category) where.category = category;

    // Get all active services with provider info
    const services = await prisma.service.findMany({
      where,
      include: {
        provider: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
      take: 100, // Limit for performance
    });

    // Filter out services without providers
    const validServices = services.filter((service: any) => service.provider);

    if (validServices.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // Create service descriptions for AI matching
    const serviceDescriptions = validServices.map(
      (service: any) =>
        `${service.name} ${service.description} ${
          service.category
        } ${(service.tags ?? []).join(" ")}`
    );

    // Get AI recommendations
    const similarities = await recommendServices(query, serviceDescriptions);

    // Sort services by similarity score and return top results
    const recommendations = validServices
      .map((service: any, index: number) => ({
        service,
        similarity: similarities[index] ?? 0,
      }))
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ service, similarity }: any) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        price: service.price,
        duration: service.duration,
        location: service.location,
        rating: service.rating,
        reviewCount: service.reviewCount,
        tags: service.tags,
        // A service's provider relation may be missing (orphaned listing);
        // fall back to null rather than throwing on `provider.name`.
        provider: service.provider
          ? { name: service.provider.name }
          : null,
        // Expose the score under both names: `similarity` (raw) and
        // `relevanceScore` (percentage-style, used by the UI).
        similarity: Math.round(similarity * 100) / 100,
        relevanceScore: Math.round(similarity * 100) / 100,
      }));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
