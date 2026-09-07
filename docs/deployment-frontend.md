# Frontend deployment (Phase C)

This is the v1 production deployment shape for the Sasscout frontend.
The goal is a small, reproducible image with a thin reverse-proxy in
front. There is no backend in v1 — every page renders client-side —
so the runtime surface is the standalone Next server + Caddy.

## Build the image

```bash
cd frontend
docker build -t sasscout-frontend:latest .
```

The build context is the `frontend/` directory; the `.dockerignore`
keeps tests, fixtures, and the `.next` cache out of the daemon. The
resulting image is ~150 MB on `node:20-bookworm-slim`.

## Run the image

```bash
docker run --rm -p 3000:3000 sasscout-frontend:latest
```

The container listens on `0.0.0.0:3000`. The `node` user inside the
container is uid 1000; the `PORT` env var is honored (`3000` default).

## Behind Caddy

`Caddyfile` at the repo root is the production reverse-proxy. It
expects the Next server on `localhost:3000`:

```bash
caddy run --config Caddyfile
```

What Caddy does:

- HSTS (`max-age=63072000; includeSubDomains; preload`).
- Re-asserts `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options` at the edge (the Next config also sets them).
- Answers `/health` with `200 ok` so uptime checks do not need a real
  app route.
- Forwards everything else to the Next server with
  `Host` / `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto`
  preserved.

## Security headers

All applied by `next.config.ts` at the Next layer; the `Caddyfile`
duplicates the transport-tier ones (HSTS) for clarity. The full set:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (Caddy) |
| `Server` | removed |

`next.config.ts` also sets `poweredByHeader: false` so the
`X-Powered-By: Next.js` header is not emitted.

## What runs at startup

The container's entrypoint is `node server.js` — the file Next emits
for `output: "standalone"`. This is equivalent to `next start` but
without the CLI overhead; it serves the pre-rendered pages, the
`_next/static` assets, and the client-side API routes (none in v1).

`NEXT_TELEMETRY_DISABLED=1` is set in the image. Next otherwise pings
a Vercel endpoint on first start to count self-hosted instances; we
do not need that telemetry.

## Adding a backend

When the analyzer moves from client-side parsing to a server-side
endpoint, the only changes are:

1. Append the backend origin to `connect-src` in the CSP (Next
   config + Caddyfile).
2. Add a Caddy `reverse_proxy` for `/api/*` to the backend's upstream.

The standalone server itself does not change; it stays a static
front-end with `/api/*` proxied through to the analyzer service.
