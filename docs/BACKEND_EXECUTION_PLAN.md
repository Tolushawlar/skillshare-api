# Backend Execution Plan

## Skilled Labour Marketplace (MVP to Scale)

**Version:** 1.0
**Date:** November 2026
**Owner:** Backend Engineering
**Status:** Draft for review
**Working name:** `[PLATFORM NAME]` (replace before build)

---

## 1. Purpose and How to Use This Document

This document is the backend execution playbook for a two-sided marketplace that connects verified skilled-labour workers (mechanics, electricians, plumbers, carpenters, painters, AC technicians, tailors, and similar trades) with clients who need their services, based on live location.

It is written to be executed, not just read. Every section maps to work that can be estimated, assigned, built, tested, and shipped.

**How to use it:**

1. Read Sections 1 to 5 to align the team on scope, stack, and architecture.
2. Use Section 7 (database) and Section 8 (API) as the contract between backend and frontend.
3. Use Section 10 (core workflows) as the source of truth for business logic.
4. Use Section 15 (roadmap) to plan sprints and track delivery.
5. Use Section 18 (definition of done) and Section 19 (launch checklist) as release gates.
6. Record every decision change in the "Decision Log" at the end of the document.

**Status legend used in this document:**

- `[MVP]` must ship in the first public release
- `[MVP+]` should ship if schedule allows
- `[POST-MVP]` explicitly deferred
- `[DECISION]` requires product or business sign-off

---

## 2. Product Scope Recap

### 2.1 The Problem

- Skilled workers depend on word of mouth and repeat customers. They lack visibility and cannot reliably acquire new clients.
- Clients, especially in unfamiliar areas, cannot quickly find trustworthy workers. Trust is the bottleneck.
- There is no central, location-aware directory of vetted workers with bookable availability.

### 2.2 The Solution

A web platform where:

- Workers create verified profiles with trades, pricing, portfolio, service area, and availability.
- Clients discover workers near their live location on a map, compare profiles, and book in a few clicks.
- The platform handles verification, booking lifecycle, real-time tracking, messaging, payments, reviews, disputes, and administration.

### 2.3 User Roles

| Role    | Description                                                  | Interface           |
| ------- | ------------------------------------------------------------ | ------------------- |
| Client  | Books services                                               | Client dashboard    |
| Worker  | Delivers services                                            | Worker dashboard    |
| Admin   | Verifies workers, manages users, disputes, payments, reports | Admin web dashboard |
| Support | Limited admin access: disputes, read-only user data          | Admin web dashboard |
| Finance | Payments, payouts, reconciliation, refunds                   | Admin web dashboard |

### 2.4 MVP Boundaries

**In scope `[MVP]`:**

- Phone OTP and Google authentication, role selection, session management
- Client onboarding: profile, saved addresses, location permission fallback
- Worker onboarding: profile, trades, services/pricing, service area, verification documents
- Manual admin verification workflow with document review
- Location-based worker discovery with map and filters
- Worker public profiles with reviews and portfolio
- Booking creation, acceptance, scheduled and ASAP flows
- Booking lifecycle state machine and status timeline
- Live worker tracking during an active job
- Client-worker messaging
- Notifications: in-app, web push, and critical SMS
- Payments: card and bank transfer through a Nigerian PSP, plus controlled cash flow
- Reviews and ratings after completion
- Admin dashboard: verification queue, users, bookings, disputes, basic reports
- Security, audit logging, observability, backups

**Explicitly out of scope for MVP `[POST-MVP]`:**

- Native mobile apps
- Multi-country expansion, multi-currency, localization beyond English
- Worker teams/agencies and multi-worker jobs
- Bidding marketplace with open broadcast jobs (MVP is direct booking)
- In-app wallet with stored value
- Subscription plans and promoted listings
- AI-based matching, pricing, or fraud detection
- Advanced analytics warehouse and BI tooling
- Automated background checks beyond identity + liveness + document review

### 2.5 Core Product Assumptions `[DECISION]`

These must be confirmed before Phase 1. Defaults are proposed.

| Assumption                 | Proposed default                                                                                    | Impact if changed                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Launch city                | Ibadan (then Lagos)                                                                                 | Seed data, geo tuning, supply acquisition |
| Primary auth               | Phone OTP, Google optional                                                                          | SMS cost, onboarding flow                 |
| Payment model              | Client pays via card/transfer into platform; platform pays worker after completion minus commission | Escrow, ledger, compliance                |
| Commission rate            | 12% of job value                                                                                    | Pricing, payouts, invoicing               |
| Cash jobs                  | Allowed, tracked, commission invoiced or deducted from next payout                                  | Reconciliation complexity                 |
| Verification provider      | Dojah or Smile Identity (NIN + liveness)                                                            | Cost, SLA, integration                    |
| Maps provider              | Google Maps Platform (Maps JS, Places, Routes)                                                      | Cost, quotas, ETA accuracy                |
| Booking model              | Direct targeted booking only                                                                        | Discovery/matching complexity             |
| Worker availability        | Online/offline toggle plus weekly schedule                                                          | Search ranking, notifications             |
| Dispute window             | 24 hours after completion before payout release                                                     | Payout timing                             |
| Supported trades at launch | Mechanic, electrician, plumber, carpenter, painter, AC technician                                   | Category seed data                        |
| Language                   | English (Nigerian context)                                                                          | i18n architecture                         |
| Age policy                 | 18+                                                                                                 | KYC and consent                           |

---

## 3. Recommended Tech Stack

The recommendation optimises for speed to MVP, one language across services, strong geospatial support, and a clear path to scale.

### 3.1 Core Stack

| Layer                   | Choice                                                                                        | Rationale                                                                      | Alternatives                                  |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| Language                | TypeScript 5.x on Node.js 20 LTS                                                              | Shared types with frontend, huge ecosystem, strong async I/O                   | Python/Django + GeoDjango                     |
| Framework               | NestJS 10+                                                                                    | Modular architecture, dependency injection, guards, OpenAPI, WebSocket support | Fastify + custom structure, Express           |
| Database                | PostgreSQL 16 + PostGIS 3.4                                                                   | Acid transactions, mature geospatial queries, exclusion constraints            | MySQL (weak geo), MongoDB (weak transactions) |
| ORM                     | Prisma 5 with raw SQL for geospatial queries                                                  | Type safety, migrations, fast iteration                                        | Drizzle, TypeORM, Kysely                      |
| Cache / presence        | Redis 7                                                                                       | Caching, rate limits, Socket.IO adapter, queues, live presence                 | Memcached (no queues/presence)                |
| Queue                   | BullMQ on Redis                                                                               | Delayed jobs, retries, backoff, concurrency control                            | SQS, RabbitMQ                                 |
| Realtime                | Socket.IO with Redis adapter                                                                  | Rooms, reconnection, fallbacks, horizontal scaling                             | Raw WebSocket, SSE                            |
| Object storage          | S3-compatible (AWS S3 or Cloudflare R2)                                                       | Presigned uploads, lifecycle rules, CDN integration                            | GCS, Azure Blob                               |
| Maps                    | Google Maps Platform: Maps JavaScript, Places Autocomplete, Routes/Distance Matrix, Geocoding | Best Nigerian coverage and ETA quality                                         | Mapbox, HERE                                  |
| Payments                | Paystack (primary), Flutterwave (fallback)                                                    | Nigerian cards, transfers, payouts, marketplace support                        | Monnify, Squad                                |
| SMS                     | Termii (primary), Africa's Talking/Twilio fallback                                            | Nigerian delivery and sender IDs                                               | Twilio only                                   |
| Email                   | Resend or AWS SES                                                                             | Transactional receipts, notifications                                          | Postmark                                      |
| Push                    | FCM Web Push + service worker                                                                 | Browser push across Chrome, Edge, Firefox                                      | OneSignal                                     |
| Verification/KYC        | Dojah or Smile Identity                                                                       | NIN, BVN, liveness, document OCR, Nigerian coverage                            | Prembly, VerifyMe                             |
| Error tracking          | Sentry                                                                                        | Releases, stack traces, alerting                                               | Bugsnag                                       |
| Observability           | OpenTelemetry + Grafana Cloud (or CloudWatch)                                                 | Traces, metrics, logs correlation                                              | Datadog                                       |
| Containerisation        | Docker + Docker Compose locally                                                               | Reproducible dev and deploy                                                    | Podman                                        |
| CI/CD                   | GitHub Actions                                                                                | Native to repo, matrix builds, environments                                    | GitLab CI                                     |
| Hosting (MVP fast path) | Render/Railway/Fly.io + managed Postgres (Neon/RDS) + Upstash Redis                           | Low ops burden, fast launch                                                    | AWS ECS from day one                          |
| Hosting (scale path)    | AWS ECS Fargate + RDS PostgreSQL + ElastiCache + S3 + CloudFront + WAF                        | Managed, autoscaling, mature security controls                                 | GCP, Azure                                    |

### 3.2 Why Not X

- **Django/GeoDjango:** excellent geospatial support, but splits language and type sharing with a TypeScript frontend. Valid choice if the team is Python-first.
- **Firebase/Supabase-only:** fast for prototypes, but booking concurrency, ledger invariants, and complex authorization need a real relational backend. Use managed Postgres, not BaaS-only.
- **MongoDB:** weaker for financial ledgers, exclusion constraints, and relational integrity.
- **Microservices from day one:** premature. Build a modular monolith, extract services only when load or team size demands it.

### 3.3 Non-Negotiable Engineering Choices

- Money is stored as integer minor units (kobo), never floating point.
- All timestamps stored in UTC (`timestamptz`), rendered in the client's timezone.
- Every state transition is recorded as an event with actor and reason.
- Financial operations are idempotent and double-entry accounted.
- Coordinates use `geography(Point, 4326)` and PostGIS indexes.
- All external webhooks are signature-verified, persisted, and processed asynchronously.
- Authorization is enforced server-side for every route, not hidden in the UI.

---

## 4. High-Level Architecture

```mermaid
flowchart TB
  subgraph Clients
    WEB[Client Web App]
    WK[Worker Web App]
    ADM[Admin Web App]
  end

  subgraph Edge
    CDN[CloudFront / CDN]
    WAF[WAF + Rate Limiting]
    LB[Load Balancer]
  end

  subgraph API["NestJS API (stateless, horizontally scaled)"]
    AUTH[Auth and RBAC]
    DISC[Discovery and Matching]
    BOOK[Bookings and Lifecycle]
    TRACK[Tracking and Realtime]
    CHAT[Messaging]
    PAY[Payments and Ledger]
    VERIFY[Verification]
    NOTIF[Notifications]
    ADMIN[Admin and Disputes]
  end

  subgraph Data
    PG[(PostgreSQL + PostGIS)]
    REDIS[(Redis: cache, presence, queues, sockets)]
    S3[(Object Storage)]
    OUTBOX[(Outbox / BullMQ)]
  end

  subgraph Providers
    MAPS[Google Maps Platform]
    PSP[Paystack]
    KYC[Dojah / Smile Identity]
    SMS[Termii]
    PUSH[FCM]
    EMAIL[Resend]
  end

  WEB --> CDN --> WAF --> LB --> API
  WK --> CDN
  ADM --> WAF
  API --> PG
  API --> REDIS
  API --> S3
  API --> OUTBOX
  API --> MAPS
  API --> PSP
  API --> KYC
  API --> SMS
  API --> PUSH
  API --> EMAIL
  PSP -->|webhooks| API
  KYC -->|callbacks| API
```

### 4.1 Architectural Principles

- **Modular monolith:** one deployable API divided into bounded modules with explicit contracts. No cross-module database access; communicate through services and domain events.
- **Stateless API:** session state in JWT/Redis; any instance can serve any request; Socket.IO uses the Redis adapter.
- **Async by default for side effects:** notifications, ETA calculation, document processing, payouts, and webhook handling run through BullMQ.
- **Transactional outbox:** domain events are written in the same transaction as state changes, then published reliably by a worker.
- **Read/write separation by need only:** add read replicas when query load requires it, not pre-emptively.
- **Fail closed on money and identity:** if ledger or verification state is ambiguous, block the action and alert.

### 4.2 Core Modules

| Module            | Responsibility                                                          |
| ----------------- | ----------------------------------------------------------------------- |
| `auth`          | OTP, Google OAuth, tokens, sessions, RBAC, MFA                          |
| `users`         | User records, profiles, addresses, settings, devices                    |
| `workers`       | Worker profile, trades, services, portfolio, availability, service area |
| `verification`  | Submissions, documents, admin review, status transitions                |
| `discovery`     | Nearby search, filters, ranking, ETA, map pins                          |
| `bookings`      | Booking creation, offers, lifecycle, schedule, invoices                 |
| `tracking`      | Live location ingestion, presence, broadcast, breadcrumbs               |
| `messaging`     | Conversations, messages, attachments, read receipts                     |
| `payments`      | Payment intents, webhooks, refunds, payouts, ledger, reconciliation     |
| `reviews`       | Ratings, tags, moderation, aggregate recalculation                      |
| `notifications` | Templates, preferences, fan-out, push/SMS/email                         |
| `disputes`      | Dispute intake, evidence, resolution, audit                             |
| `admin`         | Queues, user management, reports, settings                              |
| `media`         | Presigned uploads, validation, scanning, signed URLs                    |
| `geo`           | PostGIS query helpers, geohashing, distance, geocoding proxy            |
| `common`        | Errors, guards, interceptors, pagination, idempotency, outbox           |

---

## 5. Environments and Infrastructure

### 5.1 Environments

| Environment | Purpose                 | Data                                              | Access                   |
| ----------- | ----------------------- | ------------------------------------------------- | ------------------------ |
| Local       | Development             | Seeded synthetic data                             | Every engineer           |
| CI          | Automated tests         | Ephemeral containers                              | GitHub Actions           |
| Staging     | Integration, UAT, demos | Anonymised or synthetic, never raw production PII | Engineering, QA, product |
| Production  | Live                    | Real                                              | Restricted, audited, MFA |

Production and staging must use separate cloud accounts or at minimum separate VPCs, databases, buckets, PSP keys, KYC keys, and SMS sender credentials.

### 5.2 Local Development Stack

`docker compose up` should provide:

- PostgreSQL 16 with PostGIS
- Redis 7
- MinIO (S3-compatible) for media
- MailHog or Mailpit for email
- Mock server or PSP sandbox for Paystack and KYC
- API with hot reload
- Optional: pgAdmin, RedisInsight

### 5.3 Infrastructure as Code

- Provision cloud resources with Terraform (or Pulumi). No console-only infrastructure.
- Store Terraform state remotely with locking.
- Separate workspaces/stacks per environment.
- Document every resource in `infra/README.md`.

### 5.4 Domains and TLS

- `app.[domain]` for the web app
- `api.[domain]` for the API
- `admin.[domain]` for the admin app
- `cdn.[domain]` for media
- TLS everywhere, HSTS enabled, HTTP redirected to HTTPS.

### 5.5 Backups and Recovery

| Asset          | Strategy                                           | Target                 |
| -------------- | -------------------------------------------------- | ---------------------- |
| PostgreSQL     | Automated daily snapshots + point-in-time recovery | RPO 15 min, RTO 1 hour |
| Object storage | Versioning + cross-region replication (post-MVP)   | RPO 24 hours           |
| Redis          | Persistence for queues; treat cache as ephemeral   | Rebuildable            |
| Secrets        | Managed secret store with versioning               | No loss                |
| Infrastructure | Terraform state backed up                          | Rebuildable            |

Run a restore drill before launch and quarterly thereafter. A backup that has never been restored is not a backup.

---

## 6. Repository and Module Structure



### 6.1 Repository Layout

```
skilled-labour-platform/
├── apps/
│   ├── api/                  # NestJS backend
│   ├── web/                  # Client/worker web app (separate team)
│   └── admin/                # Admin web app (separate team)
├── packages/
│   ├── shared-types/         # DTOs, enums, API contracts
│   └── api-client/           # Generated OpenAPI client
├── infra/
│   ├── terraform/
│   └── docker/
├── docs/
│   ├── BACKEND_EXECUTION_PLAN.md
│   ├── api/
│   └── runbooks/
├── scripts/
├── .github/workflows/
└── README.md
```

If frontend teams live in separate repos, keep `packages/shared-types` and the OpenAPI spec in the backend repo and publish them as versioned packages.

### 6.2 API Source Layout

```
apps/api/src/
├── main.ts
├── app.module.ts
├── config/                  # Typed env config, validation
├── common/
│   ├── decorators/
│   ├── filters/             # RFC 9457 problem responses
│   ├── guards/              # JWT, roles, permissions
│   ├── interceptors/        # Logging, request id, idempotency
│   ├── pipes/
│   └── utils/
├── database/
│   ├── prisma/
│   ├── migrations/
│   ├── seeds/
│   └── factories/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── workers/
│   ├── verification/
│   ├── discovery/
│   ├── bookings/
│   ├── tracking/
│   ├── messaging/
│   ├── payments/
│   ├── reviews/
│   ├── notifications/
│   ├── disputes/
│   ├── admin/
│   ├── media/
│   └── geo/
└── jobs/                    # BullMQ processors and schedulers
```

Each module contains controllers, services, repositories, DTOs, domain events, and tests. A module may import another module's public service only, never its repository.

### 6.3 Branching and Review

- Trunk-based development. Short-lived branches, max 2 days.
- Pull requests require one approval, green CI, and no unresolved security findings.
- Database migrations are reviewed by a second backend engineer.
- Feature flags gate incomplete features on `main`.

---

## 7. Domain Model and Database Design

### 7.1 Conventions

- Primary keys: UUID v7 (time-sortable) generated by the application.
- Foreign keys enforced at the database level.
- Soft delete only where required (`users.deleted_at`); bookings and payments are never hard-deleted.
- Money: `bigint` kobo, with explicit `currency` where relevant.
- Enums: PostgreSQL enums for stable states; lookup tables for business-managed categories.
- JSONB only for variable metadata, never for core relational fields.
- Every table has `created_at timestamptz not null default now()` and `updated_at timestamptz`.
- `citext` for emails where supported, otherwise lowercase on write.
- Phone numbers stored in E.164 (`+234...`).

### 7.2 Entity Relationship Overview

```mermaid
erDiagram
  USERS ||--o| CLIENT_PROFILES : has
  USERS ||--o| WORKER_PROFILES : has
  USERS ||--o{ ADDRESSES : owns
  USERS ||--o{ REFRESH_TOKENS : has
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ DEVICE_TOKENS : registers

  WORKER_PROFILES ||--o{ WORKER_TRADES : offers
  TRADES ||--o{ WORKER_TRADES : classified
  WORKER_PROFILES ||--o{ SERVICES : prices
  WORKER_PROFILES ||--o{ PORTFOLIO_ITEMS : showcases
  WORKER_PROFILES ||--o{ VERIFICATION_SUBMISSIONS : submits
  VERIFICATION_SUBMISSIONS ||--o{ VERIFICATION_DOCUMENTS : contains

  CLIENTS_USERS ||--o{ BOOKINGS : creates
  WORKER_PROFILES ||--o{ BOOKINGS : fulfils
  BOOKINGS ||--o{ BOOKING_STATUS_EVENTS : logs
  BOOKINGS ||--o{ BOOKING_MEDIA : attaches
  BOOKINGS ||--o{ TRACKING_POINTS : records
  BOOKINGS ||--o| REVIEWS : reviewed_by
  BOOKINGS ||--o| INVOICES : bills
  BOOKINGS ||--o{ PAYMENTS : paid_by
  BOOKINGS ||--o{ DISPUTES : disputed_in

  CONVERSATIONS ||--o{ MESSAGES : contains
  USERS ||--o{ CONVERSATIONS : participates
  PAYMENTS ||--o{ REFUNDS : refunded
  WORKER_PROFILES ||--o{ PAYOUTS : receives
  PAYOUTS ||--o| BANK_ACCOUNTS : to
```

Note: `CLIENTS_USERS` above represents the client side of `USERS`; in the schema, `bookings.client_id` references `users.id`.

### 7.3 Identity and Access Tables

#### `users`

| Column                         | Type                   | Notes                                                       |
| ------------------------------ | ---------------------- | ----------------------------------------------------------- |
| `id`                         | uuid pk                | UUID v7                                                     |
| `role`                       | enum                   | `client`, `worker`, `admin`, `support`, `finance` |
| `full_name`                  | text                   | Required after onboarding                                   |
| `phone_e164`                 | text unique            | Primary identifier, verified                                |
| `email`                      | citext unique nullable | Optional                                                    |
| `password_hash`              | text nullable          | Only if email/password enabled                              |
| `google_sub`                 | text unique nullable   | Google OAuth subject                                        |
| `avatar_media_id`            | uuid nullable          | FK media                                                    |
| `status`                     | enum                   | `active`, `suspended`, `deleted`                      |
| `phone_verified_at`          | timestamptz nullable   |                                                             |
| `email_verified_at`          | timestamptz nullable   |                                                             |
| `last_login_at`              | timestamptz nullable   |                                                             |
| `created_at`, `updated_at` | timestamptz            |                                                             |
| `deleted_at`                 | timestamptz nullable   | Soft delete                                                 |

Indexes: `(phone_e164)`, `(email)`, `(role, status)`, `(created_at)`.

#### `auth_otps`

| Column          | Type                 | Notes                                             |
| --------------- | -------------------- | ------------------------------------------------- |
| `id`          | uuid pk              |                                                   |
| `phone_e164`  | text                 |                                                   |
| `purpose`     | enum                 | `login`, `phone_verify`, `sensitive_action` |
| `code_hash`   | text                 | HMAC-SHA256 with server pepper                    |
| `expires_at`  | timestamptz          | 10 minutes                                        |
| `attempts`    | int                  | Max 5                                             |
| `consumed_at` | timestamptz nullable |                                                   |
| `request_ip`  | inet                 |                                                   |
| `created_at`  | timestamptz          |                                                   |

Index: `(phone_e164, purpose, created_at desc)`.

#### `refresh_tokens`

| Column          | Type                 | Notes                               |
| --------------- | -------------------- | ----------------------------------- |
| `id`          | uuid pk              |                                     |
| `user_id`     | uuid fk              |                                     |
| `token_hash`  | text                 | Never store raw token               |
| `family_id`   | uuid                 | Rotation family for reuse detection |
| `device_id`   | uuid nullable        |                                     |
| `user_agent`  | text                 |                                     |
| `ip`          | inet                 |                                     |
| `expires_at`  | timestamptz          | 30 days                             |
| `revoked_at`  | timestamptz nullable |                                     |
| `replaced_by` | uuid nullable        |                                     |
| `created_at`  | timestamptz          |                                     |

Index: `(user_id, expires_at)`, `(token_hash)`.

#### `admin_mfa`

`user_id pk`, `secret_encrypted`, `enabled_at`, `recovery_codes_hash text[]`.

#### `audit_logs`

| Column          | Type           | Notes                          |
| --------------- | -------------- | ------------------------------ |
| `id`          | bigserial pk   |                                |
| `actor_id`    | uuid nullable  | Null for system                |
| `actor_role`  | text           |                                |
| `action`      | text           | e.g. `verification.approved` |
| `entity_type` | text           |                                |
| `entity_id`   | uuid/text      |                                |
| `before`      | jsonb nullable | Redacted                       |
| `after`       | jsonb nullable | Redacted                       |
| `ip`          | inet           |                                |
| `user_agent`  | text           |                                |
| `request_id`  | text           |                                |
| `created_at`  | timestamptz    |                                |

Index: `(entity_type, entity_id, created_at desc)`, `(actor_id, created_at desc)`.

### 7.4 Profiles, Trades, and Services

#### `client_profiles`

`user_id pk fk`, `default_address_id uuid nullable`, `notes text`, `created_at`, `updated_at`.

#### `worker_profiles`

| Column                         | Type                  | Notes                                |
| ------------------------------ | --------------------- | ------------------------------------ |
| `user_id`                    | uuid pk fk            |                                      |
| `bio`                        | text                  | Max 1500 chars                       |
| `primary_trade_id`           | uuid fk trades        |                                      |
| `years_experience`           | smallint              |                                      |
| `base_location`              | geography(Point,4326) | Approximate home/base                |
| `service_radius_m`           | int                   | Default 15000; max 50000             |
| `availability_status`        | enum                  | `available`, `busy`, `offline` |
| `is_online`                  | boolean               | Live toggle                          |
| `rating_avg`                 | numeric(3,2)          | Recalculated                         |
| `rating_count`               | int                   |                                      |
| `jobs_completed`             | int                   |                                      |
| `response_time_seconds`      | int                   | Rolling average                      |
| `verification_status`        | enum                  | Denormalised from submissions        |
| `verified_at`                | timestamptz nullable  |                                      |
| `last_location_at`           | timestamptz nullable  |                                      |
| `created_at`, `updated_at` | timestamptz           |                                      |

Indexes: GiST `(base_location)`, `(verification_status, availability_status)`, `(primary_trade_id)`.

#### `trades`

`id uuid pk`, `slug text unique`, `name text`, `icon text`, `parent_id uuid nullable`, `sort_order int`, `is_active boolean`.

Seed: Mechanic, Electrician, Plumber, Carpenter, Painter, AC Technician, Tailor, Welder, Tiler, Generator Repair.

#### `worker_trades`

`worker_id uuid`, `trade_id uuid`, `is_primary boolean`, `years_experience smallint`, pk `(worker_id, trade_id)`.

#### `services`

| Column                         | Type            | Notes                            |
| ------------------------------ | --------------- | -------------------------------- |
| `id`                         | uuid pk         |                                  |
| `worker_id`                  | uuid fk         |                                  |
| `trade_id`                   | uuid fk         |                                  |
| `title`                      | text            | e.g. "Brake inspection"          |
| `description`                | text            |                                  |
| `pricing_type`               | enum            | `fixed`, `hourly`, `quote` |
| `price_kobo`                 | bigint nullable | Required for fixed/hourly        |
| `duration_minutes`           | int nullable    |                                  |
| `is_active`                  | boolean         |                                  |
| `sort_order`                 | int             |                                  |
| `created_at`, `updated_at` | timestamptz     |                                  |

Index: `(worker_id, is_active, sort_order)`.

#### `portfolio_items`

`id uuid pk`, `worker_id uuid`, `media_id uuid`, `title text`, `description text`, `sort_order int`, `created_at`.

#### `worker_references`

`id uuid pk`, `worker_id uuid`, `name text`, `phone_e164 text`, `relationship text`, `verified_at timestamptz nullable`, `created_at`.

#### `availability_rules`

`id uuid pk`, `worker_id uuid`, `weekday smallint 1-7`, `start_time time`, `end_time time`, `timezone text`, unique `(worker_id, weekday, start_time)`.

### 7.5 Verification Tables

#### `verification_submissions`

| Column                         | Type                 | Notes                                                                           |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------- |
| `id`                         | uuid pk              |                                                                                 |
| `worker_id`                  | uuid fk              |                                                                                 |
| `version`                    | int                  | Increments on resubmission                                                      |
| `status`                     | enum                 | `submitted`, `under_review`, `info_requested`, `verified`, `rejected` |
| `submitted_at`               | timestamptz          |                                                                                 |
| `assigned_admin_id`          | uuid nullable        |                                                                                 |
| `reviewed_at`                | timestamptz nullable |                                                                                 |
| `decision_reason`            | text nullable        |                                                                                 |
| `internal_notes`             | text nullable        |                                                                                 |
| `created_at`, `updated_at` | timestamptz          |                                                                                 |

Partial unique index: one active submission per worker where status in (`submitted`, `under_review`, `info_requested`).

#### `verification_documents`

`id uuid pk`, `submission_id uuid`, `doc_type enum(government_id, selfie, trade_certificate, reference, proof_of_work)`, `media_id uuid`, `status enum(pending, approved, rejected)`, `extracted jsonb`, `rejection_reason text`, `created_at`.

#### `verification_events`

`id bigserial`, `submission_id uuid`, `from_status text`, `to_status text`, `actor_id uuid`, `reason text`, `created_at`.

### 7.6 Media

#### `media`

| Column                | Type         | Notes                                                |
| --------------------- | ------------ | ---------------------------------------------------- |
| `id`                | uuid pk      |                                                      |
| `owner_id`          | uuid         | Uploader                                             |
| `bucket`            | text         |                                                      |
| `storage_key`       | text unique  |                                                      |
| `mime_type`         | text         |                                                      |
| `size_bytes`        | bigint       |                                                      |
| `checksum_sha256`   | text         | Deduplication, fraud checks                          |
| `width`, `height` | int nullable | Images                                               |
| `status`            | enum         | `pending`, `uploaded`, `scanned`, `rejected` |
| `visibility`        | enum         | `private`, `public`                              |
| `created_at`        | timestamptz  |                                                      |

### 7.7 Location and Tracking

#### `addresses`

`id uuid pk`, `user_id uuid`, `label text` (`home`, `work`, custom), `line1`, `line2`, `city`, `state`, `country`, `postal_code`, `latitude numeric(9,6)`, `longitude numeric(9,6)`, `location geography(Point,4326)`, `is_default boolean`, `created_at`, `updated_at`.

Index: GiST `(location)`, `(user_id)`.

#### `booking_tracking_points`

| Column          | Type                  | Notes               |
| --------------- | --------------------- | ------------------- |
| `id`          | bigserial             | Partitioned monthly |
| `booking_id`  | uuid                  |                     |
| `worker_id`   | uuid                  |                     |
| `location`    | geography(Point,4326) |                     |
| `accuracy_m`  | numeric               |                     |
| `speed_mps`   | numeric nullable      |                     |
| `heading`     | numeric nullable      |                     |
| `recorded_at` | timestamptz           |                     |

Index: `(booking_id, recorded_at desc)`. Retain 90 days, then archive or purge.

Live location is held in Redis for speed; the table stores sampled breadcrumbs (every 30 to 60 seconds) for audit and dispute evidence.

### 7.8 Bookings

#### `bookings`

| Column                                                                                               | Type                  | Notes                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`                                                                                               | uuid pk               |                                                                                                       |
| `public_ref`                                                                                       | text unique           | e.g. `SL-2026-000123`                                                                               |
| `client_id`                                                                                        | uuid fk users         |                                                                                                       |
| `worker_id`                                                                                        | uuid fk users         |                                                                                                       |
| `trade_id`                                                                                         | uuid fk               |                                                                                                       |
| `service_id`                                                                                       | uuid nullable         |                                                                                                       |
| `status`                                                                                           | enum                  | See state machine                                                                                     |
| `urgency`                                                                                          | enum                  | `asap`, `scheduled`, `emergency`                                                                |
| `description`                                                                                      | text                  |                                                                                                       |
| `scheduled_start`                                                                                  | timestamptz nullable  |                                                                                                       |
| `scheduled_end`                                                                                    | timestamptz nullable  |                                                                                                       |
| `timezone`                                                                                         | text                  |                                                                                                       |
| `address_id`                                                                                       | uuid nullable         |                                                                                                       |
| `address_snapshot`                                                                                 | jsonb                 | Immutable at booking time                                                                             |
| `location`                                                                                         | geography(Point,4326) | Service location                                                                                      |
| `estimated_price_kobo`                                                                             | bigint                |                                                                                                       |
| `final_price_kobo`                                                                                 | bigint nullable       |                                                                                                       |
| `currency`                                                                                         | char(3)               | `NGN`                                                                                               |
| `payment_method`                                                                                   | enum                  | `card`, `transfer`, `cash`                                                                      |
| `payment_status`                                                                                   | enum                  | `pending`, `authorized`, `paid`, `failed`, `refunded`, `cash_pending`, `cash_confirmed` |
| `cancellation_reason`                                                                              | text nullable         |                                                                                                       |
| `cancelled_by`                                                                                     | uuid nullable         |                                                                                                       |
| `accepted_at`, `en_route_at`, `arrived_at`, `started_at`, `completed_at`, `cancelled_at` | timestamptz nullable  |                                                                                                       |
| `expires_at`                                                                                       | timestamptz nullable  | Request expiry                                                                                        |
| `version`                                                                                          | int                   | Optimistic concurrency                                                                                |
| `created_at`, `updated_at`                                                                       | timestamptz           |                                                                                                       |

Indexes:

- `(client_id, status, created_at desc)`
- `(worker_id, status, scheduled_start)`
- `(status, expires_at)`
- GiST `(location)`
- `(public_ref)`

Exclusion constraint (requires `btree_gist`) to prevent overlapping scheduled jobs:

```sql
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_worker_overlap
EXCLUDE USING gist (
  worker_id WITH =,
  tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
)
WHERE (status IN ('accepted', 'en_route', 'arrived', 'in_progress') AND scheduled_start IS NOT NULL);
```

#### `booking_status_events`

`id bigserial`, `booking_id uuid`, `from_status text`, `to_status text`, `actor_id uuid nullable`, `actor_role text`, `reason text`, `metadata jsonb`, `created_at`.

#### `booking_media`

`id uuid pk`, `booking_id uuid`, `media_id uuid`, `kind enum(problem_photo, completion_photo, invoice_attachment, dispute_evidence)`, `created_at`.

#### `booking_offers` (counter-offers)

`id uuid pk`, `booking_id uuid`, `actor_id uuid`, `amount_kobo bigint`, `note text`, `status enum(pending, accepted, declined, expired)`, `expires_at timestamptz`, `created_at`.

#### `invoices` / `invoice_items`

`invoices`: `id uuid`, `booking_id uuid unique`, `subtotal_kobo`, `platform_fee_kobo`, `total_kobo`, `status`, `issued_at`.
`invoice_items`: `id uuid`, `invoice_id`, `description`, `quantity`, `unit_price_kobo`, `total_kobo`.

### 7.9 Payments, Ledger, and Payouts

#### `payments`

| Column                                             | Type                 | Notes                                                                                         |
| -------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `id`                                             | uuid pk              |                                                                                               |
| `booking_id`                                     | uuid fk              |                                                                                               |
| `payer_id`                                       | uuid fk              |                                                                                               |
| `provider`                                       | text                 | `paystack`                                                                                  |
| `provider_reference`                             | text unique          |                                                                                               |
| `method`                                         | enum                 | `card`, `transfer`, `cash`                                                              |
| `amount_kobo`                                    | bigint               |                                                                                               |
| `fee_kobo`                                       | bigint               |                                                                                               |
| `currency`                                       | char(3)              |                                                                                               |
| `status`                                         | enum                 | `initialized`, `pending`, `succeeded`, `failed`, `refunded`, `partially_refunded` |
| `escrow_status`                                  | enum                 | `held`, `released`, `refunded`, `not_applicable`                                      |
| `authorized_at`, `captured_at`, `settled_at` | timestamptz nullable |                                                                                               |
| `refunded_amount_kobo`                           | bigint default 0     |                                                                                               |
| `failure_reason`                                 | text nullable        |                                                                                               |
| `idempotency_key`                                | text unique          |                                                                                               |
| `metadata`                                       | jsonb                |                                                                                               |
| `created_at`, `updated_at`                     | timestamptz          |                                                                                               |

#### `webhook_events`

`id uuid pk`, `provider text`, `provider_event_id text`, `event_type text`, `payload jsonb`, `signature_valid boolean`, `status enum(received, processed, failed, ignored)`, `error text`, `received_at`, `processed_at`, unique `(provider, provider_event_id)`.

#### `refunds`

`id uuid pk`, `payment_id uuid`, `amount_kobo bigint`, `reason text`, `provider_reference text`, `status enum(pending, succeeded, failed)`, `created_at`, `processed_at`.

#### `bank_accounts`

`id uuid pk`, `worker_id uuid`, `bank_code text`, `account_number_encrypted text`, `account_last4 char(4)`, `account_name text`, `provider_recipient_code text`, `is_default boolean`, `created_at`.

Account numbers are encrypted at rest with a KMS-backed data key. Never log them.

#### `payouts`

`id uuid pk`, `worker_id uuid`, `amount_kobo bigint`, `fee_kobo bigint`, `status enum(pending, processing, paid, failed)`, `provider_transfer_reference text`, `bank_account_id uuid`, `requested_at`, `processed_at`, `failure_reason text`.

#### `ledger_accounts`

`id uuid pk`, `code text unique`, `name text`, `type enum(asset, liability, revenue, expense, equity)`.

Seed accounts: `CASH_PSP`, `CLIENT_RECEIVABLE`, `WORKER_PAYABLE`, `PLATFORM_REVENUE`, `REFUND_LIABILITY`, `PAYOUT_CLEARING`.

#### `ledger_transactions`

`id uuid pk`, `booking_id uuid nullable`, `payment_id uuid nullable`, `payout_id uuid nullable`, `type text`, `description text`, `created_at`.

#### `ledger_entries`

`id bigserial`, `transaction_id uuid`, `account_id uuid`, `direction enum(debit, credit)`, `amount_kobo bigint`.

Invariant: for every `transaction_id`, `sum(debits) = sum(credits)`. Enforce in the service layer, verify with a scheduled integrity job, and add a database trigger if practical.

#### `platform_settings`

`key text pk`, `value jsonb`, `updated_by uuid`, `updated_at`. Stores commission rate, cancellation windows, request expiry, dispute window, payout cadence.

### 7.10 Reviews

#### `reviews`

| Column                         | Type             | Notes                                          |
| ------------------------------ | ---------------- | ---------------------------------------------- |
| `id`                         | uuid pk          |                                                |
| `booking_id`                 | uuid unique      | One review per booking                         |
| `client_id`                  | uuid             |                                                |
| `worker_id`                  | uuid             |                                                |
| `rating`                     | smallint         | Check 1 to 5                                   |
| `comment`                    | text nullable    | Max 2000                                       |
| `tags`                       | text[]           | Punctual, Professional, Fair price, Clean work |
| `tip_kobo`                   | bigint default 0 |                                                |
| `status`                     | enum             | `published`, `hidden`, `flagged`         |
| `created_at`, `updated_at` | timestamptz      |                                                |

Index: `(worker_id, status, created_at desc)`.

### 7.11 Messaging

#### `conversations`

`id uuid pk`, `booking_id uuid nullable`, `client_id uuid`, `worker_id uuid`, `last_message_at timestamptz`, `status enum(open, archived)`, unique `(booking_id)` where not null, `created_at`.

#### `conversation_participants`

`conversation_id uuid`, `user_id uuid`, `last_read_at timestamptz`, pk `(conversation_id, user_id)`.

#### `messages`

`id uuid pk`, `conversation_id uuid`, `sender_id uuid`, `type enum(text, image, file, voice, system)`, `body text nullable`, `media_id uuid nullable`, `created_at`, `deleted_at nullable`.

Index: `(conversation_id, created_at desc)`.

### 7.12 Notifications

#### `notifications`

`id uuid pk`, `user_id uuid`, `type text`, `title text`, `body text`, `data jsonb`, `channel enum(in_app, push, sms, email)`, `status enum(queued, sent, read, failed)`, `read_at timestamptz nullable`, `created_at`.

Index: `(user_id, created_at desc)`, `(user_id, status)`.

#### `notification_preferences`

`user_id uuid`, `type text`, `channel text`, `enabled boolean`, pk `(user_id, type, channel)`.

#### `device_tokens`

`id uuid pk`, `user_id uuid`, `platform enum(web, android, ios)`, `token text unique`, `last_seen_at`, `created_at`.

#### `web_push_subscriptions`

`id uuid pk`, `user_id uuid`, `endpoint text unique`, `p256dh text`, `auth text`, `created_at`.

### 7.13 Saved Workers, Disputes, Platform Tables

#### `saved_workers`

`client_id uuid`, `worker_id uuid`, `created_at`, pk `(client_id, worker_id)`.

#### `disputes`

`id uuid pk`, `booking_id uuid`, `opened_by uuid`, `against_id uuid`, `category enum(no_show, poor_quality, damage, overcharge, safety, other)`, `description text`, `status enum(open, under_review, resolved, closed)`, `resolution enum(refund_client, release_to_worker, partial_refund, warn_worker, suspend_worker, dismiss)`, `resolution_note text`, `resolved_by uuid`, `resolved_at`, `created_at`, `updated_at`.

#### `dispute_events`

`id bigserial`, `dispute_id uuid`, `actor_id uuid`, `action text`, `note text`, `created_at`.

#### `dispute_evidence`

`dispute_id uuid`, `media_id uuid`, `uploaded_by uuid`, `created_at`, pk `(dispute_id, media_id)`.

#### `idempotency_keys`

`key text pk`, `user_id uuid`, `endpoint text`, `request_hash text`, `response_status int`, `response_body jsonb`, `created_at`, `expires_at` (24 hours).

#### `outbox_events`

`id uuid pk`, `aggregate_type text`, `aggregate_id uuid`, `event_type text`, `payload jsonb`, `status enum(pending, processing, processed, failed)`, `attempts int`, `available_at timestamptz`, `processed_at timestamptz`, `last_error text`, `created_at`.

#### `feature_flags`

`key text pk`, `enabled boolean`, `description text`, `updated_at`.

### 7.14 Migrations and Seed Data

- All schema changes through versioned migrations committed to the repo.
- Migrations must be forward-only in production, with an expand/contract pattern for zero downtime.
- CI runs migrations against a clean PostGIS container and verifies they apply in order.
- Seed data: trades, platform settings, test users (one client, three workers with varied verification states), sample bookings in Ibadan, and review fixtures.
- Seed scripts are idempotent and blocked in production unless explicitly allowed.

---

## 8. API Design

### 8.1 Conventions

- Base path: `/api/v1`
- JSON request and response bodies; UTF-8.
- Authentication: `Authorization: Bearer <access_token>` for API calls; refresh token in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie scoped to `/api/v1/auth`.
- All errors follow RFC 9457 `application/problem+json`:

```json
{
  "type": "https://api.example.com/problems/booking-conflict",
  "title": "Booking conflict",
  "status": 409,
  "detail": "This worker already has a job at the selected time.",
  "instance": "/api/v1/bookings",
  "code": "BOOKING_SLOT_UNAVAILABLE",
  "request_id": "req_01J..."
}
```

- Pagination: cursor-based. Query `limit` (max 100) and `cursor`. Response includes `data`, `next_cursor`, `has_more`.
- Sorting: `sort` with a whitelist per endpoint.
- Filtering: explicit documented query parameters.
- Timestamps: ISO 8601 with `Z`.
- Money: integer kobo, field names suffixed `_kobo`.
- Idempotency: `Idempotency-Key` header required on booking creation, payment initialization, refunds, and payouts.
- Request tracing: `X-Request-Id` accepted or generated, returned on every response.
- OpenAPI 3.1 spec generated from code and published; CI fails on breaking changes without a version bump.
- Rate limits documented per endpoint and returned in `RateLimit-*` headers.

### 8.2 Authentication and Authorization

**Authentication flow `[MVP]`:**

1. Client requests OTP for a phone number.
2. Server rate-limits, generates a 6-digit code, stores HMAC hash, sends via Termii.
3. Client submits phone + code.
4. Server verifies, consumes OTP, creates or finds user, issues access token (15 minutes) and refresh token (30 days, rotating).
5. If the user has no role/profile, the response includes `onboarding_required` and allowed roles.
6. Google sign-in: verify the Google ID token, match or create a user by verified email, then issue tokens.

**Token rules:**

- Access JWT claims: `sub`, `role`, `sid`, `iat`, `exp`, `iss`, `aud`.
- Refresh tokens are random 256-bit values, stored hashed, rotated on every use, with reuse detection that revokes the whole family.
- Logout revokes the refresh token family and the session id.
- Suspended users are rejected on refresh and on sensitive actions; short-lived access tokens expire quickly.
- Admin routes require `role in (admin, support, finance)` plus endpoint-level permissions and TOTP MFA for `admin`.

**Authorization model:**

- Coarse role guard plus fine permission checks in services.
- Resource ownership checks are mandatory: a client may only read their bookings; a worker only their assigned jobs; conversations only participants.
- Write IDOR tests for every resource endpoint.

### 8.3 Endpoint Catalog

#### Auth

| Method | Path                   | Access | Notes                             |
| ------ | ---------------------- | ------ | --------------------------------- |
| POST   | `/auth/otp/request`  | Public | Body: `phone_e164`, `purpose` |
| POST   | `/auth/otp/verify`   | Public | Returns tokens or onboarding flag |
| POST   | `/auth/google`       | Public | Body: `id_token`                |
| POST   | `/auth/refresh`      | Cookie | Rotates refresh token             |
| POST   | `/auth/logout`       | Auth   | Revokes session                   |
| POST   | `/auth/logout-all`   | Auth   | Revokes all sessions              |
| GET    | `/auth/me`           | Auth   | User, role, onboarding state      |
| POST   | `/auth/role`         | Auth   | Set role: client or worker, once  |
| GET    | `/auth/sessions`     | Auth   | List devices                      |
| DELETE | `/auth/sessions/:id` | Auth   | Revoke device                     |

#### Users and Profiles

| Method | Path                                  | Access | Notes                    |
| ------ | ------------------------------------- | ------ | ------------------------ |
| GET    | `/users/me`                         | Auth   |                          |
| PATCH  | `/users/me`                         | Auth   | Name, email, avatar      |
| POST   | `/users/me/avatar`                  | Auth   | Presigned upload flow    |
| GET    | `/users/me/settings`                | Auth   |                          |
| PATCH  | `/users/me/settings`                | Auth   | Notification preferences |
| GET    | `/users/me/addresses`               | Auth   |                          |
| POST   | `/users/me/addresses`               | Auth   |                          |
| PATCH  | `/users/me/addresses/:id`           | Auth   |                          |
| DELETE | `/users/me/addresses/:id`           | Auth   |                          |
| GET    | `/users/me/saved-workers`           | Client |                          |
| POST   | `/users/me/saved-workers/:workerId` | Client |                          |
| DELETE | `/users/me/saved-workers/:workerId` | Client |                          |

#### Worker Profile and Services

| Method | Path                      | Access      | Notes                                |
| ------ | ------------------------- | ----------- | ------------------------------------ |
| GET    | `/workers/nearby`       | Client/Auth | Geo search and filters               |
| GET    | `/workers/:id/public`   | Public/Auth | Public profile, limited data         |
| GET    | `/worker/profile`       | Worker      | Own profile                          |
| PATCH  | `/worker/profile`       | Worker      | Bio, trade, radius, base location    |
| PUT    | `/worker/trades`        | Worker      | Replace trade list                   |
| GET    | `/worker/services`      | Worker      |                                      |
| POST   | `/worker/services`      | Worker      |                                      |
| PATCH  | `/worker/services/:id`  | Worker      |                                      |
| DELETE | `/worker/services/:id`  | Worker      | Soft deactivate                      |
| GET    | `/worker/portfolio`     | Worker      |                                      |
| POST   | `/worker/portfolio`     | Worker      | Media id                             |
| DELETE | `/worker/portfolio/:id` | Worker      |                                      |
| GET    | `/worker/availability`  | Worker      | Weekly schedule                      |
| PUT    | `/worker/availability`  | Worker      | Replace schedule                     |
| PUT    | `/worker/service-area`  | Worker      | Base point + radius                  |
| PATCH  | `/worker/status`        | Worker      | `available`, `busy`, `offline` |
| GET    | `/worker/dashboard`     | Worker      | KPIs and requests                    |
| GET    | `/worker/activity`      | Worker      | Views, requests, reviews             |

#### Verification

| Method | Path                                   | Access | Notes                        |
| ------ | -------------------------------------- | ------ | ---------------------------- |
| POST   | `/worker/verification/submissions`   | Worker | Start or resubmit            |
| GET    | `/worker/verification`               | Worker | Current status and checklist |
| POST   | `/worker/verification/documents`     | Worker | Register uploaded media      |
| DELETE | `/worker/verification/documents/:id` | Worker | Only before review           |
| POST   | `/worker/verification/liveness`      | Worker | Provider session or callback |

#### Discovery

| Method | Path                           | Access      | Notes                                                                                    |
| ------ | ------------------------------ | ----------- | ---------------------------------------------------------------------------------------- |
| GET    | `/discovery/workers`         | Client/Auth | Query: lat, lng, radius, trade, min_rating, price_max, availability, verified_only, sort |
| GET    | `/discovery/workers/:id/eta` | Client      | Routes API, cached                                                                       |
| GET    | `/discovery/categories`      | Public      | Trade list                                                                               |
| GET    | `/discovery/suggestions`     | Client      | Places autocomplete proxy                                                                |

#### Bookings

| Method | Path                                     | Access        | Notes                                              |
| ------ | ---------------------------------------- | ------------- | -------------------------------------------------- |
| POST   | `/bookings`                            | Client        | Idempotency required                               |
| GET    | `/bookings`                            | Auth          | Role-scoped list with status filter                |
| GET    | `/bookings/:id`                        | Participant   | Full detail                                        |
| POST   | `/bookings/:id/accept`                 | Worker        | Optimistic version check                           |
| POST   | `/bookings/:id/decline`                | Worker        | Reason optional                                    |
| POST   | `/bookings/:id/counter-offer`          | Worker        | Optional MVP+                                      |
| POST   | `/bookings/:id/offers/:offerId/accept` | Client        | Optional MVP+                                      |
| POST   | `/bookings/:id/cancel`                 | Participant   | Reason required                                    |
| POST   | `/bookings/:id/reschedule`             | Client/Worker |                                                    |
| POST   | `/bookings/:id/status`                 | Worker        | `en_route`, `arrived`, `start`, `complete` |
| GET    | `/bookings/:id/timeline`               | Participant   | Status events                                      |
| GET    | `/bookings/:id/tracking`               | Participant   | Latest position and ETA                            |
| POST   | `/bookings/:id/tracking`               | Worker        | HTTP fallback for location                         |
| GET    | `/bookings/:id/invoice`                | Participant   |                                                    |
| POST   | `/bookings/:id/invoice`                | Worker        | Add line items                                     |
| POST   | `/bookings/:id/review`                 | Client        | After completion                                   |
| GET    | `/bookings/:id/receipt`                | Client        | Payment receipt                                    |

#### Messaging

| Method | Path                            | Access      | Notes                                 |
| ------ | ------------------------------- | ----------- | ------------------------------------- |
| GET    | `/conversations`              | Auth        |                                       |
| POST   | `/conversations`              | Auth        | With booking or worker id             |
| GET    | `/conversations/:id/messages` | Participant | Cursor pagination                     |
| POST   | `/conversations/:id/messages` | Participant | Text/media                            |
| POST   | `/conversations/:id/read`     | Participant | Updates last_read_at                  |
| POST   | `/uploads/presign`            | Auth        | Purpose-bound, MIME and size enforced |

#### Notifications

| Method | Path                        | Access | Notes                      |
| ------ | --------------------------- | ------ | -------------------------- |
| GET    | `/notifications`          | Auth   | Grouped or paged           |
| PATCH  | `/notifications/:id/read` | Auth   |                            |
| POST   | `/notifications/read-all` | Auth   |                            |
| POST   | `/push/subscriptions`     | Auth   | Save web push subscription |
| DELETE | `/push/subscriptions`     | Auth   |                            |

#### Payments and Payouts

| Method | Path                                 | Access               | Notes                        |
| ------ | ------------------------------------ | -------------------- | ---------------------------- |
| POST   | `/bookings/:id/payment/initialize` | Client               | Idempotency required         |
| GET    | `/payments/:id`                    | Payer/Worker/Finance |                              |
| POST   | `/payments/:id/refund`             | Finance              | Idempotency required         |
| POST   | `/webhooks/paystack`               | Public signed        | Raw body, signature verified |
| GET    | `/worker/earnings`                 | Worker               | Summary and chart data       |
| GET    | `/worker/transactions`             | Worker               |                              |
| GET    | `/worker/bank-accounts`            | Worker               |                              |
| POST   | `/worker/bank-accounts`            | Worker               | Resolve account name         |
| DELETE | `/worker/bank-accounts/:id`        | Worker               |                              |
| POST   | `/worker/payouts`                  | Worker               | Withdraw available balance   |
| GET    | `/worker/payouts`                  | Worker               | History                      |

#### Admin

| Method         | Path                                      | Access        | Notes                       |
| -------------- | ----------------------------------------- | ------------- | --------------------------- |
| GET            | `/admin/overview`                       | Admin/Support | KPIs, live map, activity    |
| GET            | `/admin/verifications`                  | Admin/Support | Queue with filters          |
| GET            | `/admin/verifications/:id`              | Admin/Support | Documents, extracted data   |
| POST           | `/admin/verifications/:id/assign`       | Admin         |                             |
| POST           | `/admin/verifications/:id/approve`      | Admin         | Reason and notes            |
| POST           | `/admin/verifications/:id/reject`       | Admin         | Reason code required        |
| POST           | `/admin/verifications/:id/request-info` | Admin         | Reason and checklist        |
| GET            | `/admin/workers`                        | Admin/Support | Search and filters          |
| GET            | `/admin/clients`                        | Admin/Support |                             |
| POST           | `/admin/users/:id/suspend`              | Admin         | Reason required             |
| POST           | `/admin/users/:id/reinstate`            | Admin         |                             |
| GET            | `/admin/bookings`                       | Admin/Support |                             |
| GET            | `/admin/disputes`                       | Admin/Support |                             |
| GET            | `/admin/disputes/:id`                   | Admin/Support | Timeline, evidence, chat    |
| POST           | `/admin/disputes/:id/resolve`           | Admin         | Resolution action           |
| GET            | `/admin/payments`                       | Finance       |                             |
| GET            | `/admin/payouts`                        | Finance       |                             |
| POST           | `/admin/payouts/:id/retry`              | Finance       |                             |
| GET            | `/admin/reports/:report`                | Admin/Finance |                             |
| GET            | `/admin/audit-logs`                     | Admin         |                             |
| GET/PATCH      | `/admin/settings`                       | Admin         | Commission, windows, limits |
| GET/POST/PATCH | `/admin/trades`                         | Admin         | Category management         |

### 8.4 Realtime Contract

Namespace: `/rt`. Authentication via JWT in the Socket.IO handshake (`auth.token`). Unauthorized sockets are disconnected immediately.

Rooms:

- `user:{userId}` for personal notifications
- `booking:{bookingId}` for tracking and status
- `conversation:{conversationId}` for chat
- `ops:admin` for admin live maps (restricted)

Client-to-server events:

| Event                 | Payload                                                      | Notes                           |
| --------------------- | ------------------------------------------------------------ | ------------------------------- |
| `booking:subscribe` | `{ bookingId }`                                            | Validates participation         |
| `booking:location`  | `{ bookingId, lat, lng, accuracy, speed, heading, ts }`    | Worker only, active booking     |
| `chat:send`         | `{ conversationId, clientMessageId, type, body, mediaId }` | Idempotent by client message id |
| `chat:typing`       | `{ conversationId, isTyping }`                             | Ephemeral                       |
| `chat:read`         | `{ conversationId }`                                       |                                 |

Server-to-client events:

| Event                   | Payload                                     |
| ----------------------- | ------------------------------------------- |
| `booking:created`     | Booking summary                             |
| `booking:accepted`    | Booking summary                             |
| `booking:status`      | `{ bookingId, status, at }`               |
| `booking:location`    | `{ bookingId, lat, lng, etaSeconds, at }` |
| `message:new`         | Message                                     |
| `message:read`        | `{ conversationId, userId, at }`          |
| `notification:new`    | Notification                                |
| `verification:status` | `{ status, at }`                          |

Tracking rules:

- Worker location accepted only when booking status is `accepted`, `en_route`, `arrived`, or `in_progress`.
- Throttle broadcasts to at most once per 5 seconds per booking.
- Persist a breadcrumb at most once per 30 seconds.
- Store latest position in Redis with a 2-hour TTL.
- Stop tracking immediately on completion or cancellation and purge live key after TTL.
- If Socket.IO drops, the client falls back to polling `/bookings/:id/tracking` every 10 seconds.

### 8.5 API Security Controls

- Global validation pipe: reject unknown fields, enforce DTO schemas.
- Rate limits: auth OTP 3 per 10 minutes per phone and 20 per hour per IP; general 120 requests per minute per user; nearby search 60 per minute; message send 30 per minute.
- Body size limits: 1 MB JSON; uploads via presigned URLs only.
- CORS allowlist per environment, no wildcard with credentials.
- Security headers: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY` for API, CSP on web app.
- SSRF protection on URL-fetching features; none planned for MVP.
- All admin actions write audit logs.
- PII redaction in logs and error trackers.

---

## 9. Core Workflow: Worker Onboarding and Verification

This is the trust engine of the platform. Treat it as a first-class product, not a form.

### 9.1 Worker Onboarding Steps

1. **Account and role.** Phone OTP verified, role set to `worker`, terms accepted.
2. **Basic profile.** Full name, profile photo, bio, primary trade.
3. **Skills.** Trades (multi-select), years of experience per trade.
4. **Services and pricing.** Title, pricing type, price, duration, active flag. Minimum one service.
5. **Service area.** Base location picked on a map (or browser geolocation), radius slider 1 to 50 km, weekly availability.
6. **Verification documents.**
   - Government ID: NIN, driver's licence, or voter's card.
   - Selfie liveness check via KYC provider.
   - Trade certificate (optional).
   - Two references or proof-of-work photos (at least one required).
7. **Review and submit.** Confirmation screen with checklist and declarations.
8. **Submitted state.** Worker can browse the dashboard but cannot receive bookings until verified.

### 9.2 Document Upload Flow

1. Client requests `POST /uploads/presign` with `purpose`, `mime_type`, `size_bytes`.
2. Server validates purpose, MIME allowlist, and size, then returns a presigned PUT URL valid for 10 minutes and a `media_id`.
3. Client uploads directly to storage.
4. Client calls the relevant registration endpoint with `media_id`.
5. Server verifies the object exists, checks size and checksum, marks `uploaded`, and enqueues scanning/processing.
6. Image processing (resize, strip EXIF, generate thumbnails) runs asynchronously.
7. Verification documents are stored private; admin views them through short-lived signed URLs (5 minutes).

### 9.3 KYC Integration

- Create a verification session with Dojah or Smile Identity for NIN lookup and liveness.
- Store only the provider reference, extracted fields needed for review (name, date of birth, ID last 4), and liveness score. Do not store raw biometric data.
- Duplicate detection: hash document number and file checksum; reject duplicates across accounts.
- If KYC provider is unavailable, do not block account creation; place the submission in `info_requested` or retry asynchronously and alert operations.

### 9.4 Verification State Machine

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> submitted: worker submits
  submitted --> under_review: admin claims
  under_review --> verified: approve
  under_review --> info_requested: request more info
  under_review --> rejected: reject
  info_requested --> submitted: worker resubmits
  verified --> suspended: admin suspends
  suspended --> verified: reinstated
  rejected --> submitted: worker appeals/resubmits
```

Rules:

- Only `admin` roles can transition to `verified`, `rejected`, or `suspended`.
- Every transition writes `verification_events` and an `audit_logs` entry.
- Worker-facing status is denormalised to `worker_profiles.verification_status` in the same transaction.
- Verified workers receive the badge and become eligible for discovery.
- Suspension removes them from discovery immediately and cancels or reassigns upcoming bookings per policy.
- SLA: first review within 24 hours, final decision within 72 hours. Track queue age and alert when breached.

### 9.5 Notification Triggers

| Event              | Worker                            | Admin       |
| ------------------ | --------------------------------- | ----------- |
| Submission created | In-app + push + SMS               | Queue alert |
| Under review       | In-app                            |             |
| Info requested     | Push + SMS + email with checklist |             |
| Verified           | Push + SMS + email celebration    |             |
| Rejected           | Push + SMS + reason               |             |

---

## 10. Core Workflow: Discovery and Matching

### 10.1 Search Inputs

- `lat`, `lng` (required, from browser geolocation or manual address)
- `radius_m` (default 10 km, max 50 km)
- `trade_id` or `category` slug
- `min_rating` (0 to 5)
- `max_price_kobo`
- `availability` (`now`, `today`, `scheduled`)
- `verified_only` (default true)
- `sort` (`nearest`, `top_rated`, `price_low`, `response_time`)
- `cursor`, `limit`

### 10.2 Eligibility Rules

A worker appears in results only if all are true:

1. `verification_status = 'verified'`
2. Account status is `active`
3. Worker is not suspended
4. The client's location is within the worker's service radius: `ST_DWithin(worker.base_location, client_point, worker.service_radius_m)`
5. The worker offers the requested trade
6. The worker is available (`online` for ASAP, schedule-compatible for scheduled)
7. The worker is not currently on an active job, unless policy allows stacking (default: not allowed)

### 10.3 Reference Query

```sql
WITH point AS (
  SELECT ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography AS g
)
SELECT
  w.user_id,
  u.full_name,
  w.primary_trade_id,
  w.rating_avg,
  w.rating_count,
  w.jobs_completed,
  w.response_time_seconds,
  w.service_radius_m,
  ST_Distance(w.base_location, p.g) AS distance_m
FROM worker_profiles w
JOIN users u ON u.id = w.user_id
JOIN point p ON true
WHERE w.verification_status = 'verified'
  AND u.status = 'active'
  AND w.is_online = true
  AND ST_DWithin(w.base_location, p.g, w.service_radius_m)
  AND (:trade_id IS NULL OR EXISTS (
    SELECT 1 FROM worker_trades wt
    WHERE wt.worker_id = w.user_id AND wt.trade_id = :trade_id
  ))
  AND (:min_rating IS NULL OR w.rating_avg >= :min_rating)
ORDER BY
  CASE WHEN :sort = 'nearest' THEN ST_Distance(w.base_location, p.g) END ASC,
  CASE WHEN :sort = 'top_rated' THEN w.rating_avg END DESC,
  w.rating_count DESC,
  w.user_id
LIMIT :limit;
```

### 10.4 Ranking

For MVP, ranking is deterministic:

- Primary sort from the requested `sort` option.
- Tie-break: higher rating, more jobs completed, faster response time, then stable user id.
- Never randomise results in a way that hides verified workers.
- Boost available-now workers when the client filters for now.

Ranking weights can move to a configurable scoring service post-MVP.

### 10.5 ETA Computation

- Compute ETA only for the top N results displayed (N = 10 to 20).
- Use Google Routes API `computeRouteMatrix` in a single batched call from the client to the worker base location.
- Cache ETA in Redis for 3 to 5 minutes keyed by `geohash(client, precision 7):workerId`.
- If the external call fails or exceeds budget, fall back to straight-line distance and an average speed heuristic, and mark the ETA as approximate.
- Enforce per-environment API quotas and alert at 70 percent usage.

### 10.6 Map and Privacy Rules

- Never expose a worker's exact base/home coordinate publicly. Round displayed coordinates or show a neighbourhood-level pin.
- Show approximate distance (`1.2 km away`) and service area, not an exact address.
- Exact live location is shared only with the assigned client during an active booking.
- Client location is shown to the worker only after the booking is accepted.

### 10.7 Cold-Start Strategy

- Launch in one city with a concentrated supply in a few high-demand trades.
- Seed with 50 to 100 verified workers before public marketing.
- Allow "Notify me when a worker is available" when no results are found.
- Track zero-result searches by area and trade weekly and use them to guide recruitment.

---

## 11. Core Workflow: Booking Lifecycle

### 11.1 Booking State Machine

```mermaid
stateDiagram-v2
  [*] --> requested: client creates
  requested --> accepted: worker accepts
  requested --> declined: worker declines
  requested --> expired: no response
  requested --> cancelled: client cancels

  accepted --> en_route: worker starts trip
  accepted --> cancelled: client or worker cancels
  en_route --> arrived: worker arrives
  en_route --> cancelled: cancellation with reason
  arrived --> in_progress: worker starts job
  arrived --> cancelled: cancellation with reason
  in_progress --> completed: worker completes
  completed --> disputed: client opens dispute
  completed --> closed: payout window passes

  disputed --> closed: resolved
  declined --> [*]
  expired --> [*]
  cancelled --> [*]
  closed --> [*]
```

### 11.2 Creation Rules

`POST /bookings` requires:

- `worker_id`, `trade_id`, `service_id` (optional), `description`
- `urgency`: `asap`, `scheduled`, or `emergency`
- `scheduled_start` and `scheduled_end` for scheduled bookings
- `location` (lat/lng) and `address_snapshot`
- `payment_method`: `card`, `transfer`, or `cash`
- `Idempotency-Key`

Server-side checks, inside a single transaction:

1. Client account is active.
2. Worker is verified, active, offers the trade, and serves the location.
3. Requested slot does not overlap the worker's active bookings (exclusion constraint plus advisory lock).
4. Client has no duplicate open booking with the same worker for the same service within a short window.
5. Client is not suspended or rate-limited.
6. Price estimate is computed server-side from the selected service and urgency fee. Never trust client-supplied prices.
7. Insert the booking with status `requested` and `expires_at` (default 5 minutes for ASAP, 30 minutes for scheduled).
8. Write `booking_status_events` and an outbox event.
9. Enqueue an expiry job at `expires_at`.
10. Notify the worker (socket, push, SMS fallback).

### 11.3 Acceptance Rules

- Worker accepts only a `requested` booking assigned to them.
- Use optimistic locking on `version` to prevent double transitions.
- On accept: set `accepted_at`, status `accepted`, cancel the expiry job, notify the client, and create a conversation if one does not exist.
- If the worker is already on an active job and policy disallows stacking, reject with `BOOKING_WORKER_BUSY`.
- Acceptance from a suspended or unverified worker is rejected.

### 11.4 Status Transitions

| From            | To              | Actor         | Guard                                                       |
| --------------- | --------------- | ------------- | ----------------------------------------------------------- |
| `requested`   | `accepted`    | Worker        | Assigned, active, slot free                                 |
| `requested`   | `declined`    | Worker        | Assigned                                                    |
| `requested`   | `expired`     | System        | `expires_at` passed                                       |
| `requested`   | `cancelled`   | Client        | Before acceptance                                           |
| `accepted`    | `en_route`    | Worker        | Within job window                                           |
| `en_route`    | `arrived`     | Worker        | Location near client (within 200 m) or override with reason |
| `arrived`     | `in_progress` | Worker        | Arrived                                                     |
| `in_progress` | `completed`   | Worker        | Minimum duration or explicit confirmation                   |
| any active      | `cancelled`   | Client/Worker | Reason required; cancellation policy applies                |
| `completed`   | `disputed`    | Client        | Within dispute window                                       |
| `completed`   | `closed`      | System        | After payout hold period                                    |

Every transition:

- Validates the actor and guard.
- Updates the booking and timestamps.
- Writes a `booking_status_events` row.
- Emits an outbox event for notifications and analytics.
- Updates the client and worker in real time.

### 11.5 Cancellation Policy `[DECISION]`

Proposed default:

- Client cancels before acceptance: free.
- Client cancels after acceptance but before the worker is en route: free, with a note on the worker's record.
- Client cancels after the worker is en route: cancellation fee (for example 20 percent) paid to the worker.
- Worker cancels after acceptance: no fee, but affects acceptance rate and can trigger review.
- Emergency bookings follow the same rules unless product decides otherwise.

### 11.6 Rescheduling

- Allowed while `requested` or `accepted`, at least 2 hours before the scheduled start.
- Must re-run availability and overlap checks.
- Both parties are notified; history is retained in status events.
- Limit reschedules per booking to prevent abuse.

### 11.7 Emergency Bookings

- A prominent "I need help now" action sets `urgency = emergency`.
- Prioritised in worker notifications with sound or sticky UI.
- Shorter expiry (3 minutes) and higher urgency fee (configurable).
- Only workers within a tighter radius are notified.

### 11.8 Auto-Expiry and Reassignment

- BullMQ delayed job at `expires_at` transitions `requested` to `expired`.
- On expiry or decline, the client sees 3 alternative verified workers nearby.
- Optionally broadcast to a small pool of nearby available workers `[MVP+]`.

---

## 12. Core Workflow: Live Tracking

### 12.1 Location Ingestion

- Worker browser sends location while the job is active via Socket.IO, with an HTTP fallback.
- Client reports geolocation accuracy; reject or down-weight points with accuracy worse than 100 m.
- Server validates the booking state and participant, then:
  - Stores latest position in Redis: `tracking:{bookingId}` with 2-hour TTL.
  - Broadcasts `booking:location` to the `booking:{bookingId}` room at most every 5 seconds.
  - Persists a breadcrumb to `booking_tracking_points` at most every 30 seconds.
  - Computes ETA every 60 seconds or when the worker moves more than 500 m.

### 12.2 ETA and Arrival

- ETA comes from Google Routes API, cached for 60 seconds per booking.
- "Arrived" requires the worker's location within 200 m of the client location, or an explicit override with a reason that is logged.
- Client can share tracking with a trusted contact via a signed, expiring link. The link shows live status but hides personal phone numbers.

### 12.3 Abuse and Safety Controls

- Tracking only during active bookings; no background tracking.
- Clear in-app indicator when location is being shared.
- Rate-limit location events; drop implausible jumps (speed over 200 km/h) and flag them.
- Keep an immutable status and location trail for disputes.
- Provide a safety/report action accessible from the active job screen.

---

## 13. Core Workflow: Messaging

- Conversations are created automatically on booking acceptance and can also be started from a worker's public profile `[MVP+]`.
- Only participants can read or write. Every message send validates participation.
- Message types: text, image, file, voice, system.
- Attachments use the presigned upload flow and are virus-scanned; images are re-encoded and stripped of EXIF.
- `client_message_id` provides idempotency for retries.
- Emit `message:new` to the conversation room, update `last_message_at`, and queue a push notification if the recipient is not connected.
- Read receipts update `conversation_participants.last_read_at` and emit `message:read`.
- Moderation: clients and workers can report a conversation; admins can review and redact abusive content. No automated content scanning in MVP.
- Retention: 24 months, then archive or purge per policy.

---

## 14. Core Workflow: Payments, Escrow, and Payouts

### 14.1 Payment Model `[DECISION]`

Proposed MVP model:

1. Client selects card or bank transfer. The platform charges the full amount on booking confirmation (or at job completion for cash).
2. Funds settle into the platform's PSP balance and are represented as held/escrow in the ledger.
3. On completion, funds become payable to the worker minus commission after the dispute window.
4. Payouts run on a schedule (daily or weekly) to the worker's verified bank account.
5. Cash jobs are recorded; commission is deducted from the next card payout or invoiced.

This model requires legal review of escrow and money-handling obligations. Use the PSP's marketplace/split settlement features where possible to reduce regulatory exposure.

### 14.2 Payment Initialization

1. `POST /bookings/:id/payment/initialize` with idempotency key.
2. Server recomputes the amount from the booking, creates a `payments` row in `initialized`, and calls Paystack `initialize`.
3. Return the authorization URL or client SDK payload.
4. Client completes payment on the PSP.
5. PSP redirects to the web app and sends a webhook.
6. Webhook is verified, persisted, and processed asynchronously.
7. On success: update payment to `succeeded`, set booking `payment_status = paid`, write ledger entries, and notify both parties.

### 14.3 Webhook Handling

- Verify `x-paystack-signature` using HMAC SHA512 with the secret key over the raw body.
- Persist the event before processing; reject duplicates by provider event id.
- Respond `200` within 10 seconds; process asynchronously with retries and a dead-letter queue.
- Handle at minimum: `charge.success`, `charge.failed`, `transfer.success`, `transfer.failed`, `refund.processed`.
- Reconcile daily: fetch PSP transactions missing a local payment and flag mismatches.

### 14.4 Ledger Posting Examples

On successful client payment:

```
DEBIT  CASH_PSP            amount
CREDIT CLIENT_RECEIVABLE   amount
```

On job completion, recognise revenue and worker payable:

```
DEBIT  CLIENT_RECEIVABLE   amount
CREDIT PLATFORM_REVENUE    commission
CREDIT WORKER_PAYABLE      amount - commission
```

On payout:

```
DEBIT  WORKER_PAYABLE      payout
CREDIT CASH_PSP            payout
```

On refund:

```
DEBIT  PLATFORM_REVENUE / WORKER_PAYABLE (as applicable)
CREDIT CASH_PSP
```

Rules:

- Ledger transactions are immutable. Corrections are new reversing entries.
- Every financial state change runs in a database transaction with the ledger entries.
- A nightly integrity job verifies debits equal credits per transaction and that booked balances match PSP settlement reports.
- Store PSP fees separately and model them as an expense.
- Use integer kobo only.

### 14.5 Commission and Pricing

- Commission rate stored in `platform_settings`, with an effective date.
- Snapshot the commission rate on the booking at creation so later changes do not rewrite history.
- Price estimate: service base price plus urgency fee plus any platform fee. Show a full breakdown before confirmation.
- Final invoice can differ from estimate only with client approval or a documented change order.

### 14.6 Refunds and Disputes

- Refunds are initiated only by finance/admin, with a reason and idempotency key.
- Refund amount cannot exceed captured amount.
- Disputes freeze the worker payable until resolution.
- Resolution actions: refund client, release to worker, partial refund, warn, suspend, dismiss.
- Every financial action is audited.

### 14.7 Payouts

- Worker adds a bank account; resolve the account name with Paystack before saving.
- Withdrawal requests validate available balance, minimum amount, and no open disputes.
- Create a `payouts` row, call Paystack Transfers, listen for `transfer.success` or `transfer.failed`.
- Failed transfers notify the worker and finance, and restore the payable balance.
- Payout limits and velocity checks protect against fraud.
- Maintain a daily reconciliation report: PSP balance, ledger balances, payouts, refunds, and discrepancies.

### 14.8 Cash Jobs

- Cash bookings record `payment_status = cash_pending`, then `cash_confirmed` when the worker confirms collection.
- Commission is tracked as a receivable from the worker.
- Deduct from future payouts or invoice for high-volume workers.
- Finance reviews cash reconciliation weekly.

---

## 15. Core Workflow: Reviews and Ratings

- Only the client can review, only after the booking is `completed`, and only once per booking.
- Rating 1 to 5 with optional tags and comment; optional tip.
- Reviews are published immediately, with a report/moderation path.
- Recalculate `worker_profiles.rating_avg`, `rating_count`, and `jobs_completed` in the same transaction or via a queued job with idempotent recomputation.
- Rating formula: simple mean for MVP; consider Bayesian smoothing for workers with very few reviews.
- Do not allow the worker to edit or delete reviews; admins can hide flagged reviews with an audit trail.
- Display star distribution and most recent reviews on the public profile.
- A review with a tip creates a separate payment or adds to the payout ledger entry.

---

## 16. Notifications

### 16.1 Channels and Priorities

| Channel  | Use                                                | Provider             |
| -------- | -------------------------------------------------- | -------------------- |
| In-app   | All events                                         | Database + Socket.IO |
| Web push | New requests, messages, status changes             | FCM                  |
| SMS      | OTP, verification decisions, urgent booking events | Termii               |
| Email    | Receipts, verification, account security           | Resend/SES           |

### 16.2 Event Matrix

| Event                  | Client               | Worker              | Admin          |
| ---------------------- | -------------------- | ------------------- | -------------- |
| OTP requested          | SMS                  | SMS                 |                |
| Booking created        | In-app               | Push + SMS + in-app |                |
| Booking accepted       | Push + in-app        | In-app              |                |
| Worker en route        | Push + in-app        |                     |                |
| Worker arrived         | Push + in-app        |                     |                |
| Job completed          | Push + email receipt | In-app              |                |
| Payment succeeded      | In-app + email       | In-app              |                |
| Review received        |                      | Push + in-app       |                |
| Verification submitted |                      | In-app + SMS        | Queue alert    |
| Verification decision  |                      | Push + SMS + email  |                |
| Dispute opened         | In-app + email       | In-app + email      | Queue alert    |
| Payout processed       |                      | Push + email        | Finance report |

### 16.3 Implementation

- Domain events from the outbox drive notification jobs.
- Templates live in code with typed variables and are rendered per channel.
- Respect user preferences except for transactional and security messages.
- Deduplicate notifications by event key.
- Retry with exponential backoff; dead-letter after 5 attempts and alert.
- Track delivery status per channel.
- Quiet hours for non-urgent push notifications.

---

## 17. Admin, Disputes, and Reporting

### 17.1 Verification Queue

- FIFO with SLA age indicator and priority for resubmissions.
- Filters: status, trade, city, submission date, assigned reviewer.
- Review detail shows ID document, selfie/liveness result, certificate, references, extracted fields, duplicate checks, and worker profile side by side.
- Actions: approve, reject with reason code, request more info with a checklist, assign to self/another reviewer.
- Notes are internal and audited.
- Bulk actions are limited to assignment, not approval, to preserve review quality.

### 17.2 User Management

- Search by name, phone, email, trade, verification status, account status.
- View profile, bookings, payments, reviews, disputes, and audit trail.
- Suspend or reinstate with a reason. Suspension immediately removes the worker from discovery and blocks new bookings.
- Support role is read-only for PII except dispute notes; finance sees payment data but not identity documents.

### 17.3 Disputes

- Intake from the client or worker on a completed or active booking.
- Freeze payout for the booking.
- Timeline view: booking status events, chat history, evidence uploads, and payment state.
- Resolution actions with mandatory notes; notifies both parties.
- Track dispute rate per worker and per client; flag repeat offenders.

### 17.4 Reports `[MVP]`

- Daily active clients and workers
- New signups by role
- Verification queue volume and SLA
- Bookings by status and city
- Gross booking value, platform revenue, refunds, payouts
- Zero-result searches by area and trade (supply gap)
- Worker acceptance rate and cancellation rate
- Top trades and top areas

Reports can be SQL-backed endpoints or scheduled CSV exports. A BI warehouse is post-MVP.

---

## 18. Security, Privacy, and Compliance

### 18.1 Application Security

- Follow OWASP ASVS Level 2 as the baseline.
- Validate all input with DTO schemas; reject unknown fields.
- Parameterised queries only; no string-concatenated SQL.
- Enforce authorization in the service layer with explicit resource ownership checks.
- Encrypt PII at rest: database encryption plus field-level encryption for NIN, bank account numbers, and KYC extracted data.
- Use a managed KMS; rotate keys annually and on incident.
- Store secrets in a managed secret store; never in the repo or client bundles.
- Dependency scanning, container scanning, SAST, and secret scanning in CI.
- Use Cloudflare Turnstile or equivalent on auth endpoints to reduce SMS pumping and bot abuse.
- Protect against SMS pumping: per-phone, per-IP, and per-prefix limits, plus velocity alerts.

### 18.2 Location Privacy

- Collect location only with explicit consent and only when needed.
- Never track workers in the background.
- Show approximate locations before booking; exact locations only during an active job.
- Retain raw tracking points 90 days; aggregates longer.
- Provide a clear privacy explanation on the permission screen and in settings.

### 18.3 Nigerian Data Protection

- Comply with the Nigeria Data Protection Act 2023 and NDPR principles: lawful basis, purpose limitation, data minimisation, retention, security, and data subject rights.
- Publish a privacy policy and terms of service reviewed by counsel.
- Record consent for location, marketing, and KYC processing.
- Appoint a data protection officer or responsible contact.
- Maintain a data processing register and DPAs with PSP, KYC, SMS, and cloud providers.
- Support data subject requests: access, correction, deletion, and portability, with identity verification.
- Breach response: detect, contain, assess, notify the regulator and affected users within required timelines, and document.
- Retention schedule `[DECISION]`:
  - Identity and verification records: account lifetime plus 24 months
  - Booking and payment records: 7 years (financial)
  - Chat messages: 24 months
  - Tracking points: 90 days
  - Audit logs: 24 months
  - OTP records: 90 days
  - Marketing consent records: until withdrawn plus 12 months
- Data localisation: confirm whether any data must remain in Nigeria with counsel and cloud providers.

### 18.4 Fraud and Abuse Controls

- Duplicate identity detection across accounts.
- Velocity limits on bookings, cancellations, and refunds.
- Device and IP anomaly signals for admin review.
- No-show tracking and suspension thresholds.
- Review manipulation detection: duplicate reviewers, review bursts, and linked accounts.
- GPS spoofing heuristics: impossible speed, accuracy anomalies, and mismatch between reported and observed arrival.
- Worker and client blocking/reporting.

---

## 19. Performance, Reliability, and Observability

### 19.1 Service-Level Objectives

| Metric                                     | Target                         |
| ------------------------------------------ | ------------------------------ |
| API availability                           | 99.9 percent monthly           |
| Read endpoint p95                          | under 300 ms                   |
| Write endpoint p95                         | under 500 ms                   |
| Nearby search p95 (excluding external ETA) | under 400 ms                   |
| Tracking update latency                    | under 3 seconds                |
| Webhook processing                         | under 60 seconds               |
| Error rate                                 | under 0.5 percent of requests  |
| Payment reconciliation mismatch            | zero unresolved after 24 hours |

### 19.2 Performance Practices

- Add database indexes for every hot query and review `EXPLAIN ANALYZE` before release.
- Use cursor pagination; never unbounded lists.
- Cache discovery results and ETA in Redis with short TTLs.
- Batch external map calls; enforce quotas and timeouts.
- Use connection pooling (PgBouncer or managed pooler) and sensible pool sizes.
- Partition `booking_tracking_points` by month.
- Move slow work to queues: image processing, notifications, ETA, payouts, webhooks.
- Load test at 2x expected peak before launch.

### 19.3 Observability

- Structured JSON logs with `request_id`, `user_id` (hashed or pseudonymised), route, status, latency, and error code. Redact PII.
- Distributed traces across API, database, Redis, and external providers.
- Metrics: request rate, latency histograms, error rate, booking transitions, queue depth, worker online count, verification queue age, webhook failures, PSP reconciliation mismatches, map API usage.
- Dashboards for API health, business funnel, verification, payments, and realtime.
- Alerts:
  - Error rate above 2 percent for 5 minutes
  - p95 latency above 1 second for 10 minutes
  - Database connections above 80 percent
  - Queue backlog above threshold
  - Webhook failures above 3 in 15 minutes
  - Verification SLA breach
  - Payment reconciliation mismatch
  - Redis or database unavailable
- On-call rotation and runbooks for each alert.

### 19.4 Health Checks

- `GET /health/live` returns process liveness.
- `GET /health/ready` checks database, Redis, and object storage.
- Deployment platform uses readiness before routing traffic.

---

## 20. Testing Strategy and Quality Gates

### 20.1 Test Pyramid

| Level       | Scope                                                 | Tooling                    | Target                              |
| ----------- | ----------------------------------------------------- | -------------------------- | ----------------------------------- |
| Unit        | Domain logic, state machines, pricing, ledger, guards | Jest                       | 75 percent coverage on core modules |
| Integration | Repositories, PostGIS queries, webhooks, queues       | Jest + Testcontainers      | All critical repositories           |
| Contract    | OpenAPI schema, frontend client                       | OpenAPI lint, schemathesis | No breaking changes                 |
| E2E         | Auth, onboarding, booking, payment, review, dispute   | Supertest + seeded DB      | All critical journeys               |
| Load        | Discovery, booking, tracking                          | k6                         | Meets SLO at 2x peak                |
| Security    | Authz, IDOR, rate limits, input validation            | Jest + OWASP ZAP baseline  | No high or critical                 |

### 20.2 Critical Test Cases

- OTP request throttling and verification expiry.
- Refresh token rotation and reuse detection.
- Role escalation attempts blocked.
- Client cannot book an unverified or suspended worker.
- Worker cannot accept a booking assigned to another worker.
- Double booking prevented under concurrent requests.
- Scheduled overlap constraint enforced.
- Booking expiry job fires and notifies the client.
- Cancellation policy applied correctly.
- Webhook signature invalid is rejected and persisted.
- Duplicate webhook is idempotent.
- Ledger debits equal credits for every scenario.
- Refund cannot exceed captured amount.
- Payout blocked when a dispute is open.
- Review only after completion and only once.
- Tracking rejected when the booking is not active.
- Location privacy: exact worker location hidden before acceptance.
- File upload rejects wrong MIME, oversized files, and unverified objects.
- Admin actions require the correct role and write audit logs.

### 20.3 Quality Gates

CI blocks merge unless:

- Lint and typecheck pass.
- Unit and integration tests pass.
- Coverage thresholds met for changed core code.
- Migrations apply cleanly to a fresh PostGIS database.
- OpenAPI spec validates and has no undocumented breaking change.
- Dependency and container scans show no high or critical vulnerabilities.
- No secrets detected.

Release to production additionally requires:

- Staging smoke tests pass.
- Load test baseline unchanged or improved.
- Rollback plan documented.
- Database migration reviewed.
- On-call and support briefed.

---

## 21. CI/CD and Release Process

### 21.1 Pipeline

1. **PR checks:** install, lint, typecheck, unit tests, integration tests with PostGIS and Redis, build, OpenAPI validation, security scans.
2. **Merge to main:** build and push a versioned container image; deploy automatically to staging.
3. **Staging verification:** migrations, smoke tests, E2E critical path, synthetic monitoring.
4. **Production release:** manual approval; run migrations as a separate job using expand/contract; deploy canary or rolling; watch metrics for 30 minutes.
5. **Post-release:** tag release, update changelog, notify stakeholders, verify key business flows.

### 21.2 Migration Policy

- Forward-only in production.
- Expand/contract for breaking changes: add new columns/tables, dual-write, backfill, switch reads, remove old fields in a later release.
- Never drop or rename a column in the same release that changes code using it.
- Test migrations against a production-like snapshot in staging.
- Long-running backfills run as background jobs, not in the deploy migration.

### 21.3 Feature Flags

- Use flags for new booking flows, payment methods, verification providers, and city launches.
- Flags are per environment and audited.
- Remove flags within 30 days of full rollout.

### 21.4 Rollback

- Application: redeploy the previous image; keep database compatibility for at least one release.
- Database: prefer forward fixes; restore from PITR only with incident commander approval.
- Payments: never roll back ledger state; correct with reversing entries.
- Document the rollback steps in the release runbook.

---

## 22. Execution Roadmap

Estimates assume a team of one tech lead, two backend engineers, one frontend engineer, one designer, and part-time QA. Adjust for team size. Timeline is 15 to 17 weeks to public launch.

### Phase 0: Discovery and Foundations (Week 1)

**Goals:** remove ambiguity, provision infrastructure, and agree on contracts.

Tasks:

- Confirm decisions in Section 2.5: city, commission, payment model, providers, trades.
- Create cloud accounts, domain, repositories, and environments.
- Set up Docker Compose for Postgres/PostGIS, Redis, MinIO, mail.
- Scaffold NestJS with config validation, logging, error filter, health checks.
- Set up CI pipeline and branch protection.
- Draft OpenAPI skeleton and database ERD.
- Define coding standards and PR template.
- Establish on-call and incident process.
- Legal: privacy policy, terms, DPA review kickoff.

Deliverables: running local stack, CI green on skeleton, decisions signed off.

Exit criteria: a developer can clone, run one command, and hit `/health/ready`.

### Phase 1: Identity and Access (Weeks 2 to 3)

**Goals:** users can sign up, log in, and have the right role.

Tasks:

- `users`, `auth_otps`, `refresh_tokens`, `audit_logs` tables and migrations.
- OTP request and verify with Termii sandbox, rate limits, and abuse controls.
- Google OAuth verification.
- Access and refresh tokens, rotation, reuse detection, logout, session list.
- RBAC guards and permissions matrix.
- `GET /auth/me` with onboarding state.
- Role selection and client profile creation.
- Admin bootstrap account with TOTP MFA.
- Frontend contract for auth screens.
- Audit logging for auth events.
- Tests: OTP, token rotation, role escalation, rate limits.

Deliverables: auth API and tests; OpenAPI published.

Exit criteria: a new user can sign up with phone and Google, select a role, and refresh sessions securely.

### Phase 2: Worker Profiles and Verification (Weeks 4 to 6)

**Goals:** workers can build a complete profile and submit for verification; admins can review.

Tasks:

- Trades, worker profiles, worker trades, services, portfolio, references, availability tables.
- Media service with presigned uploads, MIME/size validation, image processing, signed URLs.
- Worker profile CRUD and public profile endpoint.
- Service area and base location with PostGIS.
- Verification submissions, documents, events; state machine.
- KYC provider integration (sandbox first) for NIN and liveness.
- Admin verification queue and review endpoints.
- Notifications for submission and decisions.
- Verification emails/SMS templates.
- Duplicate document checks.
- Tests: upload security, state machine, authorization, queue transitions.

Deliverables: end-to-end worker onboarding and admin approval.

Exit criteria: a worker can submit documents; an admin can verify; the worker appears eligible for discovery.

### Phase 3: Discovery and Matching (Week 7)

**Goals:** clients can find nearby verified workers on a map.

Tasks:

- Nearby search endpoint with filters, sorting, pagination, and PostGIS indexes.
- Ranking rules and eligibility enforcement.
- Google Maps proxy endpoints for Places autocomplete and geocoding.
- ETA integration with caching and fallback.
- Category endpoints and seed data.
- Privacy rules for coordinates and distance.
- Search analytics events (zero results, filters used).
- Tests: geo accuracy, filters, authorization, result limits.
- Load test nearby search.

Deliverables: discovery API ready for frontend map and list.

Exit criteria: search returns only verified, available, in-radius workers within SLO.

### Phase 4: Bookings, Tracking, and Chat (Weeks 8 to 10)

**Goals:** clients can book, workers can accept and progress jobs, both can track and chat.

Tasks:

- Bookings table, status events, exclusion constraint, idempotency.
- Booking creation, acceptance, decline, cancel, reschedule, expiry.
- Pricing estimate and commission snapshot.
- Status transition endpoint with guards.
- Socket.IO gateway with auth, rooms, Redis adapter.
- Live tracking ingestion, Redis presence, breadcrumbs, broadcast, ETA.
- Conversations and messages, attachments, read receipts, push wakeups.
- Booking timeline and active job detail endpoints.
- Client and worker dashboards endpoints.
- Tests: concurrency, double booking, transitions, tracking authorization, chat participation.
- Load test booking creation and socket fan-out.

Deliverables: functional booking lifecycle with live tracking and chat.

Exit criteria: two users can complete a booking from request to completion in staging, with live location and messages.

### Phase 5: Payments, Reviews, and Notifications (Weeks 11 to 13)

**Goals:** money moves safely and the feedback loop closes.

Tasks:

- Payments, webhook events, refunds, fee modeling.
- Paystack integration in sandbox: initialize, verify, webhook signature, reconciliation.
- Ledger accounts, transactions, entries, integrity job, commission.
- Bank accounts, payouts, transfer webhooks.
- Cash flow handling and commission receivable.
- Reviews, tags, rating recalculation, public review list.
- Notification service: templates, preferences, in-app, push, SMS, email, retries.
- Receipts and invoices.
- Finance/admin payment views.
- Tests: webhook idempotency, ledger invariants, refund limits, payout guards, review rules.
- Reconciliation drill: simulate PSP mismatch and resolve.

Deliverables: paid booking end-to-end and worker payout in sandbox.

Exit criteria: a card payment settles, ledger balances, worker payout succeeds, and a review updates the rating.

### Phase 6: Admin, Disputes, and Reporting (Week 14)

**Goals:** operations can run the platform.

Tasks:

- Admin overview KPIs and live worker map.
- User management with suspension and audit.
- Dispute intake, evidence, timeline, resolution, payout freeze.
- Booking and payment admin views.
- Reports and CSV export for MVP metrics.
- Platform settings for commission, windows, and limits.
- Support role permissions and data minimisation.
- Tests: admin authorization, audit logging, dispute freeze, suspension effects.

Deliverables: operations console ready for pilot.

Exit criteria: admin can verify, suspend, resolve a dispute, and export reports with full audit trails.

### Phase 7: Hardening and UAT (Weeks 15 to 16)

**Goals:** prove the system is safe, fast, and supportable.

Tasks:

- End-to-end regression across all roles.
- Security review: IDOR, authz matrix, rate limits, file upload, secrets scan.
- Load tests at 2x expected peak; fix bottlenecks.
- Chaos drills: Redis down, PSP webhook delay, database failover.
- Restore drill from backup.
- Monitoring dashboards, alerts, and runbooks completed.
- SMS/email/push deliverability checks.
- Accessibility and responsive checks on critical flows (frontend).
- Legal and privacy review completed.
- Support scripts and escalation paths.
- Pilot recruitment: 50 to 100 verified workers in one city.

Deliverables: UAT sign-off, risk register updated, runbooks published.

Exit criteria: all critical tests pass, no high or critical security findings, SLOs met in load test.

### Phase 8: Pilot and Launch (Week 17)

**Goals:** launch safely to a controlled audience.

Tasks:

- Production infrastructure finalised, WAF, backups, alerts.
- Seed production trades and settings.
- Verify payment and KYC live credentials with small transactions.
- Launch to a closed pilot group.
- Daily operations stand-up: verification SLA, disputes, payment reconciliation, incident review.
- Monitor funnels: signup to verification, search to booking, booking completion.
- Gather feedback and prioritise fixes.
- Public launch checklist signed off.

Deliverables: live platform with pilot users, launch report.

Exit criteria: one week of stable operations, reconciliation clean, verification SLA met, no critical incidents.

---

## 23. Team, Roles, and Ceremonies

### 23.1 Roles

| Role                          | Responsibilities                                  |
| ----------------------------- | ------------------------------------------------- |
| Tech lead                     | Architecture, reviews, risk, cross-team contracts |
| Backend engineer 1            | Auth, users, verification, admin                  |
| Backend engineer 2            | Discovery, bookings, tracking, messaging          |
| Backend engineer 3 (optional) | Payments, ledger, notifications, reporting        |
| Frontend engineer             | Client, worker, and admin web apps                |
| Designer                      | Design system, flows, responsive states           |
| QA                            | Test plans, regression, release sign-off          |
| Product manager               | Scope, decisions, priorities, pilot               |
| DevOps/SRE (shared)           | Infrastructure, CI/CD, observability, on-call     |

### 23.2 Ceremonies

- Daily stand-up, 15 minutes.
- Sprint planning every two weeks.
- Backlog refinement weekly.
- Demo at the end of each sprint.
- Retrospective every two weeks.
- Architecture decision records for any choice that is expensive to reverse.
- Weekly risk review during build, daily during pilot.

### 23.3 Documentation

- `docs/api/openapi.yaml` is the contract and is always current.
- Runbooks for auth outage, PSP outage, KYC outage, Redis outage, database failover, and data breach.
- ADRs in `docs/adr/`.
- Onboarding guide that gets a new engineer productive in one day.
- Decision log at the end of this document.

---

## 24. Risks and Mitigations

| Risk                                    | Likelihood | Impact   | Mitigation                                                                                   |
| --------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------- |
| Supply density too low at launch        | High       | High     | Launch one city, recruit 50 to 100 verified workers, target top trades, use zero-result data |
| Verification queue becomes a bottleneck | High       | High     | Clear checklist, reviewer tooling, SLA dashboard, temporary ops staff, batch assignment      |
| Location permission denied              | Medium     | Medium   | Manual address fallback, clear value explanation, remember choice                            |
| GPS spoofing or false arrival           | Medium     | Medium   | Accuracy checks, speed heuristics, arrival proximity, completion code, manual review         |
| Payment webhook failures or duplicates  | Medium     | High     | Signature verification, event persistence, idempotent processing, retries, reconciliation    |
| Double booking or race conditions       | Medium     | High     | Exclusion constraint, advisory locks, optimistic versioning, concurrency tests               |
| Ledger or reconciliation errors         | Medium     | Critical | Double-entry, immutable entries, nightly integrity job, PSP reconciliation, finance review   |
| KYC provider outage                     | Medium     | Medium   | Queue and retry, manual document review fallback, status transparency                        |
| Maps API cost overrun                   | Medium     | Medium   | Quotas, caching, batch ETA, restricted keys, usage alerts                                    |
| SMS pumping fraud                       | Medium     | Medium   | Turnstile, per-phone and per-prefix limits, velocity alerts, provider fraud controls         |
| Cash job leakage and commission loss    | High       | Medium   | Cash tracking, commission receivable, payout deduction, periodic reconciliation              |
| Data breach or PII exposure             | Low        | Critical | Encryption, least privilege, audits, pen test, incident runbook, insurance                   |
| Regulatory or escrow compliance issue   | Medium     | High     | Legal review, use licensed PSP, avoid holding funds longer than needed                       |
| Realtime instability on poor networks   | High       | Medium   | HTTP fallback, reconnection, throttling, offline states                                      |
| Scope creep delays launch               | High       | High     | Strict MVP boundaries, feature flags, weekly scope review                                    |
| Single-region failure                   | Low        | High     | Managed backups, PITR, documented recovery, multi-AZ database                                |

---

## 25. Definition of Done and Launch Checklist

### 25.1 Definition of Done for a Backend Feature

- Code reviewed and merged to `main`.
- Unit and integration tests written and passing.
- API documented in OpenAPI with request/response examples.
- Authorization and ownership checks tested.
- Audit logging added for sensitive actions.
- Error cases return stable problem codes.
- Metrics and logs added for the new flow.
- Migration tested on a fresh database and on a staging snapshot.
- Feature flag configured if the feature is risky or incomplete.
- Runbook updated if operational action is required.
- Frontend contract confirmed with the consumer.
- No high or critical security findings.

### 25.2 Launch Checklist

**Infrastructure**

- Production database with PostGIS, backups, PITR tested
- Redis with persistence and alerts
- Object storage with lifecycle rules and CDN
- WAF, TLS, HSTS, DNS
- Secrets in managed store; production keys separate
- Autoscaling and health checks configured

**Security and compliance**

- Privacy policy, terms, and cookie notice published
- NDPR/NDPA review completed
- DPA signed with PSP, KYC, SMS, cloud providers
- Data retention jobs scheduled
- Penetration test or security review completed with no high findings
- Admin MFA enforced
- Rate limits and bot protection live
- PII redaction verified in logs and Sentry

**Payments**

- Live PSP keys configured and tested with small transactions
- Webhook endpoint verified with live signature
- Refund and payout flows tested in live sandbox/live small amounts
- Ledger integrity job running
- Daily reconciliation scheduled
- Finance runbook and access controls ready

**Operations**

- Monitoring dashboards and alerts live
- On-call rotation and escalation policy
- Runbooks for top incidents
- Support inbox and macros ready
- Verification SLA staffing confirmed
- Dispute process documented
- Incident communication templates

**Product readiness**

- Trades and platform settings seeded
- 50 to 100 workers verified in the pilot city
- Critical frontend flows tested end to end
- Emails, SMS, and push templates approved
- Analytics events verified
- Legal and brand sign-off

**Launch day**

- Deploy and run smoke tests
- Watch error rate, latency, payments, and verification queue
- Staff a war room for the first 24 hours
- Announce to pilot users
- Capture issues in a single tracker with severity
- Hold a 24-hour retrospective

---

## 26. Post-MVP Roadmap

Prioritised by expected impact:

1. **Open job requests and bidding.** Clients post a job; nearby workers respond. Requires offers, notifications at scale, and anti-collusion controls.
2. **Native mobile apps.** Push reliability, background location for workers, and app-store distribution.
3. **Worker availability calendar and instant booking.** Reduce back-and-forth and improve conversion.
4. **Repeat booking and favourites.** Faster rebooking and retention.
5. **Subscription or promoted visibility for workers.** New revenue stream.
6. **Multi-city expansion.** City configuration, supply density playbook, local payment and SMS nuances.
7. **Advanced fraud detection.** Device intelligence, graph analysis, anomaly scoring.
8. **BI warehouse and experimentation.** Event pipeline, dashboards, A/B testing.
9. **Worker teams and agencies.** Multi-worker jobs and delegated accounts.
10. **Insurance and guarantees.** Job protection products with an insurance partner.

---

## Appendix A: Environment Variables

```dotenv
NODE_ENV=development
PORT=3000
APP_NAME=SkilledLabour
APP_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:5173
ADMIN_BASE_URL=http://localhost:5174
API_BASE_URL=http://localhost:3000/api/v1

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skilled_labour
DATABASE_POOL_SIZE=20

REDIS_URL=redis://localhost:6379
REDIS_PREFIX=sl

JWT_ACCESS_SECRET=replace-me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
JWT_ISSUER=skilled-labour
JWT_AUDIENCE=skilled-labour-web
OTP_HMAC_PEPPER=replace-me

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET_PRIVATE=sl-private
S3_BUCKET_PUBLIC=sl-public
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_FORCE_PATH_STYLE=true

GOOGLE_MAPS_SERVER_KEY=replace-me
GOOGLE_MAPS_WEB_KEY=replace-me
GOOGLE_OAUTH_CLIENT_ID=replace-me

PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_WEBHOOK_SECRET=replace-me

KYC_PROVIDER=dojah
DOJAH_APP_ID=replace-me
DOJAH_SECRET_KEY=replace-me

TERMII_API_KEY=replace-me
TERMII_SENDER_ID=SkilledLabour
RESEND_API_KEY=replace-me
FCM_PROJECT_ID=replace-me
FCM_CLIENT_EMAIL=replace-me
FCM_PRIVATE_KEY=replace-me

SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
LOG_LEVEL=info

COMMISSION_RATE=0.12
BOOKING_REQUEST_TTL_SECONDS=300
DISPUTE_WINDOW_HOURS=24
```

All values are examples. Production uses the secret manager, never a committed file.

---

## Appendix B: State Machine Reference

### B.1 Booking States

`requested`, `accepted`, `en_route`, `arrived`, `in_progress`, `completed`, `closed`, `declined`, `expired`, `cancelled`, `disputed`.

### B.2 Verification States

`draft`, `submitted`, `under_review`, `info_requested`, `verified`, `rejected`, `suspended`.

### B.3 Payment States

`initialized`, `pending`, `succeeded`, `failed`, `refunded`, `partially_refunded`.

### B.4 Escrow States

`held`, `released`, `refunded`, `not_applicable`.

### B.5 Payout States

`pending`, `processing`, `paid`, `failed`.

### B.6 Dispute States

`open`, `under_review`, `resolved`, `closed`.

---

## Appendix C: Sample Operational Queries

**Workers online per trade (admin map):**

```sql
SELECT t.name, count(*) AS online_workers
FROM worker_profiles w
JOIN trades t ON t.id = w.primary_trade_id
WHERE w.is_online = true
  AND w.verification_status = 'verified'
GROUP BY t.name
ORDER BY online_workers DESC;
```

**Verification queue age:**

```sql
SELECT
  id,
  worker_id,
  submitted_at,
  now() - submitted_at AS age
FROM verification_submissions
WHERE status IN ('submitted', 'under_review')
ORDER BY submitted_at ASC;
```

**Unresolved payment mismatches:**

```sql
SELECT p.id, p.provider_reference, p.status, p.amount_kobo
FROM payments p
LEFT JOIN webhook_events w
  ON w.provider_event_id = p.provider_reference
WHERE p.status IN ('pending', 'initialized')
  AND p.created_at < now() - interval '30 minutes';
```

**Zero-result search hotspots (from analytics events):**

```sql
SELECT area_geohash, trade_id, count(*) AS misses
FROM search_events
WHERE result_count = 0
  AND created_at > now() - interval '7 days'
GROUP BY area_geohash, trade_id
ORDER BY misses DESC
LIMIT 20;
```

---

## Appendix D: Third-Party Integration Matrix

| Provider    | Purpose                        | Auth                          | Failure Mode            | Fallback                               |
| ----------- | ------------------------------ | ----------------------------- | ----------------------- | -------------------------------------- |
| Google Maps | Map, places, geocoding, routes | API key (restricted)          | Timeout, quota          | Straight-line distance, cached results |
| Paystack    | Payments, transfers, refunds   | Secret key, webhook signature | Webhook delay, downtime | Retry, reconcile, notify finance       |
| Dojah/Smile | NIN, liveness                  | App ID + secret               | Downtime, mismatch      | Queue retry, manual review             |
| Termii      | SMS OTP, alerts                | API key                       | Delivery delay          | Secondary provider failover            |
| Resend/SES  | Email                          | API key                       | Bounce, delay           | Retry, in-app fallback                 |
| FCM         | Web push                       | Service account               | Token expiry            | In-app notification                    |
| Sentry      | Error tracking                 | DSN                           | Silent drop             | Logs and alerts                        |

Integration rules:

- Every external call has a timeout (5 to 10 seconds), retry policy, and circuit breaker.
- Never call providers synchronously inside a database transaction.
- Store provider references and raw response metadata (redacted) for support.
- Log provider latency and failure rate; alert on sustained degradation.
- Use sandbox credentials in staging; never mix environments.

---

## Appendix E: Decision Log

| Date    | Decision                            | Owner           | Status   | Notes                              |
| ------- | ----------------------------------- | --------------- | -------- | ---------------------------------- |
| 2026-11 | Launch city = Ibadan                | Product         | Proposed | Confirm supply plan                |
| 2026-11 | Commission = 12 percent             | Product/Finance | Proposed | Review after pilot                 |
| 2026-11 | Escrow via PSP platform balance     | Finance/Legal   | Proposed | Legal review required              |
| 2026-11 | Cash jobs allowed                   | Product         | Proposed | Commission deduction policy needed |
| 2026-11 | KYC provider = Dojah                | Engineering     | Proposed | Compare pricing and SLA            |
| 2026-11 | Maps = Google Maps Platform         | Engineering     | Proposed | Quotas and cost alerts             |
| 2026-11 | Direct booking only for MVP         | Product         | Proposed | Bidding post-MVP                   |
| 2026-11 | Modular monolith, not microservices | Engineering     | Proposed | Revisit at scale                   |

Record every change here with date, owner, and rationale. This log protects the team from re-litigating settled decisions and makes audits easier.

---

**End of document.**
