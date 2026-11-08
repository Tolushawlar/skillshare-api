# SkillLink Backend

REST API for SkillLink, a location-based skilled-labour marketplace. Clients find nearby verified workers, create bookings, and track jobs from request to completion. Workers manage their profile, services, availability, portfolio, and verification. Admins review verification submissions and moderate users.

The API is built with Node.js, Express, PostgreSQL/PostGIS, and Supabase Auth. Interactive Swagger documentation is served by the app.

For implementation notes and detailed Swagger usage, see [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md).

## Stack

- Node.js 20 or newer
- Express 4
- PostgreSQL with PostGIS
- Supabase Auth and service-role admin API
- Zod request validation
- OpenAPI 3.0.3 and Swagger UI

## Prerequisites

- Node.js 20+ and npm
- A Supabase project with the PostGIS extension available
- Network access from your machine to Supabase Auth and Postgres
- Optional: `psql`, the Supabase CLI, `jq`, and curl for the examples below

## Quick Start

```bash
npm install
cp .env.example .env
```

Edit `.env` with your Supabase project credentials and Postgres connection string.

Run the database migration using one of these options:

```bash
# Option A: psql
psql "$DATABASE_URL" -f supabase/migrations/20261104000000_init.sql

# Option B: Supabase CLI (after linking the project)
supabase db push
```

You can also paste the migration file into the Supabase Dashboard SQL Editor.

Seed demo data, then start the API:

```bash
npm run seed
npm run dev
```

The API starts at `http://localhost:4000/api/v1` by default.

| Resource | URL |
| --- | --- |
| Swagger UI | `http://localhost:4000/docs` |
| OpenAPI JSON | `http://localhost:4000/openapi.json` |
| Liveness | `http://localhost:4000/health/live` |
| Readiness | `http://localhost:4000/health/ready` |

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production`. Defaults to `development`. |
| `PORT` | No | HTTP port. Defaults to `4000`. |
| `API_PREFIX` | No | API mount path. Defaults to `/api/v1`. |
| `SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_ANON_KEY` | Yes for login | Used for password login and token refresh. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Used for signup, logout, and server-side admin operations. Never expose this key to clients. |
| `DATABASE_URL` | Yes | Direct Postgres or session-pooler connection string. Supabase requires SSL. |
| `CORS_ORIGINS` | No | Comma-separated allowed frontend origins. |

`.env.example` contains placeholder values. Keep the real `.env` out of version control.

## Database Setup

The migration creates the schema, enums, constraints, indexes, triggers, RLS policies, and the PostGIS `nearby_workers` function. It enables `pgcrypto`, `citext`, `postgis`, and `btree_gist`.

The migration path is:

```text
supabase/migrations/20261104000000_init.sql
```

The seed command reads `supabase/seed.sql` for trades, creates demo Auth users, public profiles, worker services, one requested booking, completed booking history, reviews, and two pending verification submissions.

`npm run seed` skips booking creation when bookings already exist. Use a fresh Supabase project or reset the schema to reseed from scratch.

## Demo Accounts

All demo accounts use the seed data below.

| Role | Email | Password |
| --- | --- | --- |
| Client | `client@skilllink.test` | `password123` |
| Client | `bola@skilllink.test` | `password123` |
| Verified worker | `emeka@skilllink.test` | `password123` |
| Verified worker | `tunde@skilllink.test` | `password123` |
| Pending worker | `femi@skilllink.test` | `password123` |
| Admin | `admin@skilllink.test` | `admin123` |

The other seeded workers also use `password123`.

## Using Swagger UI

1. Open `http://localhost:4000/docs`.
2. Call `POST /auth/login` with a demo account. This operation is public.
3. Copy `data.session.access_token` from the response.
4. Click **Authorize** and paste the access token. Do not include the word `Bearer`; Swagger adds it.
5. Call the protected endpoints. Use a client token for client actions, a worker token for worker actions, and the admin token for `/admin/*`.

Swagger remembers authorization across reloads. Access tokens expire, so log in again when requests start returning `401`.

The OpenAPI document uses the configured `API_PREFIX` as its server URL. It can also be imported directly into Postman or Insomnia from `/openapi.json`.

## End-to-End Example

The following flow uses curl and `jq`. Start with a fresh seed so Tunde has no active booking.

```bash
export BASE_URL=http://localhost:4000/api/v1

CLIENT_TOKEN=$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"client@skilllink.test","password":"password123"}' \
  | jq -r '.data.session.access_token')

WORKER_ID=$(curl -sS "$BASE_URL/workers/nearby?lat=7.3775&lng=3.947&trade=Electrician" \
  | jq -r '.data[0].user_id')

BOOKING=$(curl -sS -X POST "$BASE_URL/bookings" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-booking-1' \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"description\": \"Living room sockets keep tripping the breaker. Please find the fault and repair it.\",
    \"address\": \"Bodija Market, Ibadan\",
    \"lat\": 7.3775,
    \"lng\": 3.947,
    \"urgency\": \"asap\",
    \"payment_method\": \"cash\"
  }")

BOOKING_ID=$(echo "$BOOKING" | jq -r '.data.id')

WORKER_TOKEN=$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"tunde@skilllink.test","password":"password123"}' \
  | jq -r '.data.session.access_token')

curl -sS -X POST "$BASE_URL/bookings/$BOOKING_ID/accept" \
  -H "Authorization: Bearer $WORKER_TOKEN"

for STATUS in en_route arrived in_progress completed; do
  curl -sS -X POST "$BASE_URL/bookings/$BOOKING_ID/status" \
    -H "Authorization: Bearer $WORKER_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"status\":\"$STATUS\"}"
done

curl -sS -X POST "$BASE_URL/bookings/$BOOKING_ID/review" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"rating":5,"comment":"Fast, professional, and explained the fault clearly."}'

curl -sS "$BASE_URL/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

Notes:

- `POST /bookings` accepts an optional `Idempotency-Key`. Repeating the same request with the same key returns the stored response.
- ASAP and emergency bookings require an online, verified worker. Scheduled bookings can target an offline worker.
- Use a verified worker such as Tunde or Emeka for demo bookings.
- Money amounts are integer kobo. For example, `1500000` means `NGN 15,000`.
- `GET /workers/nearby` returns verified workers with their distance and rating.

## Endpoint Summary

All paths below are relative to `API_PREFIX`, except the health endpoints.

| Area | Method and path | Access |
| --- | --- | --- |
| Meta | `GET /` | Public |
| Health | `GET /health/live`, `GET /health/ready`, `GET /health` | Public |
| Trades | `GET /trades` | Public |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh` | Public |
| Auth | `POST /auth/logout`, `GET /auth/me` | Authenticated |
| Users | `GET /users/me`, `PATCH /users/me` | Authenticated |
| Workers | `GET /workers/nearby`, `GET /workers/:id` | Public |
| Workers | `GET /workers/me`, `PATCH /workers/me` | Worker |
| Workers | `PUT /workers/me/availability` | Worker |
| Workers | `POST /workers/me/services`, `PATCH /workers/me/services/:serviceId`, `DELETE /workers/me/services/:serviceId` | Worker |
| Workers | `POST /workers/me/portfolio`, `DELETE /workers/me/portfolio/:itemId` | Worker |
| Workers | `POST /workers/me/verification`, `GET /workers/me/verification` | Worker |
| Bookings | `POST /bookings` | Client |
| Bookings | `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel` | Authenticated participant |
| Bookings | `POST /bookings/:id/accept`, `POST /bookings/:id/decline`, `POST /bookings/:id/status` | Assigned worker |
| Bookings | `POST /bookings/:id/review` | Client |
| Admin | `GET /admin/overview`, `GET /admin/verifications`, `GET /admin/users`, `GET /admin/bookings` | Admin |
| Admin | `POST /admin/workers/:workerId/verification`, `PATCH /admin/users/:id/status` | Admin |

Open Swagger UI for request bodies, query parameters, response schemas, and error codes.

## Booking States

```text
requested -> accepted -> en_route -> arrived -> in_progress -> completed
     |           |
     |           +-> cancelled
     +-> declined
```

- Clients create bookings in `requested`.
- Workers accept or decline requests.
- The assigned worker advances `accepted` through `en_route`, `arrived`, `in_progress`, and `completed`.
- Participants can cancel where the state machine allows it.
- A client can review a completed booking once.

The `expires_at` field is stored for requests, but no background scheduler currently expires stale requests.

## Response and Error Format

Successful responses use a `data` key and may include `meta`:

```json
{
  "data": {},
  "meta": {
    "count": 1
  }
}
```

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body or query is invalid.",
    "details": [],
    "request_id": "request-id"
  }
}
```

Common codes include `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `EMAIL_IN_USE`, `WORKER_BUSY`, `WORKER_OFFLINE`, `WORKER_NOT_VERIFIED`, and `IDEMPOTENCY_CONFLICT`.

## Verification and Admin Flow

1. Log in as a worker.
2. Submit documents with `POST /workers/me/verification`.
3. Log in as the admin.
4. Review pending submissions with `GET /admin/verifications?status=pending`.
5. Approve or reject with `POST /admin/workers/:workerId/verification`.
6. Check the result with `GET /workers/me` as the worker.

The seed includes pending submissions for Femi and Suleiman so the admin endpoints can be tested immediately.

## Testing

```bash
npm test
```

The test suite covers booking state transitions, pricing and expiry rules, public reference generation, OpenAPI structure, reference resolution, operation IDs, documented core paths, and bearer security on protected endpoints.

These tests are unit tests only. They do not require a database and do not exercise Postgres, PostGIS, Supabase Auth, or live HTTP routes.

For a local smoke test without a database:

```bash
curl http://localhost:4000/health/live
curl -i http://localhost:4000/api/v1/users/me
```

## Project Layout

```text
src/
  app.js                 Express app, Swagger UI, and middleware wiring
  server.js              HTTP server and graceful shutdown
  config/env.js          Environment validation
  docs/openapi.js        OpenAPI 3.0.3 document
  domain/booking.js      State machine, pricing, expiry, reference helpers
  lib/db.js              Postgres pool and transaction helper
  lib/supabase.js        Supabase anon and service-role clients
  middleware/            Auth, validation, request IDs, errors
  routes/                HTTP route definitions
  services/              Booking, worker, and admin business logic
supabase/
  migrations/            Database schema and PostGIS functions
  seed.sql               Trade seed data
scripts/seed.js          Demo users, workers, bookings, reviews, verifications
tests/                   Node test runner tests
```

## Known Limitations

- Payments are not processed. Payment status is recorded only for booking flow and demo data.
- No background job expires stale booking requests.
- No file upload service. Selfie, certificate, media, and avatar fields accept externally hosted URLs.
- No push notifications, email notifications, SMS, or realtime updates.
- No password reset or email verification flow.
- No rate-limit store shared across processes; the built-in limiter is process-local.
- RLS policies exist in the migration, but the API connects directly to Postgres with privileged credentials. Authorization is enforced by API middleware, not by the database connection.
- The seed is intended for demo environments. Do not use demo accounts or passwords in production.

## Troubleshooting

- `Invalid environment configuration`: check for missing variables in `.env` and valid URLs.
- `Seed failed: TypeError: Invalid URL` or `ERR_INVALID_URL`: percent-encode special characters in the database password. For example, `?` becomes `%3F`, `#` becomes `%23`, `@` becomes `%40`, and `/` becomes `%2F`.
- `getaddrinfo ENOTFOUND db.<ref>.supabase.co`: the direct Supabase database host may be IPv6-only. Copy the Session pooler connection string from Project Settings -> Database instead.
- `password authentication failed for user "postgres"`: replace the database password in `DATABASE_URL` with the current Supabase database password, or reset it from the dashboard and update `.env`.
- `SELF_SIGNED_CERT_IN_CHAIN`: the app normalizes Supabase pooler URLs with `sslmode=require` for current `pg` behavior. Restart after updating the code; use a trusted CA with `sslmode=verify-full` if your environment requires certificate verification.
- Readiness returns `503`: check `DATABASE_URL`, SSL, network access, and that Postgres is reachable.
- `POST /auth/login` returns `401` for seeded users: confirm `SUPABASE_ANON_KEY` and rerun `npm run seed`.
- `POST /auth/signup` fails: confirm `SUPABASE_SERVICE_ROLE_KEY` and that Auth email settings allow admin-created users.
- PostGIS or `nearby_workers` errors: enable the `postgis` extension and rerun the migration.
- Swagger requests return `401`: authorize with a fresh access token, not a refresh token.
- Swagger page is blank: open `http://localhost:4000/docs/` with the trailing slash, restart the server, and confirm the `/docs/swagger-ui-*.js` assets return `200` in the browser Network panel. See `docs/API_DOCUMENTATION.md` for details.
- Swagger assets fail when using a LAN IP or custom hostname: development no longer upgrades HTTP assets to HTTPS. Restart the server and hard-refresh; production should be served over HTTPS.
- Browser requests are blocked by CORS: add the frontend origin to `CORS_ORIGINS`.
