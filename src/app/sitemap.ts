import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://servicehub.example.com";

/**
 * Static sitemap for the public, crawlable pages of the app.
 *
 * Authenticated pages (bookings, payments, profile, admin, provider) are
 * intentionally omitted — they require a signed-in user and return no public
 * content. Dynamic service detail pages can't be enumerated here without a
 * database call at build time; add a `generateSitemaps`/`sitemap` data source
 * once the public service catalogue is exposed for indexing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = ["/", "/recommendations", "/auth/login", "/auth/register"];

  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "daily" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
