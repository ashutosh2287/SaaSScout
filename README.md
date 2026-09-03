# Sasscout

**SaaS-spend audit and decision support for small businesses.**

Sasscout is a lightweight SaaS-spend audit and decision tool. It will eventually
let a business upload financial transaction files (CSV/XLSX) and discover
software/SaaS spending, recurring payments, spending changes, new recurring
charges, overlapping tools, vendors without owners, vendors across multiple
payment sources, and other software-spend findings.

> **Core philosophy: Decision quality, not transaction detection.**

Sasscout is **not** a consumer subscription tracker and **not** an
enterprise SaaS-management platform.

## Current Status

**Step 27 — Frontend backend health integration & service boundary.** The
analysis pipeline (parse → quality → merchant → classification → recurring →
software → review/leak → dashboard → report → local persistence) is fully
implemented and runs **local-first** in the frontend; transaction data never
leaves the browser. The backend is a minimal, secure Hono API foundation
exposing a single `GET /health` endpoint with explicit dev-safe CORS, a uniform
JSON error envelope, and no sensitive leakage. The frontend exposes a typed
`src/lib/api` boundary that only calls `/health`. STEP 27 adds a single
service-status abstraction (`src/lib/api/health.ts`) and a presentation-only
`ServiceStatusBar` mounted in the root layout that reports
available / unavailable / not-configured / checking with one bounded health
check per page. The status bar never affects upload, parsing, analysis,
export, save, or saved reports — the product stays fully usable when the
backend is down or unconfigured.

Not yet implemented (deferred to future steps): authentication, database,
cloud storage, AI/LLM analysis, payments/subscriptions, analytics, and
telemetry. The backend intentionally has no such functionality yet.

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
| Backend     | `npm run dev`   | Start dev server     |
| Backend     | `npm run typecheck` | Type check        |
| Backend     | `npm run build` | Compile to `dist/`   |
| Backend     | `npm test`      | Run unit tests       |

## License

Not yet decided.
