# phase-08.md — Reports, Production Readiness, and Deployment

## Scope

- Reporting module (ETB via historical snapshots): income, expenses, net cash flow, outstanding balances, maintenance recurring revenue, subscription renewal forecasts, project summaries
- Monthly / yearly / custom date filters
- Live dashboard backed by the same reporting engine
- Responsive UI polish, accessibility, consistent empty/loading/error states
- Automated tests for financial calculations, renewals, billing cycles, authorization, background jobs
- Managed hosting readiness: Docker images for web/api/worker, Neon PostgreSQL, health probes
- Deployment + environment documentation

## Explicit non-goals

- Deploying or mutating production data without explicit approval
- Auto-activating maintenance from project delivery
- Replacing Neon with self-hosted Postgres in production

## Acceptance criteria

- Critical workflows pass automated tests
- No known financial reconciliation defects
- No exposed secrets in the repo
- Production build succeeds
- API and worker expose health monitoring
- Deployment steps are documented (`docs/deployment.md`)

## Key surfaces

- `packages/database/src/reports/*`
- `GET /api/reports`, `GET /api/dashboard`
- `GET /health`, `GET /health/ready` (API); worker health on `WORKER_HEALTH_PORT`
- `Dockerfile.{api,worker,web}`, `docker-compose.prod.yml`
- Web: `/reports`, live dashboard
