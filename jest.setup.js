// Jest setup file

// ---------------------------------------------------------------------------
// Test environment
// ---------------------------------------------------------------------------
// Deterministic, hermetic environment. Never reach a real Redis instance.
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing";
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.ALLOWED_ORIGINS = "*";
process.env.DEBUG_API_KEY = "";
delete process.env.REDIS_URL;

// ---------------------------------------------------------------------------
// In-memory Prisma fake
// ---------------------------------------------------------------------------
// Every route handler imports `prisma` from `@/lib/db/prisma`. Rather than
// mocking each model method per test (which drifts and never exercises real
// query shapes), we install ONE deterministic in-memory fake backed by simple
// arrays. Tests seed it via the helpers in `tests/utils/test-utils.ts` and
// assert against the resulting rows — so the routes under test run their real
// filtering/pagination/auth logic against realistic data.
jest.mock("@/lib/db/prisma", () => {
  // `require` inside the factory so the helper module (which itself imports
  // jest globals) is only loaded when this mock factory runs.
  const { createPrismaFake } = require("./tests/utils/prisma-fake");
  const client = createPrismaFake();
  return { __esModule: true, prisma: client, default: client };
});

// ---------------------------------------------------------------------------
// next/server — hybrid mock
// ---------------------------------------------------------------------------
// Route handlers build responses with `NextResponse.json(data, { status })`.
//
// Legacy `tests/api/*` suites assert the classic mock shape
// (`expect(res.status).toHaveBeenCalledWith(401)`), while the new e2e suites
// read real values via `statusOf()`/`jsonOf()`. We satisfy BOTH by returning an
// object whose `status`/`json` are jest mocks *pre-called* with their values —
// so `toHaveBeenCalledWith` passes and the smart readers can extract the value.
// `headers` stays a real `Headers` so `withApiHandler` (which calls
// `response.headers.set(...)`) works unmocked.
jest.mock("next/server", () => {
  const makeResponse = (data, init) => {
    const statusCode = init?.status ?? 200;
    // `status`/`json` are jest mocks that (a) return their value when called —
    // so `await response.json()` works — and (b) are pre-called with it, so
    // legacy `expect(res.status).toHaveBeenCalledWith(N)` assertions pass.
    const status = jest.fn(() => statusCode);
    status(statusCode); // pre-record so `toHaveBeenCalledWith` passes
    const json = jest.fn(() => data);
    json(data); // pre-record
    return { status, json, headers: new Headers(), statusCode, data };
  };

  return {
    NextRequest: jest.fn(),
    NextResponse: {
      json: (data, init) => makeResponse(data, init),
      next: () => ({ headers: new Headers(), status: 200 }),
    },
  };
});

// ---------------------------------------------------------------------------
// External integrations (never hit the network in tests)
// ---------------------------------------------------------------------------

// Mock Redis (no real connections in tests)
jest.mock("@/lib/cache/redis", () => {
  const client = {
    set: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(60000),
    pexpire: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue("OK"),
    on: jest.fn(),
    multi: jest.fn(() => ({
      incr: jest.fn().mockReturnThis(),
      pttl: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 60000],
      ]),
    })),
  };
  return {
    __esModule: true,
    default: client,
    getRedis: () => client,
    isRedisConfigured: () => true,
  };
});

// Mock the AI embedding model — deterministic lexical fallback is used instead,
// so no model download happens during tests.
jest.mock("@/lib/integrations/ai", () => ({
  recommendServices: jest.fn(() => Promise.resolve([0.9, 0.8, 0.7])),
}));

// Mock Stripe — never construct a real client or call the API.
jest.mock("@/lib/integrations/stripe", () => {
  const stripeClient = {
    paymentIntents: {
      create: jest.fn().mockResolvedValue({}),
      retrieve: jest.fn().mockResolvedValue({ status: "succeeded" }),
      confirm: jest.fn().mockResolvedValue({}),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({ id: "re_test_1" }),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  return {
    __esModule: true,
    stripe: stripeClient,
    default: stripeClient,
    STRIPE_PUBLISHABLE_KEY: "pk_test_dummy",
    STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
    requireStripe: jest.fn(() => stripeClient),
    isStripePublishableConfigured: jest.fn(() => true),
    formatAmountForStripe: jest.fn((amount) => Math.round(amount * 100)),
    formatAmountFromStripe: jest.fn((amount) => amount / 100),
  };
});

// ---------------------------------------------------------------------------
// Global hooks
// ---------------------------------------------------------------------------

jest.setTimeout(30000);

// Clear the in-memory DB and all mocks between tests so each test starts from
// a known, empty state.
beforeEach(() => {
  jest.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("@/lib/db/prisma");
  if (prisma && typeof prisma.__reset === "function") {
    prisma.__reset();
  }
});
