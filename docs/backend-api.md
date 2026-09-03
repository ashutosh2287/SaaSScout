# Sasscout Backend API

Minimal HTTP API for the Sasscout backend, built with **Hono** and TypeScript.

## Stack

- **Runtime:** Node.js (>= 20), TypeScript (NodeNext ESM)
- **Framework:** Hono v4 (`@hono/node-server` for the HTTP server)
- **Port:** `3001` by default, overridable with the `PORT` environment variable

## Startup

```bash
cd backend
npm install
npm run dev      # dev (tsx watch)
npm run build    # compile to dist/
npm run start    # run compiled dist/index.js
npm run test     # node --test (via tsx)
npm run typecheck
npm run lint
```

The backend listens on `http://localhost:3001` by default. Configure the port
with `PORT` in the environment (see `backend/.env.example`):

```bash
PORT=3001
```

> Note: the port value is read from the process environment. Copy
> `backend/.env.example` to `backend/.env` and export it, or set `PORT` in
> your shell, before starting the server. Secrets are never committed anywhere.

## Endpoints

### `GET /health`

Deterministic status check. Returns only non-sensitive service information.

```
GET /health
```

**200 — OK**

```json
{ "status": "ok" }
```

This endpoint **never** receives or returns transaction data, uploaded files,
merchant descriptions, analysis reports, financial data, environment
variables, filesystem paths, request headers, or credentials. Health is the
only thing the STEP 26 frontend boundary talks to.

### `GET /api/v1/health`

API versioning seam (STEP 30). Mirrors `/health` with the same non-sensitive
`{ "status": "ok" }` body and the same security/request-ID/CORS/rate-limit
behavior. The frontend still uses `/health`; this route only guarantees a
stable future namespace. **No business endpoints** (transactions, reports,
analyze, auth, import) exist under `/api/v1` — unknown paths there return the
uniform `404`.

## API Error Format

Every error response (including unknown routes and unexpected server errors)
uses a uniform JSON envelope:

```json
{ "error": { "message": "Not found", "code": "NOT_FOUND" } }
```

- **404** — unknown route: `{ "error": { "message": "Not found", "code": "NOT_FOUND" } }`
- **500** — unexpected server error: `{ "error": { "message": "Internal server error", "code": "INTERNAL_ERROR" } }`

Responses never include stack traces, source paths, or internal details.

## CORS (development)

The backend sends explicit CORS headers only for allow-listed origins. There is
**no wildcard** — a permissive `*` would be unsafe once endpoints carry
credentials.

Default allowed origins (local Next.js dev server):

- `http://localhost:3000`
- `http://127.0.0.1:3000`

Override with the `CORS_ORIGIN` environment variable (comma-separated list)
when the frontend is served from another origin:

```bash
CORS_ORIGIN=https://app.example.com,http://localhost:3000
```

An `OPTIONS` preflight from an allow-listed origin returns `204`.

## Backend Hardening (STEP 30)

### Graceful shutdown

On `SIGINT`/`SIGTERM` the server stops accepting new connections
(`closeAllConnections`), lets in-flight requests finish, then closes cleanly.
A second signal is a no-op, and a 10-second force-exit timeout prevents a
hang. Duplicate shutdown never runs twice. No sensitive request data is logged
during shutdown. See `src/shutdown.ts`.

### Security headers

Every response carries a small, deliberate set of headers appropriate for a
JSON-only API:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Cache-Control: no-store
```

A browser `Content-Security-Policy` is **not** added — the backend serves no
HTML, so a CSP is not meaningful here. HSTS is omitted because the local
backend is HTTP by design. These headers are applied before CORS, so they also
appear on `OPTIONS` preflight responses. See `src/headers.ts`.

### Request IDs

Every request gets a fresh cryptographically strong ID (`crypto.randomUUID`),
stored on the request context and echoed back as the `X-Request-ID` response
header. An incoming `X-Request-ID` is **never trusted or echoed** — this
prevents header/log injection and request-ID spoofing. Request IDs are pure
correlation tokens; they never contain transaction, merchant, amount, date,
report, or file data. `requestId` is available to handlers via the context and
is used to tag server-side error logs. See `src/requestId.ts`.

### No-data logging policy

The backend logs **only** safe correlation metadata:

```json
{ "requestId": "<uuid>", "method": "GET", "path": "/health", "status": 200, "durationMs": 1 }
```

`path` is the pathname only (never the query string). The backend never logs
request bodies, transaction/report data, merchant names, amounts, dates,
uploaded files, cookies, credentials, API keys, secrets, or arbitrary request
headers. There is **no** analytics or telemetry. See `src/logger.ts`.

### Rate limiting (scaffold)

A lightweight **in-memory** fixed-window limiter protects against excessive
requests. A client that exceeds the limit receives:

```text
HTTP 429 Too Many Requests
Retry-After: <seconds>
{ "error": { "message": "Too many requests", "code": "RATE_LIMITED" } }
```

Defaults: `120` requests per `60000` ms window per client (IP-derived from
`X-Forwarded-For`), overridable with `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`.
The frontend's single health check per page load is far below this, so normal
use is never limited.

> **Important:** this limiter is **process-local**. It is reset on restart, is
> not shared across instances, and is **not** a distributed production
> rate-limiter. It is a scaffold for a future deployment architecture (a shared
> store such as Redis would be required for distributed enforcement). Rate-limit
> keys are IP-derived only; it never inspects or stores request content. See
> `src/rateLimit.ts`.

### API versioning seam

`/api/v1` is reserved as the stable future namespace. Only `/api/v1/health`
exists (mirroring `/health`). No business endpoints are invented; unknown
`/api/v1/*` paths return the uniform `404`.

### CORS configuration

CORS remains an **explicit allow-list, no wildcard** (see above). Prefer
setting `CORS_ORIGIN` to the exact origin(s) serving the frontend; do not
commit a machine-specific address into production source.

### Environment variables

```text
PORT=3001
CORS_ORIGIN=http://localhost:3311,http://localhost:3000,http://127.0.0.1:3000
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

## Privacy Boundary

### What IS sent to the backend

Nothing user-specific. STEP 26 wiring is limited to `GET /health`, i.e. a
bare connectivity check. The analysis pipeline stays **local-first** on the
user's device.

### What is NEVER sent to the backend (current architecture)

- CSV / XLSX contents
- transaction rows
- merchant descriptions
- uploaded files
- analysis reports
- financial data / amount information

There is **no** analytics, telemetry, tracking, or third-party network call
anywhere in the application. This boundary must be reviewed and explicitly
approved before any future step sends real transaction data server-side.

## Frontend Access

The frontend reads `NEXT_PUBLIC_API_URL` (base URL of this backend) via
`src/lib/api`. Set it in `frontend/.env.local` (see
`frontend/.env.example`):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

`NEXT_PUBLIC_*` values are baked into the public client bundle, so they may
**never** contain secrets.

The frontend keeps working when the backend is down or not configured — the
API client returns a typed failure and the app never depends on the backend
for analysis.
