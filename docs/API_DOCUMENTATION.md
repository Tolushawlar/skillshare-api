# SkillLink API Documentation and Implementation Notes

This document explains what has been implemented in the SkillLink backend and how to access the interactive Swagger documentation.

## Quick Access

Start the API:

```bash
npm run dev
```

Then open:

| Resource        | URL                                    |
| --------------- | -------------------------------------- |
| Swagger UI      | `http://localhost:4000/docs`         |
| OpenAPI JSON    | `http://localhost:4000/openapi.json` |
| API base URL    | `http://localhost:4000/api/v1`       |
| Liveness check  | `http://localhost:4000/health/live`  |
| Readiness check | `http://localhost:4000/health/ready` |

The port and API prefix come from `PORT` and `API_PREFIX` in `.env`.

## What Has Been Implemented

### 1. Express Application

The app is defined in `src/app.js` and provides:

- Environment validation through `src/config/env.js`
- JSON and URL-encoded request parsing
- CORS allow-list from `CORS_ORIGINS`
- Helmet security headers
- Request IDs through the `X-Request-Id` header
- Request logging with status code and duration
- Centralized 404 and error handling
- Supabase Auth integration
- PostgreSQL connection pooling
- Swagger UI and OpenAPI JSON endpoints
- Graceful shutdown in `src/server.js`

### 2. Authentication and Authorization

Authentication uses Supabase Auth.

Implemented behavior:

- Signup creates a Supabase Auth user and a matching `public.users` profile.
- Login returns the Supabase user, local profile, and session tokens.
- Refresh exchanges a refresh token for a new session.
- Logout signs the user out through the Supabase admin API.
- Protected routes require a Bearer access token.
- The API resolves the caller's local profile and checks that the account is active.
- Role guards support `client`, `worker`, and `admin` access.
- Public endpoints can accept an optional token without requiring one.
- Signup, login, and refresh are rate-limited.

Relevant files:

- `src/routes/auth.js`
- `src/middleware/auth.js`
- `src/lib/supabase.js`

### 3. User Profiles

Users can:

- Read their own profile with `GET /users/me`
- Update their name, phone, avatar URL, location label, and coordinates with `PATCH /users/me`
- Store location as a PostGIS geography point

Relevant files:

- `src/routes/users.js`
- `src/routes/auth.js`

### 4. Worker Discovery and Profiles

Workers can:

- Create and update a worker profile
- Set availability, online status, and service radius
- Create, update, and deactivate services
- Add and remove portfolio items
- Submit verification documents
- View their latest verification submission

Clients and the public can:

- Find nearby verified workers using `GET /workers/nearby`
- Filter nearby workers by trade and minimum rating
- Sort by distance, rating, or price
- View a public worker profile, services, portfolio, and recent reviews

Nearby search uses the PostGIS function `public.nearby_workers()` from the migration.

Relevant files:

- `src/routes/workers.js`
- `src/services/workerService.js`
- `supabase/migrations/20261104000000_init.sql`

### 5. Bookings

Implemented booking behavior:

- Clients create booking requests with location, urgency, payment method, and optional service
- ASAP and emergency bookings require an online, verified worker
- Scheduled bookings require a valid future schedule
- Service radius and worker availability are checked
- Estimated pricing is calculated from the worker hourly rate and urgency
- Request expiry time is stored based on urgency
- A worker cannot be double-booked for overlapping scheduled jobs
- Active jobs block new ASAP jobs for the same worker
- `Idempotency-Key` prevents duplicate booking creation
- Workers can accept or decline requests
- Workers progress jobs through `en_route`, `arrived`, `in_progress`, and `completed`
- Participants can cancel where the state machine allows it
- Clients can review completed bookings once
- Booking events are recorded for status changes

Booking state flow:

```text
requested -> accepted -> en_route -> arrived -> in_progress -> completed
     |           |
     |           +-> cancelled
     +-> declined
```

Relevant files:

- `src/routes/bookings.js`
- `src/services/bookingService.js`
- `src/domain/booking.js`

### 6. Admin Operations

Admins can:

- View platform metrics with `GET /admin/overview`
- List verification submissions by status
- Approve or reject worker verification
- List, search, and filter users
- Suspend or reactivate users
- List all bookings

Relevant files:

- `src/routes/admin.js`
- `src/services/adminService.js`

### 7. Database Schema and Seed Data

The migration creates:

- Enums for roles, account status, verification status, booking status, urgency, and payment types
- Tables for users, trades, worker profiles, services, portfolio items, verification submissions, bookings, booking events, reviews, idempotency keys, and audit logs
- PostGIS location columns and indexes
- Booking overlap protection
- Updated-at triggers
- RLS policies
- A `nearby_workers` database function

The seed script creates:

- Trade categories
- Demo clients, workers, and an admin
- Worker profiles and services
- One requested booking and completed booking history
- Reviews and rating aggregates
- Two pending verification submissions for admin testing

Relevant files:

- `supabase/migrations/20261104000000_init.sql`
- `supabase/seed.sql`
- `scripts/seed.js`

### 8. API Documentation

The API is documented with OpenAPI 3.0.3.

Implemented behavior:

- Swagger UI is mounted at `/docs`
- The raw OpenAPI document is served at `/openapi.json`
- The document contains 32 paths and 37 operations
- It includes request bodies, query parameters, path parameters, response schemas, error responses, examples, and Bearer authentication
- The server URL follows the configured `API_PREFIX`
- Local development adds `http://localhost:<PORT><API_PREFIX>` as a server option
- Swagger authorization persists across page reloads
- Swagger UI assets are served locally through `swagger-ui-express`
- Helmet CSP allows the inline script and styles used by Swagger UI
- Development does not force Swagger assets to upgrade from HTTP to HTTPS; production does
- The documentation contract is covered by automated tests

Relevant files:

- `src/docs/openapi.js`
- `src/app.js`
- `tests/openapi.test.js`

### 9. Automated Checks

Run the test suite:

```bash
npm test
```

The current suite covers:

- Booking status definitions and transitions
- Terminal-state protection
- Active status classification
- Price estimation and urgency fees
- Request expiry rules
- Public reference generation
- Transition notes
- OpenAPI top-level structure
- Server prefix configuration
- Unique operation IDs
- Required tags and responses
- Internal reference resolution
- Required core API paths
- Bearer security on protected endpoints

Current result: 15 tests passing.

## Accessing Swagger UI

### Step 1: Configure the Environment

Create `.env` from the example:

```bash
cp .env.example .env
```

At minimum, configure:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

`SUPABASE_ANON_KEY` is required for login and refresh. `SUPABASE_SERVICE_ROLE_KEY` is required for signup, logout, and seeding.

### Step 2: Prepare the Database

Run the migration:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20261104000000_init.sql
```

Seed the demo data:

```bash
npm run seed
```

The database must support PostGIS.

### Step 3: Start the API

```bash
npm run dev
```

The default documentation URL is:

```text
http://localhost:4000/docs
```

If `PORT` or `API_PREFIX` is changed, use the new port. Swagger remains at `/docs`.

### Step 4: Authenticate in Swagger

1. Open `http://localhost:4000/docs`.
2. Expand `Auth`.
3. Call `POST /auth/login`.
4. Use a seeded account, for example:

```json
{
  "email": "client@skilllink.test",
  "password": "password123"
}
```

5. Copy `data.session.access_token` from the response.
6. Click **Authorize** at the top of the page.
7. Paste the access token only. Do not include the word `Bearer`.
8. Click **Authorize**, then **Close**.
9. Call protected endpoints with **Try it out**.

Swagger adds the `Authorization: Bearer <token>` header automatically.

If the page appears blank, see [Troubleshooting Swagger UI](#troubleshooting-swagger-ui).

Use the right account for each role:

| Role            | Email                     | Password        | Use for                                        |
| --------------- | ------------------------- | --------------- | ---------------------------------------------- |
| Client          | `client@skilllink.test` | `password123` | Creating bookings and reviews                  |
| Client          | `bola@skilllink.test`   | `password123` | Another client account                         |
| Verified worker | `emeka@skilllink.test`  | `password123` | Accepting and progressing bookings             |
| Verified worker | `tunde@skilllink.test`  | `password123` | Recommended for fresh end-to-end booking tests |
| Pending worker  | `femi@skilllink.test`   | `password123` | Testing pending verification                   |
| Admin           | `admin@skilllink.test`  | `admin123`    | Verification and user moderation               |

All other seeded workers use `password123`.

Access tokens expire. If Swagger starts returning `401`, log in again and replace the authorized token.

### Step 5: Use the OpenAPI JSON

The raw specification is available at:

```text
http://localhost:4000/openapi.json
```

You can:

- Import it into Postman or Insomnia
- Use it with code generators
- Validate it in CI
- Inspect schemas and error responses directly

Example validation command:

```bash
curl -sS http://localhost:4000/openapi.json -o /tmp/skilllink-openapi.json
npx --yes @apidevtools/swagger-cli@4 validate /tmp/skilllink-openapi.json
```

## Troubleshooting Swagger UI

### Blank `/docs` page

Use the trailing-slash URL:

```text
http://localhost:4000/docs/
```

The page references Swagger assets relative to `/docs/`. The server redirects `/docs` to `/docs/`, but some browsers and proxies handle the redirect poorly.

Check the browser's Network panel. These requests should return `200`:

- `/docs/swagger-ui.css`
- `/docs/swagger-ui-bundle.js`
- `/docs/swagger-ui-standalone-preset.js`
- `/docs/swagger-ui-init.js`
- `/openapi.json`

### Assets are requested over HTTPS on a local HTTP server

In development, the app disables the CSP `upgrade-insecure-requests` directive so Swagger assets stay on HTTP. If Swagger was blank before this change, restart the server and hard-refresh the browser.

This is especially important when opening the API through a LAN IP or custom hostname instead of `localhost`. Production keeps `upgrade-insecure-requests` enabled, so production deployments should use HTTPS.

### The page still looks stale

- Restart `npm run dev`.
- Hard-refresh the browser.
- Clear any service worker registered for the same host and port.
- Confirm the request is served by this backend, not another app running on port `4000`.

### `/openapi.json` works but `/docs` does not

The JSON endpoint and Swagger UI are independent. If the JSON is valid but the UI is blank, the issue is in the browser loading the Swagger UI HTML or JavaScript assets, not in the API contract. Check the Network and Console panels for blocked scripts or certificate errors.

### Verify the raw contract

```bash
curl -sS http://localhost:4000/openapi.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(d.openapi,Object.keys(d.paths).length,'paths')})"
```

Expected output starts with `3.0.3` and reports `32 paths`.

## Documented API Areas

All paths below are relative to `API_PREFIX`. The default prefix is `/api/v1`.

### Meta

| Method  | Path        | Description                      |
| ------- | ----------- | -------------------------------- |
| `GET` | `/`       | API name, version, and docs path |
| `GET` | `/trades` | List active trade categories     |

### Health

| Method  | Path              | Description              |
| ------- | ----------------- | ------------------------ |
| `GET` | `/health/live`  | Liveness check           |
| `GET` | `/health/ready` | Database readiness check |

Health routes also exist outside the prefix at `/health/live` and `/health/ready`.

### Auth

| Method   | Path              | Access        |
| -------- | ----------------- | ------------- |
| `POST` | `/auth/signup`  | Public        |
| `POST` | `/auth/login`   | Public        |
| `POST` | `/auth/refresh` | Public        |
| `POST` | `/auth/logout`  | Authenticated |
| `GET`  | `/auth/me`      | Authenticated |

### Users

| Method    | Path          | Access        |
| --------- | ------------- | ------------- |
| `GET`   | `/users/me` | Authenticated |
| `PATCH` | `/users/me` | Authenticated |

### Workers

| Method     | Path                                | Access |
| ---------- | ----------------------------------- | ------ |
| `GET`    | `/workers/nearby`                 | Public |
| `GET`    | `/workers/:id`                    | Public |
| `GET`    | `/workers/me`                     | Worker |
| `PATCH`  | `/workers/me`                     | Worker |
| `PUT`    | `/workers/me/availability`        | Worker |
| `POST`   | `/workers/me/services`            | Worker |
| `PATCH`  | `/workers/me/services/:serviceId` | Worker |
| `DELETE` | `/workers/me/services/:serviceId` | Worker |
| `POST`   | `/workers/me/portfolio`           | Worker |
| `DELETE` | `/workers/me/portfolio/:itemId`   | Worker |
| `POST`   | `/workers/me/verification`        | Worker |
| `GET`    | `/workers/me/verification`        | Worker |

### Bookings

| Method   | Path                      | Access                    |
| -------- | ------------------------- | ------------------------- |
| `POST` | `/bookings`             | Client                    |
| `GET`  | `/bookings`             | Authenticated participant |
| `GET`  | `/bookings/:id`         | Authenticated participant |
| `POST` | `/bookings/:id/accept`  | Assigned worker           |
| `POST` | `/bookings/:id/decline` | Assigned worker           |
| `POST` | `/bookings/:id/cancel`  | Authenticated participant |
| `POST` | `/bookings/:id/status`  | Assigned worker           |
| `POST` | `/bookings/:id/review`  | Client                    |

### Admin

| Method    | Path                                      | Access |
| --------- | ----------------------------------------- | ------ |
| `GET`   | `/admin/overview`                       | Admin  |
| `GET`   | `/admin/verifications`                  | Admin  |
| `POST`  | `/admin/workers/:workerId/verification` | Admin  |
| `GET`   | `/admin/users`                          | Admin  |
| `PATCH` | `/admin/users/:id/status`               | Admin  |
| `GET`   | `/admin/bookings`                       | Admin  |

## Response Conventions

Successful responses use a `data` envelope:

```json
{
  "data": {}
}
```

List responses may add `meta`:

```json
{
  "data": [],
  "meta": {
    "count": 0
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

Money values are integer kobo. For example, `1500000` means `NGN 15,000`.

## Important Limitations

- Payment processing is not integrated.
- No background scheduler expires stale booking requests.
- No file upload service is included; document and media fields take externally hosted URLs.
- No email, SMS, push, or realtime notification delivery is implemented.
- No password reset or email verification flow is included.
- Rate limiting is process-local.
- RLS policies exist in the schema, but the API uses a privileged direct Postgres connection. Authorization is enforced by API middleware.
- Automated tests do not cover live Postgres, PostGIS, Supabase Auth, or HTTP integration.
- Live database flows require configured Supabase credentials and a PostGIS-enabled database.

## Troubleshooting Database Connection

If `npm run seed` or the server fails with `TypeError: Invalid URL` or `ERR_INVALID_URL`:

1. Check that `DATABASE_URL` starts with `postgresql://` or `postgres://`.
2. Percent-encode special characters in the database password.
3. Run the command again.

Common password substitutions:

| Character | Encoded value |
| --- | --- |
| `?` | `%3F` |
| `#` | `%23` |
| `@` | `%40` |
| `/` | `%2F` |
| `:` | `%3A` |
| `%` | `%25` |

For example, a password of `p?ss#word` must appear in `.env` as:

```text
postgresql://postgres:p%3Fss%23word@db.example.supabase.co:5432/postgres?sslmode=require
```

Environment validation rejects malformed `DATABASE_URL` values before the server starts.

### `getaddrinfo ENOTFOUND db.<ref>.supabase.co`

Many Supabase direct database hosts are IPv6-only. If your network does not have IPv6, use the **Session pooler** connection string from:

```text
Supabase Dashboard -> Project Settings -> Database -> Connection string -> Session pooler
```

The pooler host looks like:

```text
aws-0-<region>.pooler.supabase.com
aws-1-<region>.pooler.supabase.com
```

Use the pooler username, which includes the project reference:

```text
postgres.<project-ref>
```

### `password authentication failed for user "postgres"`

The project and pooler were reached, but the database password is wrong. Copy the current password from the Supabase connection string, or reset the database password in the dashboard and update `.env`.

### `SELF_SIGNED_CERT_IN_CHAIN`

Supabase's pooler certificate chain is rooted in a Supabase CA that is not in the default Node trust store. For `sslmode=require`, the app adds `uselibpqcompat=true` so current `pg` versions accept the chain while still encrypting the connection. For stricter production verification, configure the Supabase CA and use `sslmode=verify-full`.

## Related Files

| File                                            | Purpose                                   |
| ----------------------------------------------- | ----------------------------------------- |
| `README.md`                                   | Setup, environment, demo, and usage guide |
| `src/app.js`                                  | Express app and Swagger mounting          |
| `src/docs/openapi.js`                         | OpenAPI 3.0.3 specification               |
| `tests/openapi.test.js`                       | OpenAPI contract tests                    |
| `src/routes/`                                 | HTTP route definitions                    |
| `src/services/`                               | Business logic and database access        |
| `src/domain/booking.js`                       | Booking state machine and pricing helpers |
| `supabase/migrations/20261104000000_init.sql` | Database schema and PostGIS setup         |
| `scripts/seed.js`                             | Demo data seeding                         |
