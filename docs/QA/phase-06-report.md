# Phase 06 QA Report — Payments & Maintenance Billing

| Field | Value |
| --- | --- |
| Phase | Phase 6 — Payments & Maintenance Billing |
| Audit date | 2026-11-23 |
| Auditor | Independent QA session (separate from implementation) |
| Overall result | **READY FOR NEXT PHASE** |
| Spec source | Official `docs/roadmap/phase-06.md` (acceptance criteria present) + README Phase status |

## Executive summary

Phase 6 delivers client payment receipts with ETB reporting snapshots, flexible multi-target allocations (project XOR billing cycle, including batch), maintenance agreements with explicit activation, monthly/yearly cycle generation with month-end clamping, outstanding balances, and concurrency-safe over-allocation prevention (app checks + PostgreSQL triggers). Frontend modules exist at `/payments`, `/payments/:id` (allocate), and `/maintenance` (agreements + cycles).

Automated verification this run: **typecheck** PASS, **lint** PASS, **web/api builds** PASS, **API tests** 22/22 PASS (including `payments-maintenance` 5), **database tests** 12/12 PASS (`billing-cycles` 3 + financial invariants 9).

Browser: Payments list, payment detail with allocate UI + outstanding side panel, Maintenance agreements and Billing cycles tables — under authenticated Admin.

All written Phase 6 acceptance criteria **PASS** with test and/or live evidence. No CRITICAL/HIGH defects found in Phase 6 scope.

Non-blocking: API allows mismatched `amountEtb` on ETB receipts (MEDIUM). Email/reminder workers remain out of scope.

## Documentation gaps

| Expected file | Status | Action |
| --- | --- | --- |
| `docs/roadmap/phase-06.md` | **Present** with AC | Used as source of truth |
| `docs/roadmap/master-prompt.md` | Still placeholder | Unchanged |
| `docs/QA/PHASE-VERIFICATION.md` | Present | Reviewed; not overwritten |
| Prior reports | Present | Reviewed; Phase 5 was NOT READY (DEF-P5-01) — re-checked below |

## Requirements verification matrix

### Acceptance criteria (`docs/roadmap/phase-06.md`)

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| A single receipt can settle multiple obligations | **PASS** | `POST .../allocations/batch` allocates to project + 2 cycles in one transaction (`payments-maintenance` test); UI multi-line allocate form | — |
| Income is never counted twice (receipt is income; allocations apply it) | **PASS** | `createClientPayment` does not allocate; allocations apply receipt balance; schema/triggers maintain `amountAllocated` | Reporting snapshot can diverge if bogus `amountEtb` posted — DEF-P6-01 |
| Partial balances calculate correctly | **PASS** | After partial batch: project outstanding 8500, unapplied 300 (test); balances API + payment detail UI | — |
| Concurrent allocation attempts cannot overpay obligations | **PASS** | Parallel allocate test: one 201 + one 400/409; PG trigger raised over-allocation; cycle `amountAllocated ≤ amount` | — |
| Billing-cycle generation is idempotent | **PASS** | API regenerate `createdCount: 0`, `skipped: 3`; DB test same | Unique index migration `20261123140000_phase6_billing_cycle_unique` |
| Automated tests cover partial and cross-currency payments | **PASS** | Partial multi-target + USD payment with `exchangeRateId` + currency-mismatch reject | — |

### Scope / README checklist

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Client payment receipts with ETB FX snapshots | **PASS** | `createClientPayment`; USD test `amountEtb > 0`; UI FX fields when currency ≠ ETB | DEF-P6-01 allows ETB mismatch via API |
| Flexible multi-target allocations | **PASS** | Batch + single allocate APIs; payment detail UI | — |
| Maintenance agreements + explicit activation | **PASS** | Create with `startDate`; UI “Add agreement”; no auto-create on project COMPLETED (test) | — |
| Monthly/yearly cycles + month-end clamping | **PASS** | `addMonthsClamped` unit cases; month-end cycle generation test; UI frequency MONTHLY/YEARLY | — |
| Outstanding balances per client/project/cycle | **PASS** | `GET /api/balances/clients/:id`; payment detail “Client outstanding” | — |
| Concurrency-safe allocation locks | **PASS** | Trigger `FOR UPDATE` + app asserts; concurrent test | — |
| Do not auto-activate maintenance from project delivery | **PASS** | Test asserts `maintenanceAgreement` falsy on COMPLETED project | — |
| Out of scope: automated email / reminder workers | **NOT APPLICABLE** | Explicit non-goal | — |

### Security (Phase 6 applicable)

| Check | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Auth enforcement | **PASS** | Unauthenticated `GET /api/payments` → 401 (live); routers use `createRequireAuth` | — |
| Business role gate | **PASS** | `requireBusinessAccess` = ADMIN \| STAFF on payments/maintenance/balances | Improves prior DEF-P5-02 for these routes |
| Cross-client allocation prevention | **PASS** | Ownership checks in `allocations.ts`; Phase 2 invariant tests still green | — |
| Currency match obligation | **PASS** | USD payment → ETB project allocate → 400 | — |
| Input validation | **PASS** | Zod schemas; payment error mapper | — |
| Financial integrity (over-allocation) | **PASS** | App + PG triggers | — |
| Secret management | **PASS** | `.env` gitignored | — |

### Visual / UX

| Check | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Module pages in branded shell | **PASS** | Payments + Maintenance screenshots/snapshots; orange active nav | — |
| Tables / forms / allocate UI | **PASS** | Record payment dialog; allocate lines; Generate cycles | — |
| Empty / loading | **PASS** (code + observed loading) | Spinner / EmptyState present | — |
| Mobile | **NOT VERIFIED** this run | — | Limitation |

### Prior Phase 5 defects (spot-check)

| ID | Status this run |
| --- | --- |
| DEF-P5-01 non-ETB renew without FX | **RESOLVED** — `core-modules` now rejects without FX and accepts with `amountEtb`/`exchangeRateId`; renew UI collects those fields |
| DEF-P5-02 no role checks | **PARTIALLY ADDRESSED** for Phase 6 routes via `requireBusinessAccess`; confirm all Phase 5 routers similarly if still required |
| DEF-P5-03 renewal 404 mapping | **RESOLVED** — missing subscription renew → 404 in tests |
| DEF-P5-04 GET-by-id categories/methods | **RESOLVED** — detail-by-id covered in `core-modules` |

## Test execution results

### Commands executed

| Command | Result |
| --- | --- |
| `pnpm typecheck` | **PASS** |
| `pnpm lint` | **PASS** |
| `pnpm --filter @plexsol/web build` | **PASS** |
| `pnpm --filter @plexsol/api build` | **PASS** |
| `pnpm test:api` | **PASS** — 22 tests (core-modules 12, payments-maintenance 5, auth 5) |
| `pnpm db:test` | **PASS** — 12 tests (financial-invariants 9, billing-cycles 3) |
| Live API: login, payments, balances, cycles, unauth 401 | **PASS** |
| Live API: ETB create with mismatched `amountEtb` | **FAIL as defect** — accepted 201 (DEF-P6-01) |
| Frontend e2e suite | **SKIPPED** — none |
| Prisma CLI validate | **SKIPPED** (known DEF-P2-03) |

### Browser / workflow

| Scenario | Result |
| --- | --- |
| `/payments` list + pagination | **PASS** |
| `/payments/:id` receipt, allocations, allocate form, outstanding | **PASS** |
| `/maintenance` agreements + Generate | **PASS** |
| Billing cycles tab table | **PASS** (visual; a11y tree sparse) |
| Mobile | **SKIPPED** |

## Defects

### DEF-P6-01 — ETB payments accept mismatched `amountEtb`

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** |
| Affected | `packages/database/src/finance/payments.ts`; `packages/shared/src/schemas/domain.ts` (`clientPaymentCreateSchema`) |
| Reproduction | `POST /api/payments` with `currencyCode: "ETB"`, `amount: "100.00"`, `amountEtb: "999.00"` |
| Expected | For ETB, `amountEtb` equals `amount` (ignore/reject override) |
| Actual | 201 with `amount=100`, `amountEtb=999` (observed on live API; also found existing row 250/300) |
| Recommended fix | Force `amountEtb = amount` when currency is ETB; Zod refine reject mismatch; add regression test |

### DEF-P6-02 — Payment list primary link shows client name only

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Affected | `apps/web/src/features/payments/payments-page.tsx` |
| Reproduction | Open `/payments`; inspect first column links |
| Expected | Clear payment identity (reference/amount/date) as link text |
| Actual | Link text is client name only (navigates to payment detail correctly) |
| Recommended fix | Link amount or “Client · amount · date” |

## Remaining issues / verification limitations

1. Mobile layout not checked this run.
2. Yearly cycle generation covered by code path + frequency UI; explicit YEARLY integration test not present (MONTHLY heavily tested).
3. Prisma CLI validate still unreliable from workspace scripts (DEF-P2-03).
4. Phase 6 files largely still uncommitted on `main` at audit time — verify migrate deploy in each environment.
5. `master-prompt.md` still missing canonical product text.

## Final acceptance decision

**READY FOR NEXT PHASE**

Rationale: All official Phase 6 acceptance criteria pass with automated and live evidence; concurrency, partial allocation, FX snapshot (happy path), and idempotent billing cycles are verified. No critical or high-severity defects remain in Phase 6 scope. Address DEF-P6-01 before relying on ETB reporting totals in production reports.
