/**
 * Unit tests for the global proxy (`src/proxy.ts`).
 *
 * The proxy is the Next.js 16 replacement for `middleware.ts`: it applies
 * security headers, request-id correlation, per-IP rate limiting and CORS on
 * every request. These tests drive the real `proxy()` function with
 * deterministic mocks:
 *
 *  - `@/lib/cache/rateLimit` is mocked so limit outcomes are controlled;
 *  - `@/lib/config/env` is mocked so the CORS allow-list is controlled;
 *  - `@/lib/config/logger` is mocked for deterministic request ids;
 *  - `next/server` gets a file-local mock with a *constructable*
 *    `NextResponse` (the global harness mock only exposes static
 *    `json`/`next`, but the proxy also uses `new NextResponse(...)` for
 *    204 pre-flight responses).
 */
jest.mock("@/lib/cache/rateLimit", () => ({
  __esModule: true,
  rateLimit: jest.fn(),
  getClientIp: jest.fn(() => "test-ip"),
}));

jest.mock("@/lib/config/env", () => ({
  __esModule: true,
  getAllowedOrigins: jest.fn(() => ["*"]),
}));

// Deterministic request ids + silent logging.
jest.mock("@/lib/config/logger", () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    withRequest: jest.fn(),
  },
  generateRequestId: jest.fn(() => "req-test-1"),
}));

jest.mock("next/server", () => {
  class FakeNextResponse {
    headers: Headers;
    status: number;
    __data: any;

    constructor(_body?: any, init?: any) {
      this.headers = new Headers();
      this.status = init?.status ?? 200;
      this.__data = null;
      void _body;
    }

    static json(data: any, init?: any) {
      const response = new FakeNextResponse(null, init);
      response.__data = data;
      return response;
    }

    static next(_init?: any) {
      return new FakeNextResponse(null, { status: 200 });
    }

    async json() {
      return this.__data;
    }
  }

  return {
    __esModule: true,
    NextResponse: FakeNextResponse,
    NextRequest: class FakeNextRequest {},
  };
});

import { proxy } from "@/proxy";
import { rateLimit, getClientIp } from "@/lib/cache/rateLimit";
import { getAllowedOrigins } from "@/lib/config/env";

const rateLimitMock = rateLimit as jest.Mock;
const originsMock = getAllowedOrigins as jest.Mock;
const getClientIpMock = getClientIp as jest.Mock;

const RATE_LIMIT_OK = {
  success: true,
  limit: 100,
  remaining: 99,
  reset: Date.now() + 60_000,
};

function makeRequest(
  options: {
    method?: string;
    path?: string;
    origin?: string;
    requestId?: string;
  } = {}
): any {
  const { method = "GET", path = "/api/services", origin, requestId } = options;
  const url = `http://localhost${path}`;
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (requestId) headers.set("x-request-id", requestId);

  return { method, url, nextUrl: new URL(url), headers };
}

describe("proxy (global middleware)", () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
    rateLimitMock.mockResolvedValue({ ...RATE_LIMIT_OK });
    originsMock.mockReturnValue(["*"]);
    getClientIpMock.mockReturnValue("test-ip");
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_MAX;
  });

  describe("security headers & request id", () => {
    it("attaches hardened security headers to API responses", async () => {
      const response = await proxy(makeRequest());

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(response.headers.get("Permissions-Policy")).toContain(
        "geolocation=(self)"
      );
      expect(response.headers.get("Strict-Transport-Security")).toContain(
        "max-age=31536000"
      );
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "default-src 'self'"
      );
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "frame-ancestors 'none'"
      );
    });

    it("generates an x-request-id when none is supplied", async () => {
      const response = await proxy(makeRequest());
      expect(response.headers.get("x-request-id")).toBe("req-test-1");
    });

    it("reuses an incoming x-request-id", async () => {
      const response = await proxy(makeRequest({ requestId: "req-abc-123" }));
      expect(response.headers.get("x-request-id")).toBe("req-abc-123");
    });
  });

  describe("rate limiting", () => {
    it("rate-limits API routes with the default limit under the client ip", async () => {
      const response = await proxy(makeRequest({ path: "/api/services" }));

      expect(rateLimitMock).toHaveBeenCalledWith("test-ip:api", 100);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      expect(response.headers.get("X-RateLimit-Reset")).toBe(
        String(RATE_LIMIT_OK.reset)
      );
    });

    it("uses the resolved client ip for the limit bucket", async () => {
      getClientIpMock.mockReturnValue("1.2.3.4");

      await proxy(makeRequest({ path: "/api/services" }));

      expect(rateLimitMock).toHaveBeenCalledWith("1.2.3.4:api", 100);
    });

    it("applies the stricter auth limit on credential routes", async () => {
      await proxy(makeRequest({ path: "/api/auth/login", method: "POST" }));
      expect(rateLimitMock).toHaveBeenCalledWith("test-ip:auth", 10);

      await proxy(makeRequest({ path: "/api/auth/register", method: "POST" }));
      expect(rateLimitMock).toHaveBeenLastCalledWith("test-ip:auth", 10);
    });

    it("honours configured env limits", async () => {
      process.env.AUTH_RATE_LIMIT_MAX = "3";
      process.env.RATE_LIMIT_MAX = "250";

      await proxy(makeRequest({ path: "/api/auth/login", method: "POST" }));
      expect(rateLimitMock).toHaveBeenLastCalledWith("test-ip:auth", 3);

      await proxy(makeRequest({ path: "/api/services" }));
      expect(rateLimitMock).toHaveBeenLastCalledWith("test-ip:api", 250);
    });

    it("returns 429 with Retry-After and rate-limit headers when exceeded", async () => {
      rateLimitMock.mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 30_000,
      });

      const response = await proxy(
        makeRequest({ path: "/api/auth/login", method: "POST" })
      );

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      const body = await response.json();
      expect(body.code).toBe("TOO_MANY_REQUESTS");
      expect(body.requestId).toBe("req-test-1");

      // Security headers still apply to the rejection.
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("skips rate limiting for exempt routes but keeps headers", async () => {
      for (const path of ["/api/health", "/api/health/ready", "/api/location"]) {
        const response = await proxy(makeRequest({ path }));

        expect(rateLimitMock).not.toHaveBeenCalled();
        expect(response.headers.get("X-Frame-Options")).toBe("DENY");
        expect(response.headers.get("x-request-id")).toBe("req-test-1");
      }
    });
  });

  describe("CORS", () => {
    it("answers pre-flight requests with the full CORS header set", async () => {
      const response = await proxy(
        makeRequest({ method: "OPTIONS", origin: "https://app.example.com" })
      );

      expect(response.status).toBe(204);
      // Wildcard allow-list echoes the request origin.
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://app.example.com"
      );
      expect(response.headers.get("Vary")).toBe("Origin");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");

      // Pre-flight is never rate limited and still carries security headers.
      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("does not answer pre-flight for non-API routes", async () => {
      const response = await proxy(
        makeRequest({ method: "OPTIONS", path: "/services" })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("rejects origins outside the configured allow-list", async () => {
      originsMock.mockReturnValue(["https://app.example.com"]);

      const response = await proxy(
        makeRequest({ method: "OPTIONS", origin: "https://evil.example.com" })
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it("echoes an allow-listed origin on regular API responses", async () => {
      originsMock.mockReturnValue(["https://app.example.com"]);

      const response = await proxy(
        makeRequest({ origin: "https://app.example.com" })
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://app.example.com"
      );
      expect(response.headers.get("Vary")).toBe("Origin");
    });

    it("falls back to the wildcard origin when no Origin header is present", async () => {
      const response = await proxy(makeRequest());

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Vary")).toBe("Origin");
    });
  });

  describe("non-API routes", () => {
    it("only applies security headers and never rate-limits pages", async () => {
      const response = await proxy(makeRequest({ path: "/services" }));

      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("x-request-id")).toBe("req-test-1");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });
});
