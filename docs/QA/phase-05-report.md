# Phase 05 QA Report — Core Business Modules

| Field | Value |
| --- | --- |
| Phase | Phase 5 — Core Business Modules |
| Audit date | 2026-11-23 |
| Auditor | Independent QA session (separate from implementation) |
| Overall result | **NOT READY** |
| Spec source | Official `docs/roadmap/phase-05.md` is a **placeholder**. Checklist reconstructed from README “Phase status” (and existing placeholder reconstruction note). Canonical requirements not authored. |

## Executive summary

Phase 5 implements authenticated CRUD for clients, projects, subscriptions (with renewals), expenses, expense/subscription categories, and payment methods, plus matching web list/detail/forms under the app shell. Renewal confirmation uses `confirmSubscriptionRenewal` in a single DB transaction: linked renewal expense, subscription expiration/amount update, cancel obsolete `SUBSCRIPTION_REMINDER` events, audit log. Projects carry `agreedPrice` / lifecycle independently of payments. Migration `20261123120000_phase5_core_modules` is present.

Automated verification this run: **typecheck** PASS, **lint** PASS, **web build** PASS, **api build** PASS, **API tests** 13/13 PASS (`core-modules` 8 + `auth` 5), **database invariant tests** 9/9 PASS (includes one-expense-per-renewal).

Browser (localhost `:5174` / API `:4000`): Clients create (“QA Phase5 Client”), Subscriptions list + Renew dialog, Projects list, Settings payment-methods tab — all rendered under authenticated Admin session.

**Blocking finding:** the UI (and default API call path) can renew non-ETB subscriptions without collecting `amountEtb` or `exchangeRateId`. Live probe against an existing USD subscription returned **400** `renewal_error`: *“amountEtb or exchangeRateId is required for non-ETB renewals”*. Expenses UI already handles `amountEtb`; renewals UI does not. This breaks a core Phase 5 renewal workflow for allowed non-ETB currencies → **HIGH**.

No CRITICAL security breaches found in Phase 5 scope (routes require session). Role-based restriction on business CRUD is absent (auth-only) — MEDIUM for later multi-role use.

Business rules for maintenance billing, client payment allocations, email approval/retry delivery are **NOT APPLICABLE** (explicitly out of scope this phase). Historical FX is only partially wired (helper supports rates; renew UI does not).

## Documentation gaps

| Expected file | Status | Action |
| --- | --- | --- |
| `docs/roadmap/phase-05.md` | Placeholder (reconstruction from README) | Author canonical Phase 5 AC |
| `docs/roadmap/master-prompt.md` | Still missing/placeholder | Unchanged |
| `docs/QA/PHASE-VERIFICATION.md` | Present | Reviewed; not overwritten |
| Prior reports | Present | Reviewed (`phase-04` READY after recheck) |

## Requirements verification matrix

### Acceptance criteria (README / phase-05 reconstruction)

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| CRUD clients | **PASS** | API routes + `core-modules` test; UI create “QA Phase5 Client” persisted in list | Delete blocked with 409 when projects/payments exist |
| CRUD projects (agreed price + lifecycle independent of payment) | **PASS** | API create/patch agreedPrice & status; UI projects page; migration adds `agreed_price` | Payments module still placeholder (expected) |
| CRUD subscriptions (+ renewals) | **FAIL** | ETB renew path covered by API test; UI Renew dialog present | Non-ETB renew broken via UI/API without FX fields — **DEF-P5-01** |
| Renewal confirms payment + new expiration, creates expense atomically, cancels obsolete reminders | **PASS** (ETB / API+DB) | `confirmSubscriptionRenewal`; `core-modules` + `financial-invariants` | Reminder cancel only; no reschedule (acceptable for this phase scope) |
| CRUD expenses | **PASS** | API + UI; blocks manual `subscription_renewal` category; renewal expenses immutable | UI includes `amountEtb` for non-ETB |
| CRUD categories (subscription + expense) | **PASS** | API + Settings tabs; tests create categories | No `GET /:id` (list-only) — LOW |
| CRUD payment methods | **PASS** | API + Settings; in-use soft deactivate | No `GET /:id` — LOW |
| API integration tests `core-modules.test.ts` | **PASS** | 8/8 tests this run | Does not cover non-ETB renew UI gap |
| Out of scope: maintenance billing, automated email delivery | **NOT APPLICABLE** | Placeholder module pages remain | — |

### Security (Phase 5 applicable)

| Check | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Auth enforcement on core APIs | **PASS** | Unauthenticated `GET /api/clients` → 401 (test); all routers use `createRequireAuth` | — |
| Session / cookie security | **PASS** | Prior Phase 3 + auth suite this run | — |
| Role-based authorization on business CRUD | **FAIL** (incomplete) | `requireRole` unused on core module routes | DEF-P5-02 — any authenticated user can renew/CRUD |
| Input validation | **PASS** | Zod schemas; empty client name → 400 | Renewal catch-all maps DB errors to 400 (DEF-P5-03) |
| Financial integrity (renewal expense uniqueness) | **PASS** | DB test + unique expense link | — |
| Cross-client payment allocation | **NOT APPLICABLE** | Payments phase later | Invariant tests still green from Phase 2 |
| Secret management | **PASS** | `.env` gitignored | Do not commit real Neon URLs |

### Business rules (phase-scoped only)

| Check | Status | Notes |
| --- | --- | --- |
| Subscription expiration / renewal | **FAIL** (non-ETB UI) | ETB API path PASS; DEF-P5-01 |
| Renewal expense consistency | **PASS** | One linked expense; manual renewal category blocked |
| Client project payments / flexible allocations | **NOT APPLICABLE** | — |
| Partial maintenance payments | **NOT APPLICABLE** | — |
| Historical exchange rates | **BLOCKED** / incomplete for renew UI | Helper supports `exchangeRateId`; UI does not collect it |
| Scheduled reminders (cancel on renew) | **PASS** | Cancel PENDING/AWAITING_APPROVAL/APPROVED |
| Email approval / retry delivery | **NOT APPLICABLE** | Worker later |

### Visual / UX (module pages)

| Check | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Orange / white / charcoal shell consistency | **PASS** | Module pages use shared shell + CRUD primitives | — |
| Tables / forms / dialogs | **PASS** | Clients, Subscriptions Renew dialog, Settings | — |
| Loading / empty states | **PASS** (code + list UIs) | `EmptyState` / `Spinner` in feature pages | Empty not forced this run |
| Desktop layout | **PASS** | 1280×900 | — |
| Mobile | **NOT VERIFIED** this run | — | Limitation |

### Prior open items (carry-forward)

| ID | Status |
| --- | --- |
| DEF-P2-03 Prisma CLI root `.env` | **OPEN** — not re-run this audit as Phase 5 blocker (runtime tests used DB successfully) |
| DEF-P2-04 / roadmap placeholders | **OPEN** — phase-05 placeholder remains |
| DEF-P3-01 ownership helper unused | **OPEN** — related to DEF-P5-02 |
| DEF-P4-* | Assumed addressed per phase-04 recheck note; not re-audited |

## Test execution results

### Commands executed (this audit)

| Command | Result |
| --- | --- |
| `pnpm typecheck` | **PASS** |
| `pnpm lint` | **PASS** |
| `pnpm --filter @plexsol/web build` | **PASS** (chunk size warning only) |
| `pnpm --filter @plexsol/api build` | **PASS** |
| `pnpm test:api` | **PASS** — 13 tests (8 core-modules + 5 auth) |
| `pnpm db:test` | **PASS** — 9 financial invariant tests |
| Prisma CLI `validate` | **SKIPPED** this run (known DEF-P2-03) |
| Frontend e2e suite | **SKIPPED** — none present |
| Live API probe: USD renew without `amountEtb` | **FAIL as expected** — 400 `renewal_error` |

### Browser / workflow

| Scenario | Result |
| --- | --- |
| Clients list + create | **PASS** |
| Subscriptions list + Renew dialog open | **PASS** (dialog present; non-ETB submit would fail — DEF-P5-01) |
| Projects list | **PASS** |
| Settings → Payment methods | **PASS** |
| Expenses page deep interact | **PARTIAL** — code review only this run |
| Mobile layout | **SKIPPED** |

### Working tree note

Phase 5 implementation is largely **uncommitted** on `main` (many `??` route/feature files). Audit verified the working tree as present on disk, not a published release.

## Defects

### DEF-P5-01 — Non-ETB subscription renewal fails without FX fields; UI does not collect them

| Field | Detail |
| --- | --- |
| Severity | **HIGH** |
| Affected | `apps/web/src/features/subscriptions/subscriptions-page.tsx`; `packages/database/src/finance/renewals.ts` (requirement); API `POST /api/subscriptions/:id/renewals` |
| Reproduction | 1) Open a USD subscription (e.g. existing GitHub fixture). 2) Click Renew (currency prefilled USD). 3) Confirm without `amountEtb` / rate. Or API: renew with `currencyCode: "USD"` only. |
| Expected | UI collects ETB amount or historical exchange rate (or forces ETB); renewal succeeds and creates expense with `amountEtb`. |
| Actual | API returns 400: `amountEtb or exchangeRateId is required for non-ETB renewals`. Expenses form already has `amountEtb`; renew form does not. |
| Recommended fix | Add `amountEtb` and/or exchange-rate picker to renew dialog; or restrict renew currency to ETB until FX UX exists; add API/UI test for non-ETB renew. |

### DEF-P5-02 — No role checks on core business module routes

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** |
| Affected | `apps/api/src/routes/{clients,projects,subscriptions,expenses,*-categories,payment-methods}.ts` |
| Reproduction | Authenticate as any role that can log in; call mutating core endpoints. |
| Expected | Financial mutations (especially renewals) limited to appropriate roles (e.g. ADMIN / designated staff) per product policy. |
| Actual | Session auth only; `requireRole` unused outside demo routes. |
| Recommended fix | Apply `requireRole` (or finer permissions) once role matrix is defined; cover in tests. |

### DEF-P5-03 — Subscription renewal maps all failures to HTTP 400

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Affected | `apps/api/src/routes/subscriptions.ts` renewals `catch` |
| Reproduction | Call renew for a non-existent subscription id. |
| Expected | 404 for missing subscription; 400 for validation/business rule failures. |
| Actual | Broad catch → 400 `renewal_error` (can mask not-found). |
| Recommended fix | Map Prisma `P2025` / known errors to correct status codes. |

### DEF-P5-04 — Categories / payment methods lack GET-by-id

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Affected | category & payment-method routers |
| Reproduction | `GET /api/payment-methods/:id` |
| Expected | Optional detail endpoint for symmetry with other resources. |
| Actual | 404 / not implemented; list + mutate only. |
| Recommended fix | Add if clients need it; otherwise document as intentional. |

## Remaining issues / verification limitations

1. Official Phase 5 roadmap text still placeholder — AC based on README reconstruction.
2. Mobile layout not re-checked this run.
3. Full UI renewal of ETB subscription not re-submitted in browser (API covered); non-ETB failure proven via live API.
4. Reminders cancelled but not rescheduled — deferred to later worker/email phases.
5. Prisma CLI validate not re-proven (DEF-P2-03).
6. Phase 5 code mostly uncommitted — ensure migration + seed category `subscription_renewal` are applied in each environment before release.

## Final acceptance decision

**NOT READY**

Rationale: Core CRUD and ETB atomic renewal are substantially implemented and tested, but **DEF-P5-01** is a high-severity defect against the Phase 5 renewal acceptance criterion for any non-ETB subscription the product already allows. Per QA rules, READY FOR NEXT PHASE is disallowed while a required AC fails or a high-severity defect remains.

Re-audit after: renew UI/API collects `amountEtb` or exchange rate (or locks renewals to ETB), plus a regression test; optionally tighten role checks (DEF-P5-02).
