# PayFlow — Payment Processing Platform

A Stripe-style payment processing API and dashboard with JWT + API key authentication, idempotent payment intents, HMAC-signed webhooks, BullMQ retry queues, per-org RBAC, and AES-256 encrypted API key secrets.

## Project Overview

PayFlow is a Stripe-inspired payment processing platform that lets organizations:

- Create and confirm **payment intents** (supports INR paise, safe BigInt storage)
- Authenticate programmatically via **API keys** with granular permission scopes
- Receive payment events at their own endpoints via **HMAC-signed webhooks**
- Review every action via an immutable **audit log**
- Manage team members with **three-tier RBAC** (OWNER / ADMIN / VIEWER)

The platform is multi-tenant: each organization has its own isolated API keys, payment intents, and webhook endpoints. A user can belong to multiple organizations.

---

## Architecture

```
payflow/
├── apps/
│   ├── api/        ← NestJS 10 monolith on port 4000
│   └── web/        ← Next.js 15 operator dashboard on port 3000
├── packages/
│   ├── database/   ← Prisma 5 schema (8 models), migrations, seed
│   └── shared/     ← Zod schemas, TS types, validation helpers
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

### Service Ports

| Service                 | Port |
| ----------------------- | ---- |
| API (NestJS)            | 4000 |
| Web dashboard (Next.js) | 3000 |
| PostgreSQL              | 5432 |
| Redis (BullMQ)          | 6379 |

---

## Tech Stack

| Layer            | Technology                                                        |
| ---------------- | ----------------------------------------------------------------- |
| API              | NestJS 10, Passport JWT + API Key strategies, Helmet, compression |
| Webhook Queue    | BullMQ 5 (Redis-backed), exponential back-off retry, DLQ          |
| Database         | PostgreSQL 16, Prisma ORM 5                                       |
| Cache            | Redis 7 (BullMQ queues, rate-limit counters)                      |
| Payments         | Stripe Node SDK (test mode), BigInt paise storage                 |
| Validation       | Zod (shared), ZodValidationPipe in API                            |
| Security         | AES-256-GCM API key encryption, HMAC-SHA256 webhook signing       |
| Dashboard        | Next.js 15 App Router, TailwindCSS, TanStack Query v5, Zustand    |
| Monorepo         | Turborepo 2, pnpm 9 workspaces                                    |
| Containerisation | Docker 26, Docker Compose                                         |

---

## Database Schema

8 Prisma models:

### Enums

| Enum                  | Values                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Plan`                | STARTER, GROWTH, ENTERPRISE                                                                                                 |
| `MemberRole`          | OWNER, ADMIN, VIEWER                                                                                                        |
| `PaymentIntentStatus` | REQUIRES_PAYMENT_METHOD, REQUIRES_CONFIRMATION, REQUIRES_ACTION, PROCESSING, REQUIRES_CAPTURE, SUCCEEDED, CANCELLED, FAILED |
| `DeliveryStatus`      | PENDING, DELIVERED, FAILED, DEAD_LETTER                                                                                     |

### Models

| Model                | Key Fields                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `User`               | id, email, passwordHash, fullName, avatarUrl, emailVerified                                                                        |
| `Organization`       | id, name, slug (unique), plan, metadata (JSON)                                                                                     |
| `OrganizationMember` | id, orgId, userId, role — `@@unique([orgId, userId])`                                                                              |
| `ApiKey`             | id, orgId, name, keyHash (SHA-256), keyPrefix (first 8 chars), permissions[], rateLimit, expiresAt, revokedAt                      |
| `PaymentIntent`      | id, orgId, idempotencyKey, amountPaise (BigInt), currency, status, stripeId, metadata (JSON) — `@@unique([orgId, idempotencyKey])` |
| `WebhookEndpoint`    | id, orgId, url, secret (HMAC key), events[], isActive                                                                              |
| `WebhookDelivery`    | id, endpointId, paymentIntentId, event, payload (JSON), status, attempt, nextRetryAt                                               |
| `AuditLog`           | id, orgId, userId, action, resourceType, resourceId, metadata (JSON), ipAddress                                                    |

---

## Authentication & Authorization

PayFlow supports two authentication methods on every protected route:

### JWT Bearer Token

- Obtained via `POST /api/v1/auth/login`
- `Authorization: Bearer <token>`
- Contains `userId`, `orgId`, `role`, `email`
- Default expiry: 7 days (configurable via `JWT_EXPIRES_IN`)

### API Key

- Created via the dashboard (OWNER or ADMIN only)
- `X-API-Key: pf_live_<random>` header
- Stored as **SHA-256 hash** in the database — the plaintext is shown only once at creation
- Each key has a `permissions` array: `["payments:read", "payments:write", "webhooks:read", "webhooks:write"]`
- Rate-limited per key (default: 1000 requests per minute, tracked in Redis)

### RBAC

| Role   | Can create/delete API keys | Can manage webhook endpoints | Can view audit log | Can manage members |
| ------ | :------------------------: | :--------------------------: | :----------------: | :----------------: |
| OWNER  |             ✅             |              ✅              |         ✅         |         ✅         |
| ADMIN  |             ✅             |              ✅              |         ✅         |         ❌         |
| VIEWER |             ❌             |              ❌              |         ✅         |         ❌         |

### Guard Chain

```
JwtOrApiKeyGuard   →  validates token OR API key, sets req.user
ApiKeyGuard        →  checks permission scopes on API-key-authenticated requests
RolesGuard         →  enforces minimum role requirement from @Roles() decorator
```

---

## Idempotency

Creating a payment intent requires an `Idempotency-Key` header (UUID format).

- The key is **scoped per organization**: `@@unique([orgId, idempotencyKey])` in the DB
- If a request arrives with the same key and same body, the original response is returned immediately
- If the key matches but the body differs, a `409 Conflict` is returned
- Keys are validated with a strict UUID regex before any DB lookup

```http
POST /api/v1/payments
Authorization: Bearer <token>
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "amountPaise": 49900,
  "currency": "INR",
  "description": "Pro plan subscription"
}
```

---

## Webhook System

When a payment changes status, PayFlow delivers a signed HTTP POST to all active endpoints registered for that event type.

### Delivery Flow

```
Payment status changes
        │
        ▼
WebhooksService.dispatchEvent()
        │
        ▼
BullMQ queue: "webhook-deliveries"
        │
        ▼
WebhookWorker processes job:
  1. Build payload: { id, event, createdAt, data }
  2. Sign with HMAC-SHA256: X-PayFlow-Signature: sha256=<hex>
  3. POST to endpoint URL (5s timeout)
  4. On success → DeliveryStatus.DELIVERED
  5. On failure → schedule retry with exponential back-off
        │
        ▼ (after max retries)
  DeliveryStatus.DEAD_LETTER
```

### Retry Schedule

| Attempt | Delay    |
| ------- | -------- |
| 1st     | 30 s     |
| 2nd     | 2 min    |
| 3rd     | 10 min   |
| 4th     | 1 hour   |
| 5th     | 24 hours |

### Signature Verification (consumer side)

```ts
import crypto from "crypto";

function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Webhook Events

| Event                            | Triggered when                    |
| -------------------------------- | --------------------------------- |
| `payment_intent.created`         | A new payment intent is created   |
| `payment_intent.succeeded`       | Payment confirmed and captured    |
| `payment_intent.failed`          | Payment processing failed         |
| `payment_intent.cancelled`       | Payment intent cancelled          |
| `payment_intent.requires_action` | 3DS or additional action required |

---

## API Reference

Base URL: `http://localhost:4000/api`
Swagger UI: `http://localhost:4000/api/docs`

### Authentication

| Method | Path                | Auth   | Description                           |
| ------ | ------------------- | ------ | ------------------------------------- |
| POST   | `/v1/auth/register` | Public | Register user + create organization   |
| POST   | `/v1/auth/login`    | Public | Login → `{ access_token, user, org }` |

### Organizations

| Method | Path                               | Auth        | Description                     |
| ------ | ---------------------------------- | ----------- | ------------------------------- |
| GET    | `/v1/organizations/me`             | JWT         | Get current user's organization |
| PATCH  | `/v1/organizations/me`             | JWT (OWNER) | Update organization name/plan   |
| GET    | `/v1/organizations/me/members`     | JWT         | List organization members       |
| POST   | `/v1/organizations/me/members`     | JWT (OWNER) | Invite a member by email        |
| PATCH  | `/v1/organizations/me/members/:id` | JWT (OWNER) | Update member role              |
| DELETE | `/v1/organizations/me/members/:id` | JWT (OWNER) | Remove a member                 |

### Payments

| Method | Path                       | Auth          | Description                              |
| ------ | -------------------------- | ------------- | ---------------------------------------- |
| POST   | `/v1/payments`             | JWT / API Key | Create payment intent (idempotent)       |
| GET    | `/v1/payments`             | JWT / API Key | List payment intents (paginated, filter) |
| GET    | `/v1/payments/:id`         | JWT / API Key | Get payment intent detail                |
| POST   | `/v1/payments/:id/confirm` | JWT / API Key | Confirm a payment intent                 |
| POST   | `/v1/payments/:id/capture` | JWT / API Key | Capture an authorized payment            |
| POST   | `/v1/payments/:id/cancel`  | JWT / API Key | Cancel a payment intent                  |

**List filter query params:** `status`, `from` (ISO date), `to` (ISO date), `page`, `pageSize` (max 100)

### API Keys

| Method | Path               | Auth         | Description                         |
| ------ | ------------------ | ------------ | ----------------------------------- |
| POST   | `/v1/api-keys`     | JWT (ADMIN+) | Create API key — secret shown once  |
| GET    | `/v1/api-keys`     | JWT          | List API keys (no secrets returned) |
| DELETE | `/v1/api-keys/:id` | JWT (ADMIN+) | Revoke an API key                   |

### Webhooks

| Method | Path                                | Auth          | Description                      |
| ------ | ----------------------------------- | ------------- | -------------------------------- |
| POST   | `/v1/webhooks/endpoints`            | JWT / API Key | Create webhook endpoint          |
| GET    | `/v1/webhooks/endpoints`            | JWT / API Key | List webhook endpoints           |
| GET    | `/v1/webhooks/endpoints/:id`        | JWT / API Key | Get endpoint details             |
| PATCH  | `/v1/webhooks/endpoints/:id`        | JWT / API Key | Update endpoint URL / events     |
| DELETE | `/v1/webhooks/endpoints/:id`        | JWT / API Key | Delete endpoint                  |
| GET    | `/v1/webhooks/deliveries`           | JWT / API Key | List delivery attempts           |
| POST   | `/v1/webhooks/deliveries/:id/retry` | JWT / API Key | Manually retry a failed delivery |

### Audit Log

| Method | Path        | Auth | Description                                                    |
| ------ | ----------- | ---- | -------------------------------------------------------------- |
| GET    | `/v1/audit` | JWT  | Paginated audit log (filter: action, resourceType, resourceId) |

**Query params:** `resourceType`, `resourceId`, `action`, `page`, `pageSize` (max 100)

### Health

| Method | Path      | Auth   | Description                   |
| ------ | --------- | ------ | ----------------------------- |
| GET    | `/health` | Public | `{ status: "ok", timestamp }` |

---

## Dashboard (Frontend)

Built with **Next.js 15 App Router**, TailwindCSS, TanStack Query v5, Zustand.

### Routes

| Route            | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `/auth/login`    | Login form                                                        |
| `/auth/register` | Registration form — creates user + organization                   |
| `/dashboard`     | Overview — total volume, successful payments, failed, active keys |
| `/payments`      | Payment intent list with status badges + filters                  |
| `/payments/[id]` | Payment detail — timeline, metadata, webhook deliveries           |
| `/api-keys`      | API key management — create, view prefix, revoke                  |
| `/webhooks`      | Webhook endpoint management + delivery history                    |
| `/webhooks/[id]` | Endpoint detail — delivery log with retry button                  |
| `/settings`      | Organization settings + member management (invite/role/remove)    |
| `/audit-log`     | Full immutable audit trail with filters                           |

### Dashboard Metrics (Overview Page)

- Total payment volume (last 30 days)
- Success rate %
- Active API keys count
- Webhook delivery success rate
- Recent payment intent list
- Volume chart (daily breakdown)

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
# Database
DATABASE_URL=postgresql://payflow:payflow_dev@localhost:5432/payflow_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRES_IN=7d

# API URLs
API_PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Webhook delivery signing
WEBHOOK_SIGNING_SECRET=change-me-webhook-signing-secret
WEBHOOK_MAX_RETRIES=5
WEBHOOK_RETRY_DELAYS=[30,120,600,3600,86400]

# Rate limiting
RATE_LIMIT_DEFAULT_RPM=1000
RATE_LIMIT_WINDOW_SECONDS=60

# AES-256 encryption key for API key secrets
ENCRYPTION_KEY=change-me-32-char-encryption-key!!

# Next.js public
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=change-me-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## Quick Start

### Prerequisites

- **Docker & Docker Compose** v2+
- **Node.js** 20+ and **pnpm** 9+

### Step 1 — Start infrastructure

```bash
docker compose up postgres redis -d
docker compose ps   # wait for "healthy" status
```

### Step 2 — Install dependencies

```bash
pnpm install
```

### Step 3 — Run migrations and seed

```bash
pnpm --filter @payflow/database db:migrate
pnpm --filter @payflow/database db:seed
```

The seed creates:

- Organization: "Acme Corp"
- Owner account: `owner@acme.com` / `password123`
- Admin account: `admin@acme.com` / `password123`
- Viewer account: `viewer@acme.com` / `password123`
- One test API key (shown in terminal output)
- One webhook endpoint pointing to `https://webhook.site/<uuid>`
- 20 sample payment intents in various states

### Step 4 — Start all services

```bash
pnpm dev
```

- API: http://localhost:4000
- Swagger UI: http://localhost:4000/api/docs
- Dashboard: http://localhost:3000

---

## Full Docker Deployment

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY, STRIPE_SECRET_KEY, WEBHOOK_SIGNING_SECRET

# 2. Build and start everything
docker compose up -d --build

# 3. Run migrations
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

---

## Key Design Decisions

### Money as BigInt paise

`amountPaise` is stored as `BigInt` — never `Float` or `Decimal`. This eliminates all floating-point rounding errors. `₹499.00 = 49900 paise`. The Prisma `BigInt` maps to JS `BigInt`; all serialization to JSON uses `.toString()`.

### API Key security

- The plaintext key `pf_live_<48-char-random>` is shown **once** at creation and never stored
- Stored value: `SHA-256(plaintext)` — no way to recover the key from the database
- `keyPrefix` (first 8 chars) is stored for display in the UI
- Keys are encrypted at rest using **AES-256-GCM** via the `ENCRYPTION_KEY` env var

### Idempotency scoped per org

The unique constraint `@@unique([orgId, idempotencyKey])` means two different organizations can use the same idempotency key without conflict. The key is validated as a UUID before any database operation.

### HMAC-signed webhooks

Outbound webhooks include `X-PayFlow-Signature: sha256=<hex>` computed from `HMAC-SHA256(rawBody, endpointSecret)`. Consumers can verify authenticity without shared-secret databases. The signing secret is generated at endpoint creation and shown once.

### BullMQ for reliable delivery

Webhook jobs are persisted in Redis. If the API process crashes mid-delivery, the job remains in the queue and is retried on restart. The exponential back-off schedule (30s → 2m → 10m → 1h → 24h) mirrors Stripe's delivery behaviour. After all retries, the delivery moves to `DEAD_LETTER` status.

### Audit log immutability

`AuditLog` records are insert-only — no UPDATE or DELETE operations are allowed on the table. Every state-changing action (create payment, revoke key, change role, etc.) inserts a new record with the actor's userId, orgId, IP address, and full metadata diff.

### Rate limiting per API key (Redis sliding window)

Each API key is assigned a `rateLimit` value (default: 1000 requests/minute). On every request authenticated via API key, the following sliding-window check runs in Redis:

```
ZADD  payflow:rl:{keyId}  {now_ms}  {now_ms}
ZREMRANGEBYSCORE  payflow:rl:{keyId}  0  {now_ms - 60000}
ZCARD  payflow:rl:{keyId}
EXPIRE payflow:rl:{keyId}  61
```

If `ZCARD` exceeds the key's `rateLimit`, the request is rejected with `429 Too Many Requests`. The sliding window (as opposed to fixed-window) prevents the "double burst at window boundary" problem — at any point in time the count reflects exactly the last 60 seconds of traffic.

### ZodValidationPipe

Rather than NestJS's built-in `class-validator` ValidationPipe, PayFlow uses a custom `ZodValidationPipe` that accepts a Zod schema. This keeps validation logic co-located with the shared DTO types in `packages/shared` and provides richer, more composable validation.

---

## Project Structure

```
payflow/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── auth/           ← JWT + API Key strategies, register/login
│   │       │   ├── guards/     ← JwtAuthGuard, ApiKeyGuard, JwtOrApiKeyGuard, RolesGuard
│   │       │   └── decorators/ ← @CurrentUser(), @Roles(), @RequirePermissions()
│   │       ├── organizations/  ← Org CRUD + member management
│   │       ├── payments/       ← Payment intent lifecycle + Stripe integration
│   │       ├── api-keys/       ← Key creation, hashing, rate-limit tracking
│   │       ├── webhooks/       ← Endpoint management + BullMQ delivery worker
│   │       ├── audit/          ← Append-only audit log
│   │       ├── stripe/         ← Stripe SDK wrapper module
│   │       ├── redis/          ← ioredis global module
│   │       ├── database/       ← PrismaClient global module
│   │       ├── common/
│   │       │   └── pipes/      ← ZodValidationPipe
│   │       ├── config/         ← @nestjs/config typed config
│   │       ├── health/         ← GET /health
│   │       ├── app.module.ts
│   │       └── main.ts         ← Helmet, CORS, Swagger, global prefix /api
│   └── web/
│       └── app/
│           ├── (auth)/         ← /auth/login, /auth/register
│           └── (dashboard)/    ← /dashboard, /payments, /api-keys, /webhooks,
│                                  /settings, /audit-log
├── packages/
│   ├── database/
│   │   └── prisma/
│   │       ├── schema.prisma   ← 8 models
│   │       └── seed.ts
│   └── shared/
│       └── src/
│           ├── schemas/        ← Zod schemas for every DTO
│           ├── types/          ← TypeScript interfaces
│           └── index.ts
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## 📝 License

Proprietary - All rights reserved.
