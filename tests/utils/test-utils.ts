import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

// NOTE: deliberately NOT importing `@/lib/auth` here. `tests/lib/auth.test.ts`
// imports from both `@/lib/auth` and this module, so pulling `@/lib/auth` in
// would create a circular import that collapses `createRequest`'s parameter
// list at the call site (TypeScript: "Expected 0 arguments, but got 1").
// We use the same `jsonwebtoken`/`bcryptjs` primitives directly instead.

/**
 * Shared test helpers.
 *
 * Two layers:
 *
 *  1. **Real-harness helpers** (`createRequest`, `jsonOf`, `statusOf`,
 *     `authHeader`, `signTestToken`, `seed`) — build faithful
 *     `NextRequest`-shaped objects (real `Headers`, real `nextUrl`) and read
 *     real `NextResponse` results. Route handlers run unmocked against the
 *     in-memory Prisma fake installed by `jest.setup.js`.
 *
 *  2. **Legacy factories** (`createMockRequest`, `createMockUser`, …) — kept
 *     for the older `tests/api/*` suites. New tests should prefer the
 *     real-harness helpers above.
 */

// ---------------------------------------------------------------------------
// Real-harness request builder
// ---------------------------------------------------------------------------

/** Headers accepted by `createRequest` (plain object *or* `Headers`). */
type HeaderInit = Record<string, string> | Headers;

function toHeaders(init?: HeaderInit): Headers {
  if (!init) return new Headers();
  if (typeof Headers !== "undefined" && init instanceof Headers) {
    return init;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(init)) {
    headers.set(key, value);
  }
  return headers;
}

export interface CreateRequestOptions {
  method?: string;
  /** Relative (`/api/thing?page=1`) or absolute (`http://localhost/...`). */
  url?: string;
  body?: unknown;
  headers?: HeaderInit;
}

/**
 * Build a `NextRequest`-shaped object for a route handler.
 *
 * Always exposes `url`, `nextUrl`, `headers` (real `Headers`), `json()`,
 * `text()` and `formData()`, so handlers can be exercised without a live HTTP
 * server — including `withApiHandler`-wrapped routes that read
 * `request.nextUrl.pathname`.
 */
export function createRequest(options?: CreateRequestOptions): any {
  const { method = "GET", url = "/", body = null, headers } = options ?? {};
  const absoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
    ? url
    : `http://localhost${url.startsWith("/") ? "" : "/"}${url}`;
  const parsed = new URL(absoluteUrl);
  const requestHeaders = toHeaders(headers);

  return {
    method,
    url: absoluteUrl,
    nextUrl: parsed,
    headers: requestHeaders,
    json: jest.fn(async () => body),
    text: jest.fn(async () =>
      body === null || body === undefined
        ? ""
        : typeof body === "string"
          ? body
          : JSON.stringify(body)
    ),
    formData: jest.fn(async () => new FormData()),
  };
}

/** Build a request carrying a Bearer token (real JWT from `@/lib/auth`). */
export function createAuthedRequest(
  token: string,
  options?: CreateRequestOptions
): any {
  const headers = toHeaders(options?.headers);
  headers.set("authorization", `Bearer ${token}`);
  return createRequest({ ...options, headers });
}

// ---------------------------------------------------------------------------
// Real-harness response readers
// ---------------------------------------------------------------------------

/**
 * Read the JSON payload of a response.
 *
 * Handles three shapes:
 *  - a real `NextResponse` (`response.json()` returns a promise),
 *  - the hybrid `next/server` mock (`response.json` is a jest mock pre-called
 *    with the payload),
 *  - a plain `{ json }` object (e.g. hand-built in `withApiHandler` tests).
 */
export async function jsonOf(response: any): Promise<any> {
  const j = response?.json;
  if (typeof j !== "function") return undefined;
  if (j.mock?.calls?.length) {
    // Hybrid mock: the payload was pre-recorded.
    return j.mock.calls[j.mock.calls.length - 1][0];
  }
  return await j();
}

/**
 * The HTTP status of a response.
 *
 * Handles real `NextResponse` (numeric `status`), the hybrid `next/server`
 * mock (a jest mock pre-called with the code), and plain `{ status }` objects.
 */
export function statusOf(response: any): number {
  const s = response?.status;
  if (typeof s === "function") {
    if (s.mock?.calls?.length) {
      return s.mock.calls[s.mock.calls.length - 1][0];
    }
    const value = s();
    return typeof value === "number" ? value : 200;
  }
  return typeof s === "number" ? s : 200;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// In-memory DB seeding
// ---------------------------------------------------------------------------

type ModelKey = "user" | "service" | "booking" | "review" | "payment" | "webhookEvent";

/** Seed rows into the in-memory Prisma fake (cleared automatically per test). */
export function seed(model: ModelKey, rows: any[]) {
  (prisma as any).__seed(model, rows);
}

/** Direct access to the underlying store (for white-box assertions). */
export function store(model: ModelKey): any[] {
  return (prisma as any).__store(model);
}

/** Reset the in-memory DB (normally handled by the global `beforeEach`). */
export function resetDb() {
  (prisma as any).__reset();
}


// ---------------------------------------------------------------------------
// Test data factories (legacy — used by the older tests/api suites)
// ---------------------------------------------------------------------------

export const createMockUser = (overrides: any = {}) => ({
  id: "123",
  name: "Test User",
  email: "test@example.com",
  password: "hashed_password",
  role: "customer",
  phone: "1234567890",
  address: "123 Test St",
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockService = (overrides: any = {}) => ({
  id: "service123",
  name: "Test Service",
  description: "Test service description",
  category: "cleaning",
  price: 100,
  duration: 60,
  location: "Test Location",
  availability: { days: ["mon"], startTime: "09:00", endTime: "17:00" },
  tags: ["test", "service"],
  rating: 0,
  reviewCount: 0,
  isActive: true,
  providerId: "provider123",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockBooking = (overrides: any = {}) => ({
  id: "booking123",
  userId: "123",
  serviceId: "service123",
  providerId: "provider123",
  date: new Date(Date.now() + 86400000),
  status: "pending",
  notes: "Test booking notes",
  totalPrice: 100,
  paymentStatus: "pending",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockReview = (overrides: any = {}) => ({
  id: "review123",
  bookingId: "booking123",
  userId: "123",
  serviceId: "service123",
  providerId: "provider123",
  rating: 5,
  comment: "Great service!",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPayment = (overrides: any = {}) => ({
  id: "payment123",
  bookingId: "booking123",
  amount: 100,
  currency: "usd",
  status: "pending",
  stripePaymentIntentId: "pi_test123",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Snapshot the given `process.env` keys and return a restore function.
 *
 * Use it to isolate tests that mutate `process.env`:
 *
 * ```ts
 * const restore = saveEnv(['JWT_SECRET']);
 * process.env.JWT_SECRET = 'x';
 * // ...
 * restore();
 * ```
 */
export function saveEnv(keys: string[]): () => void {
  const snapshot = new Map<string, string | undefined>();
  for (const key of keys) {
    snapshot.set(key, process.env[key]);
  }
  return () => {
    for (const [key, value] of snapshot) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

// ---------------------------------------------------------------------------
// Legacy mock request/response helpers
// ---------------------------------------------------------------------------

export const createMockRequest = (options: any = {}) => {
  const {
    method = "GET",
    url = "/",
    body = null,
    headers = {} as Record<string, string>,
  } = options;

  // Next.js always hands route handlers an *absolute* `NextRequest.url`
  // (e.g. `http://localhost/api/bookings?page=1`). Route handlers parse it with
  // `new URL(request.url)`, which throws on a relative path, so mirror the real
  // runtime by giving relative test URLs a base origin.
  const absoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
    ? url
    : `http://localhost${url.startsWith("/") ? "" : "/"}${url}`;

  const mockRequest: any = {
    method,
    url: absoluteUrl,
    nextUrl: new URL(absoluteUrl),
    headers: new Map<string, string>(Object.entries(headers)),
    json: jest.fn(),
  };

  // Mock URL parsing
  Object.defineProperty(mockRequest, "url", {
    get: () => absoluteUrl,
  });

  // Mock headers
  mockRequest.headers.get = jest.fn((key: string) => headers[key] || null);

  // Mock JSON parsing
  if (body) {
    (mockRequest.json as any).mockResolvedValue(body);
  }

  return mockRequest;
};

export const createMockResponse = () => {
  const response: any = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    headers: new Headers(),
  };

  return response;
};

// Authentication helpers (legacy)
export const createAuthenticatedRequest = (userRole = "customer", userId = "123") => {
  const token = `${userRole}_token`;
  return createMockRequest({
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
};

// Test assertion helpers (legacy)
export const expectResponse = (response: any, status = 200, data: any = null) => {
  expect(response.status).toHaveBeenCalledWith(status);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      ...(data ? data : {}),
      ...(status >= 400 && { error: expect.any(String) }),
    })
  );
};

// Clean up all mocks
export const clearAllMocks = () => {
  jest.clearAllMocks();
};

/** Sign a real JWT for the given user (uses the test `JWT_SECRET`). */
export function signTestToken(user: {
  userId?: string;
  id?: string;
  email: string;
  role: string;
}): string {
  const secret = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
    ? process.env.JWT_SECRET
    : "dev-insecure-jwt-secret-change-me";
  return jwt.sign(
    {
      userId: user.userId ?? user.id ?? "user_test",
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "7d" }
  );
}

/** A `Authorization: Bearer …` header value for a signed token. */
export function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Hash a password the same way the app does (real bcrypt). */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}
