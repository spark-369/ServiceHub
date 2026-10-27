# Home Service Discovery Platform

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0-green?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red?style=for-the-badge&logo=redis)](https://redis.io/)
[![Stripe](https://img.shields.io/badge/Stripe-purple?style=for-the-badge&logo=stripe)](https://stripe.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Hugging Face](https://img.shields.io/badge/Transformers.js-yellow?style=for-the-badge&logo=huggingface)](https://huggingface.co/docs/transformers.js)

A comprehensive home service discovery platform connecting users with local service providers.

[Features](#features) • [Architecture](#architecture) • [Data Model](#data-model) • [API Reference](#api-reference) • [Getting Started](#getting-started)

</div>

---

## Overview

Homely is a full-stack web application that enables users to discover, book, and review
local service providers. The platform supports multiple user roles (customers,
providers, administrators) and includes AI-powered service recommendations,
real-time location tracking, and secure payment processing.

## Features

- **Service Discovery** — Browse and search services with AI-powered semantic search
- **Smart Booking** — Schedule appointments with real-time availability
- **Secure Payments** — Integrated Stripe payment processing with webhook verification
- **Location Tracking** — Real-time provider/customer location via Redis
- **AI Recommendations** — Local, on-device semantic recommendations (Transformers.js)
- **Review System** — Rate and review completed services
- **Admin Dashboard** — Comprehensive management interface

### How AI recommendations work

Recommendations are powered by **on-device embeddings**, not an external API.
On first use, the app loads the [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
feature-extraction model via [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js).
Service descriptions are embedded and ranked by cosine similarity against the
user's query. If the model cannot be downloaded (offline/restricted environments),
the system degrades gracefully to a deterministic lexical (token-overlap) scorer so
search requests never fail.

### Production Hardening

- **Stripe webhooks** — `/api/webhooks/stripe` verifies signatures and is the
  authoritative source of payment state, with idempotent event processing.
- **Rate limiting** — Redis-backed, per-IP limits (stricter on auth routes),
  with an in-memory fallback when Redis is unavailable.
- **Security headers & CORS** — applied globally via `src/proxy.ts`
  (the Next.js 16 replacement for `middleware.ts`).
- **Structured logging** — JSON logs with per-request correlation ids.
- **Validated configuration** — env vars are schema-validated
  (`src/lib/config/env.ts`).
- **Health probes** — `/api/health` and `/api/health/ready` for Kubernetes.
- **Error boundaries** — `error.tsx`, `not-found.tsx`, `loading.tsx`.
- **Graceful shutdown** — `src/instrumentation.node.ts` closes DB/Redis on SIGTERM.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
│  Next.js 16 (App Router) + React 19 + TypeScript + Tailwind    │
│  ├── Authentication (JWT)                                        │
│  ├── Role-based Access Control                                  │
│  └── Real-time Maps (Leaflet)                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                         API Layer                                │
│  Next.js API Routes + Proxy (src/proxy.ts) + Route Guards      │
│  ├── Authentication (/api/auth)                                 │
│  ├── Services & Reviews (/api/services, /api/reviews)          │
│  ├── Bookings (/api/bookings)                                   │
│  ├── Payments & Webhooks (/api/payments, /api/webhooks/stripe)  │
│  ├── Recommendations & Location (/api/recommendations, /api/location) │
│  ├── Administration (/api/admin)                                │
│  └── Health (/api/health)                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                        Data Layer                                │
│  PostgreSQL (Prisma ORM)                                         │
│  ├── Users, Services, Bookings, Reviews                          │
│  └── Redis (Location Caching)                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── app/                             # Next.js App Router pages
│   ├── api/                        # Backend API routes
│   │   ├── admin/                 # Admin management endpoints
│   │   ├── auth/                  # Authentication endpoints
│   │   ├── bookings/              # Booking management
│   │   ├── dev/test-env/          # Dev-only diagnostics (disabled in prod)
│   │   ├── health/                # Liveness + readiness probes
│   │   ├── location/              # Real-time location tracking
│   │   ├── payments/              # Payment processing
│   │   ├── providers/             # Provider endpoints
│   │   ├── recommendations/       # AI recommendations
│   │   ├── reviews/               # Review management
│   │   ├── services/              # Service management
│   │   └── webhooks/stripe/       # Stripe webhook receiver
│   ├── admin/                      # Admin dashboard page
│   ├── auth/                       # Login/Register pages
│   ├── bookings/                   # Bookings list + payment page
│   ├── payments/                   # Payments overview page
│   ├── provider/                   # Provider services dashboard
│   ├── profile/                    # User profile page
│   ├── recommendations/            # AI recommendations page
│   ├── services/                   # Service browsing
│   ├── error.tsx                   # Error boundary
│   ├── loading.tsx                 # Route loading UI
│   ├── not-found.tsx               # 404 page
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Home page
├── components/                      # React components
│   ├── admin/                      # Admin-specific components
│   ├── features/                   # Feature components (Map, Payment, Review…)
│   └── layout/                     # Layout + route guards
├── context/                        # React context providers
│   └── AuthContext.tsx             # Authentication context
├── lib/                            # Utility libraries (grouped by concern)
│   ├── api/errors.ts               # ApiError + withApiHandler
│   ├── auth/index.ts               # JWT + password helpers
│   ├── cache/                      # redis.ts, rateLimit.ts
│   ├── config/                     # env.ts (validation), logger.ts
│   ├── db/prisma.ts                # Prisma client
│   └── integrations/               # stripe.ts, ai.ts
├── middleware/auth.ts              # Route-level withAuth/withRole guards
├── proxy.ts                        # Global headers/CORS/rate limiting (Next 16)
├── instrumentation.ts              # Edge-safe bootstrap entry point
└── instrumentation.node.ts         # Node startup validation + graceful shutdown
```

```
tests/
├── api/                            # Route-handler tests
├── e2e/                            # Full API journey tests
├── lib/                            # Unit tests for lib modules
├── proxy/                          # Global proxy (headers/CORS/rate limit) tests
└── utils/                          # Shared fixtures, helpers & Prisma fake
```


---

## User Roles

| Role       | Description      | Capabilities                                      |
| ---------- | ---------------- | ------------------------------------------------- |
| `customer` | Customer         | Browse services, create bookings, leave reviews   |
| `provider` | Service Provider | Manage services, handle bookings, track locations |
| `admin`    | Administrator    | Full system access, user/service management       |

---

## Data Model

The Prisma schema (`prisma/schema.prisma`) defines the following entities:

| Model           | Table             | Purpose                                                        |
| --------------- | ----------------- | -------------------------------------------------------------- |
| `User`          | `users`           | Accounts with role-based access (`customer` / `provider` / `admin`) |
| `Service`       | `services`        | Provided services (category, price, duration, tags, availability) |
| `Booking`       | `bookings`        | Service appointments with payment + status tracking            |
| `Review`        | `reviews`         | Post-completion ratings (one per booking)                      |
| `WebhookEvent`  | `webhook_events`  | Idempotency ledger for inbound payment webhooks (Stripe)       |

Supporting enums: `UserRole`, `BookingStatus` (`pending`, `confirmed`,
`in_progress`, `completed`, `cancelled`), and `PaymentStatus` (`pending`,
`paid`, `refunded`).

> **Idempotent webhooks.** The `WebhookEvent` model records every processed
> Stripe event by `type`. Re-delivered webhooks are detected and skipped, so
> payment state is applied exactly once.

---

## API Reference

### Authentication

| Endpoint             | Method  | Description        | Auth Required |
| -------------------- | ------- | ------------------ | ------------- |
| `/api/auth/login`    | POST    | User login         | No            |
| `/api/auth/register` | POST    | User registration  | No            |
| `/api/auth/profile`  | GET/PUT | Profile management | Yes           |

### Services

| Endpoint             | Method | Description                        | Auth Required  |
| -------------------- | ------ | ---------------------------------- | -------------- |
| `/api/services`      | GET    | List services (supports AI search) | No             |
| `/api/services`      | POST   | Create service                     | Provider/Admin |
| `/api/services/[id]` | GET    | Service details                    | No             |
| `/api/services/[id]` | PUT    | Update service                     | Owner/Admin    |
| `/api/services/[id]` | DELETE | Delete service                     | Owner/Admin    |
| `/api/services/[id]/reviews` | GET | Paginated service reviews    | No             |

### Bookings

| Endpoint                     | Method | Description                | Auth Required       |
| ---------------------------- | ------ | -------------------------- | ------------------- |
| `/api/bookings`              | GET    | List user bookings         | Yes                 |
| `/api/bookings`              | POST   | Create booking             | Yes                 |
| `/api/bookings/[id]`         | GET    | Booking details            | Yes                 |
| `/api/bookings/[id]`         | PUT    | Update booking             | Yes                 |
| `/api/bookings/[id]`         | DELETE | Cancel booking             | Yes                 |
| `/api/bookings/[id]/refund`  | POST   | Refund to customer         | Provider (owner)    |

### Payments

| Endpoint                              | Method | Description             | Auth Required |
| ------------------------------------- | ------ | ----------------------- | ------------- |
| `/api/payments/create-payment-intent` | POST   | Initialize payment      | Yes           |
| `/api/payments/confirm`               | POST   | Confirm payment         | Yes           |
| `/api/webhooks/stripe`                | POST   | Stripe webhook receiver | Signature     |

### Health & Operations

| Endpoint             | Method | Description                          |
| -------------------- | ------ | ------------------------------------ |
| `/api/health`        | GET    | Liveness / dependency status         |
| `/api/health/ready`  | GET    | Readiness probe (DB reachable)       |

### Admin

| Endpoint              | Method           | Description        | Auth Required |
| --------------------- | ---------------- | ------------------ | ------------- |
| `/api/admin/users`    | GET/PATCH/DELETE | User management    | Admin         |
| `/api/admin/services` | GET/PATCH/DELETE | Service management | Admin         |
| `/api/admin/bookings` | GET/PATCH/DELETE | Booking management | Admin         |
| `/api/admin/payments` | GET/POST/PUT/DELETE | Payment management | Admin         |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Stripe account
- OpenAI API key — **not required**; recommendations use a local on-device model

### Environment Variables

Configuration is read from a single `.env` file at the project root. It is
git-ignored, so create it locally (the defaults below are set up for local
PostgreSQL + Redis via `docker-compose.yml`):

```env
# Database (local PostgreSQL — matches docker-compose.yml)
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/home_service_discovery?schema=public"
DIRECT_URL="postgresql://postgres:mysecretpassword@localhost:5432/home_service_discovery?schema=public"

# Redis (local)
REDIS_URL="redis://localhost:6379"

# Authentication (>= 16 chars)
JWT_SECRET="your-super-secret-jwt-key"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Security / CORS (optional, sensible defaults applied)
ALLOWED_ORIGINS="http://localhost:3000"
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
AUTH_RATE_LIMIT_MAX=10

# AI model cache location (optional — defaults to ./.cache)
# The embedding model is downloaded on first use and cached here.
TRANSFORMERS_CACHE="./.cache"
```

### Environment variable reference

| Variable                             | Required            | Description                                            |
| ------------------------------------ | ------------------- | ------------------------------------------------------ |
| `DATABASE_URL` / `DIRECT_URL`        | Production only     | PostgreSQL connection strings                          |
| `REDIS_URL`                          | No (graceful fallback) | Redis location-cache / rate-limit store             |
| `JWT_SECRET`                         | Production only     | JWT signing secret (min. 16 chars)                    |
| `STRIPE_SECRET_KEY`                  | Production only     | Stripe server key (`sk_...`)                          |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Production only     | Stripe client key (`pk_...`)                          |
| `STRIPE_WEBHOOK_SECRET`              | Production only     | Webhook signature secret (`whsec_...`)                |
| `ALLOWED_ORIGINS`                    | No (default `*`)    | Comma-separated CORS origins                          |
| `RATE_LIMIT_MAX`                     | No (default `100`)  | Max requests per window                              |
| `RATE_LIMIT_WINDOW_MS`               | No (default 15 min) | Rate-limit window in ms                              |
| `AUTH_RATE_LIMIT_MAX`                | No (default `10`)   | Stricter limit for auth routes                       |
| `TRANSFORMERS_CACHE`                 | No (default `.cache`) | On-device model download cache directory          |

> In production, all variables marked "Production only" are validated on startup
> (`validateEnv` in `src/lib/config/env.ts`) and the process fails fast if any
> is missing.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd home-service-discovery

# Install dependencies (also runs `prisma generate`)
npm install

# Start local PostgreSQL + Redis
docker compose up -d db redis

# Sync the database schema
npx prisma db push

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

> **Database workflow.** The schema in `prisma/schema.prisma` is the single
> source of truth. Use `npm run db:push` (`prisma db push`) to apply changes
> directly from the schema. If a change is destructive, Prisma will warn before
> touching data. A baseline migration also lives in
> `prisma/migrations/`, generated via `prisma migrate dev`, but day-to-day
> schema changes are applied with `db push` in this workflow.

### Testing

```bash
# Run the full test suite (Jest)
npm test

# Watch mode (re-run on change)
npm run test:watch

# Coverage report
npm run test:coverage

# CI mode (single run, coverage, no watch)
npm run test:ci
```

Tests live in `tests/` and are grouped by concern:

- `tests/e2e/` — end-to-end API flow tests. These run the REAL route handlers,
  REAL auth (`withAuth`/`withRole`, JWT sign/verify, bcrypt) and the in-memory
  Prisma fake — no per-test mocks of auth/middleware/next-server. They walk full
  user journeys (register → login → book → review → admin) plus the guard
  negative paths (401/403/404).
- `tests/api/` — route-handler tests (auth, admin, services, bookings,
  recommendations, payments, health probes …) using the shared request/response
  helpers.
- `tests/proxy/` — unit tests for the global proxy (`src/proxy.ts`): security
  headers, request-id correlation, per-IP rate limiting (default, auth-stricter
  and env-configured limits), exempt routes, 429 handling and CORS pre-flight
  with an allow-list.
- `tests/lib/` — unit tests for library modules (auth, pagination, errors,
  rate limiter, validated env config, logger, format helpers).
- `tests/utils/test-utils.ts` — shared fixtures, request builders and response
  readers (`createRequest`, `createAuthedRequest`, `jsonOf`, `statusOf`).
- `tests/utils/prisma-fake.ts` — the deterministic in-memory Prisma fake
  installed globally by `jest.setup.js`, so route handlers exercise real
  filtering/pagination/aggregation against realistic seeded data.

The Jest harness (`jest.setup.js`) installs a hybrid `next/server` mock and the
in-memory Prisma fake globally, and clears the DB between tests.

Targeted runs are available for each layer:

```bash
npm run test:api          # API route handlers
npm run test:lib          # library modules
npm run test:proxy        # global proxy / middleware
npm run test:e2e          # full API journeys
```

### Continuous Integration

`.github/workflows/ci.yml` runs on every push to `main` and on all pull
requests. The suite is fully hermetic (in-memory Prisma fake, mocked Redis /
Stripe / AI), so CI needs no service containers. Each run executes:

1. `npm ci` (+ Prisma client generation)
2. `npm run lint`
3. `npm run test:ci` — single Jest run with coverage; the 70% global coverage
   gates configured in `jest.config.js` fail the build on regression.

The coverage report is uploaded as a CI artifact for inspection.

### Linting

```bash
npm run lint
```

> ESLint is run via the CLI in CI — Next.js 16 removed the built-in `next lint`
> command and the `eslint` config key from `next.config.ts`.

### Docker

A `Dockerfile` and `docker-compose.yml` are provided. Compose defines a `web`
service that builds the app and depends on `db` (PostgreSQL) and `redis`:

```bash
# Everything (app + db + redis)
docker compose up -d

# Or just the backing services while you run the app locally
docker compose up -d db redis
```

> Inside the container, database/Redis hosts are the Compose service names
> (`db`, `redis`), not `localhost` — see `docker-compose.yml`.

---

## Technology Stack

### Frontend Technologies

| Technology         | Purpose                         |
| ------------------ | ------------------------------- |
| Next.js 16         | React framework with App Router |
| React 19           | UI library                      |
| TypeScript 5       | Type safety                     |
| Tailwind CSS 4     | Utility-first styling           |
| React Context      | State management                |
| Leaflet / react-leaflet | Interactive maps             |
| Stripe Elements    | Payment UI components           |

### Backend Technologies

| Technology               | Purpose                        |
| ------------------------ | ------------------------------ |
| Next.js API Routes       | Backend API endpoints          |
| Prisma ORM               | Database ORM                   |
| PostgreSQL               | Primary database               |
| Redis (ioredis)          | Location caching & rate limits |
| JWT (jsonwebtoken)       | Token-based authentication     |
| bcryptjs                 | Password hashing               |
| Stripe                   | Payment processing             |
| Zod                      | Runtime config validation      |
| @huggingface/transformers | On-device semantic search     |

### DevOps & Tooling

| Technology | Purpose                        |
| ---------- | ------------------------------ |
| Docker     | Containerization               |
| Kubernetes | Orchestration (health probes)  |
| Jest       | Testing framework              |
| GitHub Actions | CI (lint, tests, coverage gates) |
| ESLint     | Linting                        |
| Supertest  | HTTP route-handler assertions  |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under JUST License.

---

<div align="center">
Built with ❤️ using Next.js, Prisma, and Stripe
</div>
