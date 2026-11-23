# Phase 02 QA Report — Database & Prisma

| Field | Value |
| --- | --- |
| Phase | Phase 2 — Database & Prisma Schema |
| Initial audit date | 2026-11-19 |
| Re-verification date | 2026-11-20 |
| Auditor | Independent QA session (separate from implementation) |
| Overall result | **READY FOR NEXT PHASE** (upgraded from NOT READY after blocker re-check) |
| Spec source | Official `docs/roadmap/phase-02.md` was **MISSING** at first audit; checklist reconstructed from Phase 2 implementation prompt + README + schema/migration inspection |

## Re-verification (2026-11-20)

Blockers reported as fixed by implementation; independently re-checked.

| Defect | Prior severity | Re-check result | Evidence |
| --- | --- | --- | --- |
| DEF-P2-01 credentials in `.env.example` | CRITICAL | **RESOLVED** | `packages/database/.env.example` and root `.env.example` use placeholders only; repo grep found no `neondb_owner` / `npg_` / Neon host leftovers in tracked-like sources |
| DEF-P2-02 flaky FX invariant test | HIGH | **RESOLVED** | Test uses unique `effectiveAt` + cleanup; `pnpm db:test` **9/9 twice** (exit 0 both runs) |
| DEF-P2-03 Prisma CLI root `.env` | MEDIUM | **OPEN** | `prisma validate` with process `DATABASE_URL` unset still fails P1012 |
| DEF-P2-04 missing official roadmap specs | MEDIUM | **OPEN** | Placeholders remain |

Gate: all five Phase 2 acceptance criteria now **PASS**; no critical/high defects remain → **READY FOR NEXT PHASE**. Medium items are non-blocking follow-ups.

## Executive summary (initial 2026-11-19)

Phase 2 delivered a substantial Prisma schema, SQL migration with CHECK constraints and allocation triggers, Decimal-based finance helpers, a reference-data seed, and a 9-case financial invariant suite. Schema validation, Prisma Client generation, typecheck, lint, and monorepo build all passed. Migrations are applied on the configured development database.

Initial decision was **NOT READY** due to DEF-P2-01 (CRITICAL) and DEF-P2-02 (HIGH). Those are resolved as of 2026-11-20 (see Re-verification).

---

## Documentation gaps

| Expected file | Status at audit start | Action taken |
| --- | --- | --- |
| `docs/roadmap/master-prompt.md` | Missing | Placeholder created (contents not invented) |
| `docs/roadmap/phase-01.md` | Missing | Placeholder created |
| `docs/roadmap/phase-02.md` | Missing | Placeholder + reconstruction note |
| `docs/QA/PHASE-VERIFICATION.md` | Missing | Created with standard procedure |
| `docs/QA/phase-01-report.md` | Missing | Created from prior Phase 1 audit |
| `docs/QA/phase-02-report.md` | Missing | This report |

---

## Requirements verification matrix

### Acceptance criteria (Phase 2 implementation prompt)

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Prisma schema validates | **PASS** | `pnpm --filter @plexsol/database exec prisma validate` → “schema is valid” | — |
| Migrations apply to a development database | **PASS** | `migrate:status` → “1 migration found… Database schema is up to date!” against configured Neon DB | Applied migration `20261119141716_init_phase2` |
| Foreign keys and uniqueness constraints work | **PASS** | Migration FKs/unique indexes present; tests reject second maintenance agreement, XOR allocation targets, duplicate renewal→expense; exchange-rate uniqueness enforced (also caused flaky test) | — |
| Financial invariants have automated tests | **PASS** (as of 2026-11-20) | `pnpm db:test` → **9/9** on two consecutive runs | DEF-P2-02 resolved |
| Prisma Client generates successfully | **PASS** | `pnpm db:generate` → client generated | — |

### Required entities & invariants (phase scope)

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Entities listed in Phase 2 prompt present | **PASS** | All 22 models in `schema.prisma` (User→AuditLog) | — |
| ≤1 maintenance agreement per project | **PASS** | `@unique projectId` + test | — |
| Maintenance billing cycles separate | **PASS** | `MaintenanceBillingCycle` model + FKs | — |
| Payment → multiple obligations; XOR target | **PASS** | CHECK `payment_allocations_exactly_one_target` + tests | — |
| Payment ownership + over-allocation prevention | **PASS** | Trigger `plexsol_payment_allocation_guard` + helpers + tests | Helper path verified by tests; SQL trigger inspected |
| Historical FX rates preserved | **PASS** | Unique `(from,to,effectiveAt)` + Decimal(19,8); later rate insert allowed | Test isolation issue only |
| Renewal creates exactly one expense | **PASS** | `expenseId` unique + `confirmSubscriptionRenewal` transaction + test | — |
| Financial corrections auditable | **PASS** | `correctClientPaymentAmount` writes `AuditLog` CORRECT + test | — |
| PG constraints/triggers beyond Prisma | **PASS** | Migration lines 591–840 CHECK + functions + trigger | — |
| Migrations + seed; no sample business data in prod path | **PASS** | Seed upserts currencies/methods/categories/templates/settings/admin only; refuses production without `ALLOW_DB_SEED=true` | Admin uses placeholder password hash (Phase 3) |
| Money uses Decimal not float | **PASS** | `@db.Decimal` fields + `money.ts` + test | — |

### Explicitly NOT APPLICABLE (later phases)

| Requirement | Status | Notes |
| --- | --- | --- |
| Auth enforcement / sessions runtime | NOT APPLICABLE | Schema only; Phase 3 |
| Frontend / visual design | NOT APPLICABLE | Phase 2 is database |
| Email send / reminder worker behavior | NOT APPLICABLE | Tables present; processors later |
| API CRUD for domain entities | NOT APPLICABLE | Phase 5+ |

---

## Test execution results

### Commands executed (2026-11-19)

| Command | Result |
| --- | --- |
| `prisma validate` | PASS |
| `prisma migrate status` | PASS (schema up to date) |
| `pnpm db:generate` | PASS |
| `pnpm typecheck` | PASS (all workspace packages) |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (web chunk-size warning only) |
| `pnpm db:seed` | PASS (reference data) |
| `pnpm db:test` (2026-11-19) | **FAIL** — 8/9 pass, 1 fail |
| `pnpm db:test` (2026-11-20 ×2) | **PASS** — 9/9 both runs |
| `prisma validate` without `DATABASE_URL` in process env | FAIL with P1012 (Phase 1 regression P1-M1) |

### Automated tests

| Suite | Passed | Failed | Notes |
| --- | --- | --- | --- |
| `packages/database/tests/financial-invariants.test.ts` | 8 | 1 | Failed: `preserves historical exchange rates (unique effectiveAt)` — first `create` hit existing unique row from prior run |

### Skipped

| Check | Reason |
| --- | --- |
| E2E / Playwright | Not present for Phase 2 |
| Fresh empty DB migrate from scratch in this run | Status showed already applied; not re-deployed from empty |
| Production Neon destructive tests | Intentionally avoided |

### Migration results

- Migration file: `packages/database/prisma/migrations/20261119141716_init_phase2/migration.sql` (841 lines)
- Includes table DDL, FKs, unique indexes, money CHECKs, XOR target CHECK, one-reporting-currency partial unique index, allocation guard trigger
- Status: applied / up to date on development database used by root `.env`

---

## Defects

### DEF-P2-01 — Live database credentials in `.env.example`

| Field | Detail |
| --- | --- |
| Severity | **CRITICAL** |
| Status | **RESOLVED** (2026-11-20) |
| Affected file | `packages/database/.env.example` |
| Description | File previously contained a real Neon `DATABASE_URL`. |
| Re-check | Now uses `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`. No leftover Neon credential patterns found in repo sources. |
| Follow-up | If that password was ever committed or shared, rotate it in the Neon console anyway. |

### DEF-P2-02 — Financial invariant test suite fails on re-run

| Field | Detail |
| --- | --- |
| Severity | **HIGH** |
| Status | **RESOLVED** (2026-11-20) |
| Affected file | `packages/database/tests/financial-invariants.test.ts` |
| Description | FX history test previously used a fixed `effectiveAt` and collided on re-runs. |
| Re-check | Uses `Date.now()`-based unique timestamps + deletes created rows. `pnpm db:test` passed **9/9 twice**. |

### DEF-P2-03 — Prisma CLI still ignores root `.env` (carried from Phase 1)

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** |
| Affected files | `packages/database` Prisma scripts; docs/README |
| Description | With `DATABASE_URL` removed from process env, `prisma validate` fails P1012 even if root `.env` exists. Seed/tests manually `dotenv` load root `.env`; migrate/generate rely on exported env or accidental presence. |
| Reproduction | Unset `DATABASE_URL`, keep root `.env`, run `pnpm --filter @plexsol/database exec prisma validate`. |
| Expected | Documented root `.env` is sufficient for all DB scripts. |
| Actual | P1012 unless env is exported / package-local `.env` exists. |
| Recommended fix | Wire dotenv into Prisma scripts (`dotenv-cli`, `prisma.config.ts`, or copy/load pattern) and document one canonical approach. |

### DEF-P2-04 — Official phase specifications missing

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** (process / auditability) |
| Affected path | `docs/roadmap/*` |
| Description | Canonical phase specs were not in the repo; QA used the implementation prompt as a temporary source. |
| Expected | Authored `phase-02.md` and `master-prompt.md` before/with implementation. |
| Actual | Placeholders only after QA scaffolding. |
| Recommended fix | Author real roadmap docs; remove reconstruction notes once official text lands. |

---

## Remaining issues / verification limitations

- Workspace is **not a Git repository** in this environment (`fatal: not a git repository`); could not verify whether the secret `.env.example` is tracked remotely.
- Root `.env` points at Neon development DB; tests create leftover fixture rows (timestamped clients etc.) without full cleanup — contributes to DEF-P2-02 and pollutes shared dev DB.
- Raw SQL trigger cross-client rejection was **code-inspected** and covered indirectly by `allocatePayment` tests; a direct raw-Prisma trigger probe was not completed in this run (tooling restriction on temp scripts).
- No official dashboard/UI verification (not Phase 2 scope).
- Seed bootstrap admin uses a non-Argon2 placeholder hash — acceptable for Phase 2, must be replaced in Phase 3.

---

## Prior findings status

| ID | From | Status now |
| --- | --- | --- |
| P1-M1 | Phase 1 | **OPEN** (same as DEF-P2-03) |
| P1-DOC | Phase 1 | **PARTIAL** — structure created; specs still placeholders |

---

## Final acceptance decision

### READY FOR NEXT PHASE

**Updated 2026-11-20** after blocker re-verification.

Rationale: DEF-P2-01 and DEF-P2-02 are resolved with evidence. All five Phase 2 acceptance criteria PASS. No critical/high defects remain.

Non-blocking follow-ups:

1. DEF-P2-03 — wire Prisma CLI to root `.env` (or document package-local `.env`).
2. DEF-P2-04 — author real `docs/roadmap` specs (replace placeholders).
3. Rotate the previously exposed Neon password if it was ever live/shared.
