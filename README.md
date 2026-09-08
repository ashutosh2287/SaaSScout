# Sasscout

**SaaS-spend audit and decision support for small businesses.**

Sasscout is a lightweight SaaS-spend audit and decision tool. A business uploads
financial transaction files (CSV/XLSX) and Sasscout discovers software/SaaS
spending, recurring payments, spending changes, and other software-spend
review signals. Every finding is labelled by confidence and presented as a
review signal, never as a confirmed wasteful or unused subscription.

> **Core philosophy: Decision quality, not transaction detection.**

Sasscout is **not** a consumer subscription tracker and **not** an
enterprise SaaS-management platform.

## Current Status

**Functional core complete and local-first.** The analysis pipeline (parse →
quality → merchant → classification → recurring → software → review → dashboard
→ report → compare → local persistence → export) is fully implemented and runs
entirely in the browser; transaction data never leaves the device. The backend
is a minimal Hono API exposing only `GET /health` with a dev-safe CORS
allow-list and a uniform JSON error envelope.

**Shipped (committed on `main`):** Steps 22–28 cover the remaining product
findings — intra-period overlap detection (`possible_overlap`), unclear-ownership
signals (`unclear_ownership`), and multi-file / cross-source upload with a
per-source software-spend breakdown. Phase B added a Playwright + axe E2E harness
(7 specs, CI job). Phase C added a multi-stage Dockerfile, `next.config.ts`
security headers, a Caddyfile with `/health` and HSTS, a 6-month sample CSV, and
`docs/deployment-frontend.md`.

**Remaining work — premium experience polish (Phase D, ~3–5 days):** design
system audit, animation system wiring, premium landing copy pass, data viz
polish, loading/empty/error states, responsive browser QA, production deploy.
See `docs/STEP-LAUNCH-PLAN.md`.

**Deliberately deferred post-launch:** auth, database, cloud storage, AI/LLM
analysis, payments, and telemetry.

> **Git note:** commits were re-labelled during development. The current tip is
> labelled "Phase C" and sits above commits labelled "Step 21–37". Gate truth:
> frontend 868 tests (45 files), backend 46 tests — all green on lint/tsc/build,
> plus Playwright 7/7 on a dev server.

## Project Structure

```
sasscout/
│
├── frontend/          # Next.js + TypeScript + Tailwind CSS web app
│   ├── app/
│   ├── public/
│   └── ...
│
├── backend/            # Node.js + TypeScript (Hono) API
│   ├── src/
│   │   ├── index.ts    # Server entry point
│   │   └── app.ts      # Hono app (routes)
│   └── ...
│
├── README.md
├── .gitignore
└── ...
```

The frontend and backend are intentionally decoupled. They communicate over
HTTP APIs and can be developed and deployed independently.

## Frontend

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS

### Setup and run

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000` by default.

### Environment

Copy `frontend/.env.example` to `frontend/.env.local` and adjust as needed:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

`NEXT_PUBLIC_API_URL` is the base URL of the backend API, consumed by the
frontend API client in `src/lib/api/`. It is used for the `/health` connectivity
check backing the service-status indicator (see `src/lib/api/health.ts`); the
analysis pipeline never sends transaction data to this URL. When it is unset the
indicator shows "Backend not configured" and the app stays fully usable. Since
`NEXT_PUBLIC_*` values ship in the public client bundle, never place a secret
here — it is a public base URL only.

## Backend

- **Framework:** Hono
- **Language:** TypeScript, Node.js
- **Endpoint:** `GET /health` → `{ "status": "ok" }`
- **Consumes:** none — the analysis pipeline stays local in the frontend

See [`docs/backend-api.md`](docs/backend-api.md) for the full API contract,
error format, development CORS, and the privacy boundary.

### Setup and run

```bash
cd backend
npm install
npm run dev
```

The backend listens on `http://localhost:3001` by default (configurable via the
`PORT` environment variable).

### Environment

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

```
PORT=3001
```

## Development Commands

Each application is independently runnable. The frontend does not require the
backend to start, and the backend does not require the frontend to start.

| Application | Command         | Description          |
| ----------- | --------------- | -------------------- |
| Frontend    | `npm run dev`   | Start dev server     |
| Frontend    | `npm run lint`  | Lint                 |
| Frontend    | `npm run build` | Production build     |
| Frontend    | `npm test`      | Run unit tests       |
| Frontend    | `npm run test:e2e` | Run Playwright E2E + axe |
| Frontend    | `docker build -t sasscout-frontend . && docker run -p 3000:3000 sasscout-frontend` | Build & run the container |
| Backend     | `npm run dev`   | Start dev server     |
| Backend     | `npm run typecheck` | Type check        |
| Backend     | `npm run build` | Compile to `dist/`   |
| Backend     | `npm test`      | Run unit tests       |

## License

Not yet decided.
