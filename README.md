# Plexsol Business Manager

Internal subscription, client project, maintenance billing, and financial management for **Plexsol Technologies**.

## Tech stack

| Layer | Technology |
| --- | --- |
| Web | React + Vite + TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Zod |
| API | Express.js + TypeScript |
| Worker | Node.js background process (PostgreSQL-backed jobs in later phases) |
| Data | Prisma ORM + Neon PostgreSQL |
| Monorepo | pnpm workspaces |

## Repository structure

```text
apps/
  web/       React frontend
  api/       Express API
  worker/    Background worker
packages/
  database/  Prisma schema + client
  shared/    Shared Zod schemas, types, brand constants
```

## Prerequisites

- Node.js **20.19+** (22.x recommended)
- [pnpm](https://pnpm.io) **10+**
- A [Neon](https://neon.tech) PostgreSQL project (or local Postgres via Docker)

## Environment variables

1. Copy the example file:

```bash
cp .env.example .env
```

2. Set `DATABASE_URL` to your **Neon** connection string from the Neon console.  
   Do **not** invent credentials. Leave other secrets as placeholders until later phases.

Documented variables (see `.env.example`):

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | database / api / worker | Neon PostgreSQL connection string |
| `DIRECT_URL` | database (optional) | Direct (non-pooled) URL for migrations |
| `API_PORT` / `API_HOST` | api | HTTP listen address |
| `CORS_ORIGIN` | api | Allowed browser origin |
| `SESSION_SECRET` | api (Phase 3+) | Cookie signing secret |
| `VITE_API_URL` | web | API base URL (optional; Vite proxy used in dev) |
| `WORKER_POLL_INTERVAL_MS` | worker | Idle poll interval |
| `WORKER_ENABLED` | worker | Enable/disable worker process |
| `WORKER_HEALTH_PORT` | worker | Optional HTTP health port (`/health`, `/health/ready`); `0` disables |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | worker | Optional SMTP transport (console fallback when host empty) |
| `EMAIL_FROM` | worker | From address for outbound email |

Full production notes: [`docs/deployment.md`](docs/deployment.md).

## Getting started

```bash
# Install dependencies
pnpm install

# Generate Prisma client (requires DATABASE_URL in env)
pnpm db:generate

# Build shared packages
pnpm --filter @plexsol/shared build
pnpm --filter @plexsol/database build

# Run all apps (web :5173, api :4000, worker)
pnpm dev
```

Or start individually:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

### Optional local Postgres

```bash
docker compose up -d
```

Then point `DATABASE_URL` at `postgresql://plexsol:plexsol@localhost:5432/plexsol_business_manager`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start web, api, and worker in parallel |
| `pnpm build` | Build all packages/apps |
| `pnpm typecheck` | TypeScript checks across the monorepo |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm db:generate` | `prisma generate` |
| `pnpm db:push` | `prisma db push` (needs real DB) |
| `pnpm db:migrate` | `prisma migrate dev` (needs real DB) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:test` | Database unit/integration tests |
| `pnpm test:api` | API integration tests |
| `pnpm build` | Production build (shared → apps) |

## Health check

With the API running:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
```

Worker (when `WORKER_HEALTH_PORT=4010`):

```bash
curl http://localhost:4010/health
curl http://localhost:4010/health/ready
```

Liveness returns `status: "ok"`. Readiness also checks Neon/`DATABASE_URL` connectivity.

## Design

- Primary accent: **Plexsol Orange** `#F15A24`
- Surfaces: white / off-white
- Typography: charcoal / black
- Official logo: `apps/web/public/brand/plexsol_logo.png`
- Logo policy: use `official` variant on dark surfaces (login); use `light` CSS mark on the white/off-white app shell (PNG includes a baked black background)

## Database (Phase 2)

Prisma models cover users/sessions/settings, clients/projects, maintenance agreements & billing cycles, client payments & allocations, subscriptions/renewals/expenses, currencies & historical exchange rates, payment methods, notifications, scheduled events, email templates/jobs/delivery attempts, and audit logs.

Financial invariants are enforced with PostgreSQL `CHECK` constraints and triggers (allocation ownership, XOR targets, over-allocation prevention) plus transactional helpers in `@plexsol/database`.

```bash
pnpm db:migrate:deploy   # apply migrations
pnpm db:generate         # generate Prisma Client
pnpm db:seed             # reference data only (currencies, methods, templates, admin)
pnpm db:test             # financial invariant tests
```

Seed refuses to run in `production` unless `ALLOW_DB_SEED=true`. It does **not** insert sample clients, payments, or projects.

## Authentication (Phase 3)

- Argon2id passwords, PostgreSQL sessions, httpOnly cookie `plexsol_session`
- Login rate limiting (default 5 / 15 min per IP+email)
- Protected API routes under `/api/secure/*` and `/api/auth/me`

```bash
pnpm db:seed          # writes Argon2id admin hash (SEED_ADMIN_PASSWORD)
pnpm dev:api
pnpm dev:web
pnpm test:api         # auth integration tests
# Sign in: admin@plexsol.com / value of SEED_ADMIN_PASSWORD
```

## Phase status

**Phase 8 — Reports, Production Readiness, and Deployment** (done)

- Reports: income/expenses/net cash flow, outstanding balances, maintenance recurring, renewal forecasts, project summaries (ETB snapshots)
- Monthly / yearly / custom filters; live `/api/dashboard` + `/reports` UI
- API + worker readiness probes; Docker images + `docs/deployment.md` (no unapproved production deploys)

**Phase 7 — Background Jobs, Notifications, and Email** (done)

- Separate PostgreSQL-backed worker with SKIP LOCKED claims, leases, crash recovery, idempotency
- Subscription / maintenance-due reminders; overdue drafts require admin approval
- Console or SMTP email transport, delivery attempts (max 3), in-app notifications UI

**Phase 6 — Payments & Maintenance Billing** (done)

- Client payment receipts with ETB FX snapshots; flexible multi-target allocations
- Maintenance agreements with explicit activation; monthly/yearly cycles (month-end clamping)
- Outstanding balances per client/project/cycle; concurrency-safe allocation locks
- Tests: `packages/database/tests/billing-cycles.test.ts`, `apps/api/tests/payments-maintenance.test.ts`

**Phase 5 — Core Business Modules** (done)

- CRUD for clients, projects, subscriptions (+ renewals), expenses, categories, payment methods
- Renewal confirms payment + new expiration, creates expense atomically, cancels obsolete reminders
- Projects track agreed price and lifecycle independently of payment status
- API integration tests in `apps/api/tests/core-modules.test.ts`

**Phase 4 — Dashboard UI** (done)

- KPI cards, Recharts overview, attention panel, summaries, transactions, renewals (ETB)
- Live `/api/dashboard` (fixtures only if API returns 404/501)

**Phase 3 — Authentication & Application Layout** (done)

- Login/logout, session cookies, protected routes, responsive branded shell

**Phase 2 — Database & Prisma Schema** (done)

- Full schema, migration, seed (reference data), financial helpers, automated invariant tests

**Phase 1 — Project Foundation** (done)

- Monorepo tooling, shared packages, Prisma Neon config, health API, worker process, branded frontend shell

See `docs/roadmap/phase-08.md` and `docs/deployment.md`.
