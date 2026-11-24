# Final Automated Test Results — System Audit

| Field | Value |
| --- | --- |
| Audit date | 2026-11-24 |
| Git HEAD | `daf91b3d256f2096c9c9eb37957b7642d009c0e1` |
| App version | `0.1.0` (package.json) |

## Commands executed

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm typecheck` | 0 | **PASS** — shared, database, api, worker, web |
| `pnpm lint` | 0 | **PASS** — max-warnings=0 all packages |
| `pnpm build` | 0 | **PASS** — web chunk-size warning only |
| `pnpm test:api` | 0 | **PASS** — 29 tests / 4 files |
| `pnpm db:test` | 0 | **PASS** — 23 tests / 4 files |
| `prisma migrate status` (with `DATABASE_URL` loaded) | 0 | **PASS** — 4 migrations; schema up to date |
| `pnpm --filter @plexsol/database exec prisma migrate status` (no env) | 1 | **FAIL** — P1012 missing `DATABASE_URL` (**DEF-P2-03** / **DEF-FS-11**) |
| `node docs/QA/_audit-probe.mjs` | 0 | Live API probe (see findings) |
| `node docs/QA/_e2e-scenarios.mjs` | 1* | S1–S6 **PASS**; aborted on S7 date bug in probe |
| `node docs/QA/_e2e-s7-s8.mjs` | 0 | S7–S8 **PASS** |
| `node docs/QA/_dash-debug.mjs` | 0 | Dashboard KPIs match report totals |
| `docker compose … build` | — | **NOT EXECUTED** |
| Playwright e2e | — | **NOT EXECUTED** (suite absent) |
| Live SMTP send | — | **NOT EXECUTED** (console transport used) |
| Worker `:4010/health` | — | **DOWN** during audit |
| `pnpm audit` / dependency CVE scan | — | **NOT EXECUTED** |

\* Exit 1 due to probe script error on S7 only; product scenarios S1–S6 already recorded PASS.

## API test breakdown (`pnpm test:api`)

| File | Tests | Result |
| --- | --- | --- |
| `auth.test.ts` | 5 | PASS |
| `core-modules.test.ts` | 12 | PASS |
| `payments-maintenance.test.ts` | 6 | PASS (includes ETB `amountEtb` reject + concurrency) |
| `reports-notifications.test.ts` | 6 | PASS (slow report/dashboard ~35s each) |
| **Total** | **29** | **PASS** |

## Database test breakdown (`pnpm db:test`)

| File | Tests | Result |
| --- | --- | --- |
| `financial-invariants.test.ts` | 9 | PASS |
| `billing-cycles.test.ts` | 3 | PASS |
| `jobs.test.ts` | 8 | PASS |
| `reports.test.ts` | 3 | PASS |
| **Total** | **23** | **PASS** |

## Live probes (non-suite)

| Check | Result |
| --- | --- |
| `GET /health` | PASS (200) |
| Unauthenticated `GET /api/clients` | PASS (401) |
| Login + cookie session | PASS (200) |
| `GET /api/reports?preset=month&month=2026-11` | PASS — income 42522.45 / expenses 115260.00 / net -72737.55 |
| `GET /api/dashboard?period=2026-11` | PASS after retry — KPIs match report (`match: true`); earlier probe saw intermittent **500** under load |
| `POST /api/exchange-rates` | **FAIL** — 404 (route not implemented) |
| `GET /api/settings` | **FAIL** — 404 (no settings router) |
| Worker health port 4010 | **DOWN** |
| ETB renewal with mismatched `amountEtb` | **DEFECT** — accepted amount=100 / amountEtb=999 |

## Coverage gaps (important untested / under-tested logic)

1. No Playwright browser workflow suite.
2. No API test for ETB renewal `amountEtb` mismatch (payments covered; renewals not).
3. No API create/update for exchange rates (feature missing).
4. No dedicated HTTP tests for approve/reject email beyond jobs helper coverage (DEF-P7-02 still relevant).
5. Email crash-after-successful-SMTP duplicate send not covered by an automated negative test.
6. Docker image builds not verified.
7. Mobile layout not re-verified this audit.
8. Yearly maintenance cycle path lightly covered vs monthly.
