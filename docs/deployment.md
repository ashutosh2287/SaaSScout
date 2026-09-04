# Sasscout Backend — Deployment & Reverse-Proxy Hardening (STEP 31)

This document describes how the Sasscout backend is deployed behind a
TLS-terminating reverse proxy, and the security model that protects it.

> **Status note:** Everything in this file under **IMPLEMENTED** is real, tested
> code/configuration in the repository. Everything under **CONFIGURED BUT NOT
> LIVE-VERIFIED** is written and coherent but was not exercised against a real
> public TLS deployment in the local environment (no proxy binary, no public
> domain/certificate, and no running Docker daemon were available at the time of
> writing). Sections under **NOT_AVAILABLE** could not be verified here.

---

## 1. Production architecture (IMPLEMENTED target)

```
Public Internet
     ↓  HTTPS / TLS  (terminated by the reverse proxy)
Reverse Proxy (e.g. Caddy)
     ↓  HTTP  (private/internal network only)
Sasscout Backend
```

The backend **does not terminate public TLS** and is **not directly exposed** to
the internet. The reverse proxy is the only public edge. The backend listens on
a private/internal interface and is reachable only by the proxy (and any
authorized operator).

Network boundary check (IMPLEMENTED guidance):

| Deployed shape | Correct? |
|---|---|
| Internet → reverse proxy → private backend | ✅ intended |
| Internet → direct Hono backend | ⚠️ only if `HOST` is loopback and only via SSH/tunnel |

The binding interface is controlled by `HOST`. Leave it unset (node-server
default = all interfaces) only when the backend is on a private network behind
the proxy; use `HOST=127.0.0.1` to bind loopback; the proxy case needs
`HOST=0.0.0.0` on a private network. In the reference `docker-compose.yml` only
the proxy's edge port is published to the host; the backend port is `expose`d
(compose-private) only.

## 2. Trusted-proxy model (IMPLEMENTED)

`src/trust.ts` is the single place that decides whether `X-Forwarded-*` headers
may be trusted. It is controlled by `TRUST_PROXY`:

- **`TRUST_PROXY=false` (default)** — the real client IP is the **actual socket
  peer address** (`getConnInfo` → `incoming.socket.remoteAddress`). A client
  can send any forged `X-Forwarded-For`, but it is **ignored**, so the rate
  limiter **cannot** be bypassed by rotating/spoofing headers. This is the
  correct setting for any direct connection.
- **`TRUST_PROXY=true`** — operator-set **only when** the backend is reachable
  exclusively through a controlled proxy. The proxy is responsible for
  overwriting `X-Forwarded-For` with the real client IP (Caddy does this via
  `header_up X-Forwarded-For {remote_host}`). The backend then reads the first
  entry. Enabling this without an actual trusted proxy in front would be a
  misconfiguration that lets attackers spoof IPs.

Header trust decisions (IMPLEMENTED):

| Header | Trusted? | When |
|---|---|---|
| `X-Forwarded-For` | Yes (first entry) | only when `TRUST_PROXY=true` |
| `X-Forwarded-Proto` | Never for security decisions | HSTS is never derived from it |
| `X-Forwarded-Host` | Not used by the app | informational only |
| `X-Request-ID` | **Never** | always app-generated fresh UUID (STEP 30 preserved) |

## 3. Real-IP rate-limit key (IMPLEMENTED)

The rate limiter's default key is the **trusted real client IP** from the model
above (socket peer by default; first `X-Forwarded-For` only behind a trusted
proxy). Keys remain **IP-derived only** — never bodies, merchant names, amounts,
dates, transaction/report data, or request content.

Important limitation (unchanged from STEP 30):

> The limiter is **process-local**: it is reset on restart and is not shared
> across backend instances. It is a scaffold, not a distributed production
> rate limiter. Distributed enforcement would require a shared store (e.g.
> Redis) — explicitly out of scope for STEP 31. See `src/rateLimit.ts`.

## 4. HSTS (IMPLEMENTED)

`Strict-Transport-Security` is emitted **only** when `HSTS_ENABLED=true` is set
by an operator who has confirmed the deployment is HTTPS behind the trusted
proxy. It is deliberately **not** derived from `X-Forwarded-Proto` (an arbitrary
client must never force a browser to pin the domain) and is **absent** during
ordinary HTTP development so `localhost` is never pinned.

Value emitted when enabled:

```text
Strict-Transport-Security: max-age=31536000
```

`includeSubDomains` and `preload` are intentionally omitted (no documented
justification for this project). See `src/headers.ts`.

## 5. Security headers (IMPLEMENTED, preserved)

Every response carries (unchanged from STEP 30):

```text
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Cache-Control: no-store
```

When `HSTS_ENABLED=true`, the HSTS header above is appended.

## 6. Structured JSON logging (IMPLEMENTED, STEP 31 schema)

The request logger emits a single line of structured JSON per request:

```json
{
  "timestamp": "2026-09-04T07:54:33.396Z",
  "level": "info",
  "service": "sasscout-backend",
  "requestId": "06d018dd-244d-4f3b-8ebc-673e7930829d",
  "method": "GET",
  "path": "/health",
  "status": 200,
  "durationMs": 6
}
```

- `level` = `error` for 5xx responses, else `info`.
- `path` is the pathname only — **never** a query string.
- This is a stable, collector-friendly schema. It is emitted to `stdout`
  (`console.log`) / `stderr` (`console.error`); a generic collector (e.g.
  Docker logs / systemd journal) can ingest it. **No external SaaS, no
  telemetry, no analytics.**

**Never logged** (by design the backend should not know these): request body,
query strings containing user data, cookies, `Authorization`, API keys, secrets,
and the identifiers `userId`, `email`, `merchant`, `amount`, `transactionId`,
`reportId`, `fileName`.

> **Transaction data must never be logged.**

## 7. Request IDs (IMPLEMENTED, preserved)

Every request receives a fresh `crypto.randomUUID()`, echoed as `X-Request-ID`.
An incoming `X-Request-ID` is **never trusted or echoed** — a reverse proxy
must not allow clients to inject arbitrary request IDs into logs. See
`src/requestId.ts`.

## 8. Health endpoints (IMPLEMENTED, preserved)

`GET /health` and `GET /api/v1/health` remain:

- lightweight, unauthenticated, non-sensitive;
- independent of transaction data, databases, cloud storage, AI, auth;
- response `{ "status": "ok" }` only.

They expose no environment variables, filesystem paths, secrets, or hostnames.

## 9. CORS (IMPLEMENTED, preserved)

Explicit allow-list only, never `*`, never reflecting arbitrary origins.
Configure the real frontend origin(s) via `CORS_ORIGIN`. For the example compose
topology the origin would be the public HTTPS origin (e.g. `https://app.example.com`).

## 10. Graceful shutdown (IMPLEMENTED, preserved)

`SIGINT`/`SIGTERM` → stop accepting new connections, drain in-flight requests,
force-exit after a bounded timeout (10s). Duplicate signals are safe no-ops.
The same holds inside Docker (Docker sends `SIGTERM`); the proxy and backend
shut down independently — no orchestration is added.

## 11. Environment & secrets (IMPLEMENTED guidance)

Supported variables (all documented in `backend/.env.example`):

```text
PORT
HOST
TRUST_PROXY
HSTS_ENABLED
CORS_ORIGIN
RATE_LIMIT_MAX
RATE_LIMIT_WINDOW_MS
```

- No production secret, API key, password, private key, certificate, or token is
  committed anywhere. `backend/.env.example` is a template only.
- The Docker image bakes **no** `.env`; configuration is injected at runtime.
- `NEXT_PUBLIC_*` values (frontend) are public by definition and must never hold
  backend secrets.

## 12. Reverse-proxy config

### Caddy (CONFIGURED BUT NOT LIVE-VERIFIED)

`backend/Caddyfile` is a local HTTPS test variant: `:8080` with `tls internal`
(self-signed for localhost) proxying to `backend:3001`. For production, replace
the site address with your real domain and drop `tls internal` to get automatic
Let's Encrypt HTTPS. Caddy overwrites `X-Forwarded-For`/`X-Forwarded-Proto` from
the actual peer connection.

Caddy's default access log does not record request bodies; with the backend
having no transaction endpoints, there is no transaction payload to log. If you
attach a custom access log, keep it to method/path/status.

### General reverse-proxy requirements (IMPLEMENTED guidance)

For any proxy (Caddy, Nginx, Traefik, cloud LB):

1. Strip/overwrite client-supplied `X-Forwarded-For`/`X-Forwarded-Proto`.
2. Set the real client IP and `https` scheme in those headers.
3. Terminate TLS and forward HTTP to the backend on a private network.
4. Do not forward `X-Request-ID` from the client (backend ignores it anyway).
5. Keep the backend off the public internet.

## 13. Deployment

### Docker (CONFIGURED BUT NOT LIVE-VERIFIED)

- `backend/Dockerfile` — Node 24 alpine, multi-stage, non-root `node` user, only
  compiled `dist/` + prod deps, no secrets baked, `NODE_ENV=production`,
  `CMD ["node", "dist/index.js"]`.
- `backend/docker-compose.yml` — `backend` (private) + `proxy` (Caddy, public
  `:8080`).

```bash
cd backend
docker compose build
docker compose up -d
# HTTPS test edge: https://localhost:8080/health
```

> The image/Compose config was authored and validated for structure but **not
> executed** here (no running Docker daemon / no public cert in the environment).
> Treat the container run as NOT_AVAILABLE for live QA.

### Without Docker (IMPLEMENTED)

```bash
cd backend
npm ci
npm run build
npm run start          # NODE_ENV=production node dist/index.js
```

serve `PORT`, `HOST`, `TRUST_PROXY`, `HSTS_ENABLED`, `CORS_ORIGIN` via the env.

## 14. Privacy boundary (unchanged)

The backend remains **optional health-only infrastructure**. Only `GET /health`
ever reaches it. Transaction data, reports, merchant names, amounts, dates, and
uploaded files never leave the browser. The reverse proxy and logging layers
introduce no transaction data path.

## 15. Status summary

| Item | Status |
|---|---|
| Trusted-proxy model (`TRUST_PROXY`) | IMPLEMENTED |
| Real-IP rate-limit key | IMPLEMENTED |
| Conditional HSTS (`HSTS_ENABLED`) | IMPLEMENTED |
| Structured JSON logging schema | IMPLEMENTED |
| Request-ID security (preserved) | IMPLEMENTED |
| CORS allow-list (preserved) | IMPLEMENTED |
| Health endpoints (preserved) | IMPLEMENTED |
| Graceful shutdown (preserved) | IMPLEMENTED |
| Caddy reference config | CONFIGURED (NOT live-verified) |
| Dockerfile / compose | CONFIGURED (NOT live-verified) |
| Real HTTPS deployment test | NOT_AVAILABLE in this environment |
