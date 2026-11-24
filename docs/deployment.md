# Deployment — Plexsol Business Manager

Managed hosting deployment for the **React web**, **Express API**, and **persistent worker**, with **Neon PostgreSQL**.

> Do **not** deploy or mutate production data without explicit approval.

## Architecture

| Process | Role | Health |
| --- | --- | --- |
| `apps/web` | Static SPA (Vite build) | HTTP `/` via nginx |
| `apps/api` | Express API + sessions | `GET /health` (liveness), `GET /health/ready` (DB) |
| `apps/worker` | PostgreSQL job processor | `GET /health`, `GET /health/ready` on `WORKER_HEALTH_PORT` |
| Neon | Managed Postgres | Neon console / connection checks |

The worker **must** run as a long-lived process (never serverless on a request timeout). Email reminders and overdue drafts depend on it.

## Prerequisites

1. Neon project with pooled `DATABASE_URL` and (recommended) direct `DIRECT_URL` for migrations.
2. Node.js 20.19+ / 22.x for local builds; Docker optional for image deploys.
3. Strong `SESSION_SECRET` (≥16 chars) and production `CORS_ORIGIN` matching the web origin.
4. SMTP credentials only if you want real email delivery (otherwise console transport).

## Environment variables

See root [`.env.example`](../.env.example). Production checklist:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** URL for API/worker runtime |
| `DIRECT_URL` | Recommended | Neon direct URL for `prisma migrate deploy` |
| `SESSION_SECRET` | Yes (API) | Unique per environment; never commit |
| `CORS_ORIGIN` | Yes (API) | Exact web origin, e.g. `https://app.example.com` |
| `VITE_API_URL` | Yes (web build) | Public API origin baked into the SPA |
| `WORKER_ENABLED` | Yes | `true` in production |
| `WORKER_HEALTH_PORT` | Recommended | e.g. `4010` for probes |
| `SMTP_*` / `EMAIL_FROM` | Optional | Leave host empty for console logging |

Never commit `.env` or real credentials. Rotate secrets if exposed.

## Database migrate (staging / production)

From a CI job or bastion with network access to Neon:

```bash
pnpm install --frozen-lockfile
pnpm --filter @plexsol/database generate
pnpm db:migrate:deploy
```

Seed is **development reference only**. Do not run `pnpm db:seed` against production unless explicitly approved (`ALLOW_DB_SEED=true`).

## Docker Compose (self-managed / preview)

```bash
# After filling a production-shaped .env (not committed)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Services:

- API → host `:4000`
- Worker health → host `:4010`
- Web → host `:8080`

## Managed platforms (Render / Railway / Fly-style)

Create **three** services from the same repo:

1. **API** — build with `Dockerfile.api` (or `pnpm build` + `pnpm --filter @plexsol/api start`). Health path `/health/ready`.
2. **Worker** — build with `Dockerfile.worker`. Persistent disk not required; keep process awake. Health path `/health/ready` on `WORKER_HEALTH_PORT`.
3. **Web** — build with `Dockerfile.web` and build-arg `VITE_API_URL=https://api.example.com`, or static host (`pnpm --filter @plexsol/web build` → upload `apps/web/dist`).

Point all services at the same Neon database. Set `CORS_ORIGIN` to the web URL.

### Suggested health probes

- API liveness: `GET /health`
- API readiness: `GET /health/ready` (fails closed if DB down)
- Worker: `GET http://worker:4010/health` and `/health/ready`

## Production build (local verification)

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm db:test
pnpm test:api
```

Do not treat a green local build as a production deploy authorization.

## Post-deploy smoke checklist

1. `GET /health` and `/health/ready` on API return `ok`.
2. Worker health port returns `ok`; logs show tick completions.
3. Login works over HTTPS with secure cookies (`NODE_ENV=production`).
4. Dashboard and Reports load live ETB figures (not fixture banner).
5. Create a payment / expense and confirm Reports income/expense move.
6. Confirm overdue email drafts still require admin approval.

## Rollback

1. Redeploy previous container image / release.
2. Database migrations are forward-only unless a reviewed down migration exists — prefer restore from Neon point-in-time recovery with approval.
