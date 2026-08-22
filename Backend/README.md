# GlobeTrotter — Backend API

REST API for **GlobeTrotter**, a multi-city travel planning platform. Users plan
trips across several cities, build day-by-day itineraries, get automatic budget
breakdowns, and publish read-only itineraries that others can copy.

Built to be consumed by the React web client first and by native mobile clients
later, without backend changes.

---

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Security](#security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Quick start

### With Docker (recommended)

Everything — PostgreSQL, Redis and the API — comes up with one command.

```bash
cd Backend
cp .env.example .env

# The compose file refuses to start without real JWT secrets.
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -hex 64)|" .env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -hex 64)|" .env

docker compose up --build
```

On startup the API applies migrations, seeds the database and begins serving:

| | |
| --- | --- |
| API | http://localhost:4000/api/v1 |
| Swagger UI | http://localhost:4000/api/docs |
| OpenAPI JSON | http://localhost:4000/api/docs.json |
| Health | http://localhost:4000/api/v1/health |

### Without Docker

Requires Node 20+, PostgreSQL 14+ and Redis 6+ running locally.

```bash
cd Backend
npm install
cp .env.example .env          # then set DATABASE_URL, REDIS_URL and the JWT secrets

npx prisma migrate deploy     # create the schema
npm run seed                  # load cities, activities and demo data
npm run dev                   # start with hot reload on :4000
```

### Seeded accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@globetrotter.app` | `AdminPass123!` |
| Traveler | `demo@globetrotter.app` | `DemoPass123!` |
| Second traveler | `sam@globetrotter.app` | `TravelBuddy123!` |

The demo account owns a 14-day Japan trip, a 16-day Europe rail trip and one
completed trip, each with stops, scheduled activities, expenses and a budget.

### Try it

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@globetrotter.app","password":"DemoPass123!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

curl -s http://localhost:4000/api/v1/dashboard -H "Authorization: Bearer $TOKEN"
```

---

## Configuration

Every variable is validated at boot by `src/config/env.ts`; a bad value stops
the process immediately rather than failing later at runtime.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `4000` | |
| `API_PREFIX` | `/api/v1` | All routes are mounted under this |
| `DATABASE_URL` | — | **Required.** PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Rate limiting and caching |
| `JWT_ACCESS_SECRET` | — | **Required**, min 32 chars |
| `JWT_REFRESH_SECRET` | — | **Required**, min 32 chars, must differ from the access secret |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Comma-separated whitelist |
| `JSON_BODY_LIMIT` | `1mb` | |
| `RATE_LIMIT_ENABLED` | `true` | Set `false` only for local debugging |
| `LOG_LEVEL` | `info` | |
| `LOG_DIR` | `logs` | Rotating files are written here |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Used to build share links |

> `CORS_ORIGINS=*` is honoured **only** when `NODE_ENV=development`, so a
> misconfigured production deploy cannot silently open to the world.

---

## API overview

Full request/response detail lives in Swagger at `/api/docs`. Every response
uses one of two envelopes:

```jsonc
// success
{ "success": true, "data": { }, "message": "Trip created successfully" }

// failure
{ "success": false, "message": "Validation failed", "errors": [ { "field": "email", "message": "..." } ] }
```

Paginated endpoints add `meta` with `page`, `limit`, `total`, `totalPages`,
`hasNextPage` and `hasPrevPage`.

<details>
<summary><strong>Endpoint list</strong></summary>

**Auth** — `POST /auth/signup` · `POST /auth/login` · `POST /auth/refresh` ·
`POST /auth/logout` · `POST /auth/logout-all` · `GET /auth/me` ·
`GET /auth/sessions` · `POST /auth/forgot-password` · `POST /auth/reset-password` ·
`POST /auth/change-password`

**Dashboard** — `GET /dashboard`

**Trips** — `POST /trips` · `GET /trips` · `GET /trips/:id` · `PATCH /trips/:id` ·
`DELETE /trips/:id` · `POST /trips/:id/members` · `DELETE /trips/:id/members/:memberId`

**Stops** — `GET /trips/:id/stops` · `POST /trips/:id/stops` · `GET /stops/:id` ·
`PATCH /stops/:id` · `DELETE /stops/:id` · `PATCH /stops/reorder`

**Cities** — `GET /cities` · `GET /cities/facets` · `GET /cities/popular` · `GET /cities/:id`

**Activities** — `GET /activities` · `GET /activities/popular` · `GET /activities/:id` ·
`GET /stops/:id/activities` · `POST /stops/:id/activities` ·
`PATCH /stops/:id/activities/:activityId` · `DELETE /stops/:id/activities/:activityId`

**Itinerary** — `GET /trips/:id/itinerary` · `GET /trips/:id/calendar`

**Budget** — `GET /trips/:id/budget` · `PATCH /trips/:id/budget` ·
`GET /trips/:id/expenses` · `POST /trips/:id/expenses` · `DELETE /trips/:id/expenses/:expenseId`

**Sharing** — `POST /trips/:id/share` · `GET /trips/:id/share` ·
`DELETE /trips/:id/share/:shareId` · `GET /public/:slug` · `POST /public/:slug/copy`

**Profile** — `GET /profile` · `PATCH /profile` · `DELETE /profile` ·
`POST|DELETE /profile/saved-destinations/:cityId` · `GET /profile/notifications` ·
`PATCH /profile/notifications/:id` · `PATCH /profile/notifications/read-all`

**Admin** (ADMIN only) — `GET /admin/analytics` · `GET /admin/users` ·
`GET /admin/users/:userId` · `PATCH /admin/users/:userId` · `GET /admin/audit-logs`

</details>

### Notable behaviours

**Itinerary** returns both shapes in one response — `timeline` (one entry per
calendar day) and `list` (grouped by city) — so toggling the view costs no
second request. On a transfer day, where one stop ends and the next begins,
both stops contribute their activities.

**Budget** is recomputed on every read and after every mutation. It combines
itinerary-derived estimates (lodging, transport, per-day meals, activity prices
× travelers) with manually logged expenses, and reports category totals,
percentages for charting, a per-day breakdown and the list of overbudget days.

**Reorder** takes the *complete* ordered list of stop ids. A partial list is
rejected, which makes the call idempotent and stops a stale drag from silently
dropping a stop. `shiftDates: true` re-flows the dates to match the new order.

**Sharing** produces a slug from a CSPRNG (31¹² keyspace), not a sequential id.
The public payload deliberately omits the member list, the itemised expense log
and the owner's email.

---

## Architecture

```
src/
├── config/        env validation, logger, Prisma, Redis, constants
├── middleware/    authenticate/authorize/optionalAuth, validation,
│                  sliding-window rate limiting, security headers,
│                  sanitisation, request logging, error handling
├── validators/    Zod schemas — one per domain
├── services/      all business logic
├── controllers/   HTTP ⇆ service translation only
├── routes/        wiring: path → rate limiter → validator → controller
├── docs/          OpenAPI 3 document
├── utils/         ApiError/ApiResponse, JWT, Argon2, money, dates, slugs
└── app.ts         middleware pipeline
```

Two rules hold throughout:

1. **No business logic in controllers.** They read the request, call a service
   and format the reply. Everything else — authorisation, validation of
   invariants, arithmetic — lives in a service.
2. **One response envelope.** Nothing writes a response body except
   `sendSuccess` / `sendFailure`, so clients can rely on the shape absolutely.

Trip authorisation resolves through a single function,
`TripService.resolveAccess(tripId, userId, 'view' | 'edit')`. Every trip-scoped
operation goes through it, so there is exactly one place where the ownership
rules live. Non-members get **404, not 403** — the existence of a trip is itself
private.

---

## Data model

Fifteen tables, all with UUID primary keys and `created_at` / `updated_at`.
Full ERD and per-table notes: [`../Database/README.md`](../Database/README.md).

```
users ─┬─ profiles (1:1)
       ├─ sessions ── refresh_tokens
       ├─ notifications, audit_logs, password_reset_tokens
       └─ trips ─┬─ trip_members
                 ├─ stops ─┬─ stop_activities ── activities ── cities
                 │         └─ expenses
                 ├─ budgets (1:1 rollup)
                 └─ shared_itineraries
```

Design choices worth knowing:

- **Money is `NUMERIC(12,2)`**, never a float, and is converted to a 2-decimal
  number exactly once at the JSON boundary.
- **Calendar dates use `date`**, not `timestamptz`, so a stop on the 2nd is the
  2nd in every timezone.
- **`budgets` is a deliberate rollup.** One row per trip holds the computed
  totals so the dashboard can read many trips' budgets without recomputing each.
  `BudgetService.recalculate()` is its only writer.
- **`stop_activities` carries overrides** (time, cost, duration) so scheduling a
  catalog activity into a trip never mutates the shared catalog row.
- **Audit logs survive user deletion** with a nulled actor, satisfying erasure
  without destroying the compliance trail.

---

## Security

| Concern | Approach |
| --- | --- |
| Passwords | Argon2id (19 MiB, t=2, p=1). Hashes upgrade transparently on login if the parameters change. |
| Access tokens | Short-lived JWT (15m default), verified against a live session on every request — so revocation is immediate, not TTL-bound. |
| Refresh tokens | Rotated on every use and stored **only** as SHA-256 digests. |
| Token theft | Replaying an already-rotated refresh token is treated as a compromise: the whole session is revoked, not just that request. |
| Account enumeration | Login and forgot-password return identical responses for known and unknown emails; login verifies against a dummy hash so timing does not leak either. |
| Password change / reset | Revokes every other session. |
| Injection | Prisma parameterises everything; the two raw queries use tagged templates with bound parameters and never interpolate user input. |
| XSS | Script-bearing markup is stripped from string inputs on the way in; prototype-pollution keys are dropped. |
| Transport | Helmet with a CSP, HSTS in production, CORS whitelist, no `X-Powered-By`. |
| Payload size | Rejected on `Content-Length` before the body is buffered. |
| Logging | Passwords, tokens and auth headers are recursively redacted before anything is written. |

### Rate limiting

A **sliding window** in Redis, implemented as a single atomic Lua script over a
sorted set. Unlike a fixed window it cannot be gamed by bunching requests either
side of a boundary, and a rejected request is rolled back so it does not extend
its own penalty. If Redis is unreachable the limiter **fails open** and logs a
warning — an outage degrades to "unthrottled", never to "down".

| Route | Limit |
| --- | --- |
| `POST /auth/login` | 5 / minute (per IP **+ email**, so one attacker cannot lock out a shared IP) |
| `POST /auth/signup` | 3 / hour per IP |
| `POST /auth/forgot-password` | 3 / hour |
| `GET /cities`, `GET /activities` | 60 / minute |
| `POST /trips` | 20 / hour |
| `POST /stops/:id/activities` | 120 / minute |
| `POST /trips/:id/share` | 30 / hour |
| `POST /public/:slug/copy` | 10 / hour |
| everything else | 300 / minute |

Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Policy`;
a 429 adds `Retry-After`.

---

## Testing

```bash
npm test                  # 120 tests across 7 suites
npm test -- --coverage
npm test tests/auth.test.ts
```

Tests run against a dedicated `globetrotter_test` database, created and migrated
automatically, so a run can never touch development data.

| Suite | Covers |
| --- | --- |
| `auth` | signup, login, rotation, reuse detection, logout, password reset, enumeration resistance |
| `trip` | CRUD, filters, ownership, collaborator roles |
| `stop` | ordering, reordering, date validation, activity scheduling |
| `budget` | exact arithmetic, automatic recalculation, ceilings, expenses |
| `share` | public access, privacy leaks, copying, revocation, expiry |
| `itinerary` | timeline/list, transfer days, calendar |
| `rateLimit` | sliding-window behaviour, including the boundary-burst case a fixed window would allow |

Rate limiting is disabled for most suites — the buckets are shared per IP and
would make unrelated tests order-dependent — and exercised directly in its own
suite.

---

## Troubleshooting

**`Invalid environment configuration` on boot**
A required variable is missing or too short. The message names the exact field.
JWT secrets must be at least 32 characters.

**`Can't reach database server`**
Postgres is not up yet. Under Docker the API waits on a healthcheck; running
bare metal, confirm with `pg_isready`. Note the host differs: `postgres` inside
compose, `localhost` outside.

**Rate limiting seems inactive**
It fails open when Redis is unreachable — check the logs for
`Rate limiter bypassed`, and `GET /api/v1/health` for `redis: "down"`.

**429 while developing**
Set `RATE_LIMIT_ENABLED=false` in `.env`, or flush the buckets:
`redis-cli --scan --pattern 'ratelimit:*' | xargs redis-cli del`

**Schema changed but the client disagrees**
`npx prisma generate`, then restart.

**Reset everything**
```bash
docker compose down -v && docker compose up --build
```

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Hot-reloading development server |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Jest + Supertest |
| `npm run seed` | Load cities, activities and demo data |
| `npm run lint` | Type-check without emitting |
| `npm run prisma:migrate` | Create and apply a migration |
| `npm run prisma:studio` | Browse the database |
