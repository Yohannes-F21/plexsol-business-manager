# Known Issues Register — Final System Audit

Open defects identified or reconfirmed during the 2026-11-24 complete system audit. Phase reports are not overwritten.

| ID | Severity | Module | Status | Summary |
| --- | --- | --- | --- |
| DEF-FS-01 | **HIGH** | Renewals / FX | **FIXED** | ETB renewals reject mismatched `amountEtb` (Zod + helper + API test) |
| DEF-FS-02 | **HIGH** | Exchange rates | **FIXED** | `POST /api/exchange-rates` (ADMIN) + Settings → Exchange rates UI |
| DEF-FS-03 | **HIGH** | Email / worker | **FIXED** | SUCCESS attempt before SENT; recover finalizes SENT; transport idempotency key |
| DEF-FS-04 | **MEDIUM** | Dashboard | **FIXED** | Upcoming renewals filtered to `daysRemaining <= 30` |
| DEF-FS-05 | **MEDIUM** | Email | **FIXED** | `nextAttemptAt` backoff (60s / 300s) before claim |
| DEF-FS-06 | **MEDIUM** | Reports / Dashboard | **FIXED** | Aggregates + batched FX cache; fewer N+1 queries |
| DEF-FS-07 | **MEDIUM** | Settings | **FIXED** | `/api/settings` + Reminders & email + FX Settings UI |
| DEF-FS-08 | **MEDIUM** | Ops / Git | OPEN | Phases 6–8 largely uncommitted on `main` (process — commit when approved) |
| DEF-FS-09 | **LOW** | QA | OPEN | No Playwright browser e2e suite (coverage gap; helper E2E exists) |
| DEF-FS-10 | **LOW** | Notifications | **FIXED** | Entity alerts marked read on approve/reject/cancel/sent |
| DEF-FS-11 | **MEDIUM** | Tooling | **FIXED** | Prisma CLI scripts load root `.env` via `scripts/run-prisma.mjs` |
| DEF-P8-01 | **MEDIUM** | Reports | **FIXED** | Same as DEF-FS-06 |
| DEF-P7-02 | **LOW** | Notifications API | **FIXED** | HTTP approve/reject (+ settings) covered in API tests |
| DEF-P6-02 | **LOW** | Payments UI | **FIXED** | List primary link is amount (+ client/date/reference subtitle) |

## Resolved prior defects (spot-checked)

| ID | Status |
| --- | --- |
| DEF-P6-01 ETB payment `amountEtb` mismatch | **RESOLVED** — payments helper + API test reject mismatch |
| DEF-P7-01 core-modules renewal reminder assertion | **RESOLVED** — API tests green |
| DEF-P5-01 non-ETB renew without FX | **RESOLVED** in API/UI path (non-ETB requires FX) |
| DEF-P2-01 credentials in `.env.example` | **RESOLVED** (placeholders) |

## Documentation gaps

| File | Status |
| --- | --- |
| `docs/roadmap/master-prompt.md` | Placeholder only |
| `docs/roadmap/phase-04.md` / `phase-05.md` | Placeholder / reconstruction notes |
| Phase 06–08 roadmap + QA reports | Present |

## Remaining (non-code / deferred)

1. **DEF-FS-08** — Commit/review Phase 6–8 when you explicitly want a git commit.
2. **DEF-FS-09** — Optional Playwright suite (not required for financial correctness; E2E helper probes exist).
