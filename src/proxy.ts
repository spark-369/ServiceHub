import { NextRequest, NextResponse } from "next/server";
import { getAllowedOrigins } from "@/lib/config/env";
import { rateLimit, getClientIp } from "@/lib/cache/rateLimit";
import { generateRequestId } from "@/lib/config/logger";

/**
 * Global proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Runs on the Node.js runtime before requests reach the app.
 *
 * Responsibilities:
 *  - Attach a correlation id to every request/response.
 *  - Apply hardened security headers to all responses.
 *  - Enforce per-IP rate limits on sensitive API routes.
 *  - Answer CORS pre-flight requests using the configured allow-list.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-DNS-Prefetch-Control": "on",
  // Note: data: images are required by Leaflet/Stripe marker assets; blob: is
  // used by Stripe Elements for worker/iframe sandboxes.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.stripe.com https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://*.stripe.com https://huggingface.co https://cdn.jsdelivr.net",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

// Routes that are rate-limited more aggressively (credential endpoints).
const AUTH_ROUTES = ["/api/auth/login", "/api/auth/register"];

/**
 * Routes that are exempt from rate limiting.
 *
 * The location endpoint is a high-frequency polling target (the live map pushes
 * and reads a position every few seconds), and the health probes are hit by the
 * orchestrator on a fixed schedule. Rate limiting either of them would take the
 * feature/infra down rather than protect it, so they are skipped.
 */
const RATE_LIMIT_EXEMPT_ROUTES = [
  "/api/location",
  "/api/health",
];

function isRateLimitExempt(pathname: string): boolean {
  return RATE_LIMIT_EXEMPT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function resolveAllowedOrigin(origin: string | null): string | null {
  const allowed = getAllowedOrigins();
  if (allowed.includes("*")) return origin || "*";
  if (origin && allowed.includes(origin)) return origin;
  return null;
}

function withCommonHeaders(response: NextResponse, requestId: string): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") || generateRequestId();
  const origin = request.headers.get("origin");
  const allowedOrigin = resolveAllowedOrigin(origin);
  const pathname = request.nextUrl.pathname;

  // CORS pre-flight
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const preflight = new NextResponse(null, { status: 204 });
    if (allowedOrigin) {
      preflight.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      preflight.headers.set("Vary", "Origin");
      preflight.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      preflight.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, x-request-id"
      );
      preflight.headers.set("Access-Control-Max-Age", "86400");
    }
    return withCommonHeaders(preflight, requestId);
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request.headers);
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

    // Skip rate limiting entirely for exempt routes (e.g. the polling location
    // endpoint and health probes) — but still add the CORS/security headers.
    if (!isRateLimitExempt(pathname)) {
      const max = isAuthRoute
        ? Number(process.env.AUTH_RATE_LIMIT_MAX || 10)
        : Number(process.env.RATE_LIMIT_MAX || 100);

      const result = await rateLimit(
        `${ip}:${isAuthRoute ? "auth" : "api"}`,
        max,
      );

      if (!result.success) {
        const retryAfter = Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000),
        );
        const limited = NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
            code: "TOO_MANY_REQUESTS",
            requestId,
          },
          { status: 429 },
        );
        limited.headers.set("Retry-After", String(retryAfter));
        limited.headers.set("X-RateLimit-Limit", String(result.limit));
        limited.headers.set("X-RateLimit-Remaining", "0");
        limited.headers.set("X-RateLimit-Reset", String(result.reset));
        return withCommonHeaders(limited, requestId);
      }

      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Limit", String(result.limit));
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
      response.headers.set("X-RateLimit-Reset", String(result.reset));
      if (allowedOrigin) {
        response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        response.headers.set("Vary", "Origin");
      }
      return withCommonHeaders(response, requestId);
    }

    // Exempt route: pass through with CORS headers only.
    const response = NextResponse.next();
    if (allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      response.headers.set("Vary", "Origin");
    }
    return withCommonHeaders(response, requestId);
  }

  // Non-API routes: security headers only.
  return withCommonHeaders(NextResponse.next(), requestId);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
