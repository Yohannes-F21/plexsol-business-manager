# Phase 02 QA Report — Database & Prisma

| Field | Value |
| --- | --- |
| Phase | Phase 2 — Database & Prisma Schema |
| Audit date | 2026-11-19 |
| Auditor | Independent QA session (separate from implementation) |
| Overall result | **NOT READY** |
| Spec source | Official `docs/roadmap/phase-02.md` was **MISSING**; checklist reconstructed from Phase 2 implementation prompt + README + schema/migration inspection |

## Executive summary

Phase 2 delivered a substantial Prisma schema, SQL migration with CHECK constraints and allocation triggers, Decimal-based finance helpers, a reference-data seed, and a 9-case financial invariant suite. Schema validation, Prisma Client generation, typecheck, lint, and monorepo build all passed. Migrations are applied on the configured development database.

However, the phase is **NOT READY** because:

1. **CRITICAL** — `packages/database/.env.example` contains a live Neon connection string (credentials), contradicting “do not invent/commit credentials” and root `.env.example` placeholder practice.
2. **HIGH** — `pnpm db:test` does **not** pass cleanly: 1 of 9 tests failed on re-run due to non-idempotent exchange-rate fixtures (unique constraint already present from prior runs). Acceptance requires automated financial invariant tests; the suite is currently red.
3. Official roadmap/QA specs were missing at audit start (directories created by QA; roadmap files remain placeholders).

Requirements verified against reconstructed acceptance criteria: **4 PASS / 1 FAIL / 0 BLOCKED** for the five written ACs, plus additional scope checks below. Critical/high defects remain → cannot approve.

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
| Financial invariants have automated tests | **FAIL** | `pnpm db:test` → **8 passed, 1 failed** | DEF-P2-02: non-idempotent FX history test |
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
| `pnpm db:test` | **FAIL** — 8/9 pass, 1 fail |
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
| Affected file | `packages/database/.env.example` |
| Description | File contains a real Neon `DATABASE_URL` with username/password host, not a placeholder. Root `.env.example` correctly uses `USER:PASSWORD@HOST`. |
| Reproduction | Open `packages/database/.env.example` and inspect `DATABASE_URL`. |
| Expected | Placeholder only (e.g. `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`). |
| Actual | Concrete Neon credentials embedded in an example file that is intended to be shared/copied. |
| Recommended fix | 1) Replace with placeholders immediately. 2) Rotate/revoke the exposed Neon password in the Neon console. 3) Ensure only root `.env` (gitignored) holds secrets. 4) Confirm no other tracked files contain the same URL. |

### DEF-P2-02 — Financial invariant test suite fails on re-run

| Field | Detail |
| --- | --- |
| Severity | **HIGH** |
| Affected file | `packages/database/tests/financial-invariants.test.ts` |
| Description | Test `preserves historical exchange rates (unique effectiveAt)` assumes it can insert `USD→ETB` at `2026-03-01T00:00:00.000Z`. Prior test runs leave that row; first create throws unique violation before the intentional duplicate assertion. |
| Reproduction | 1) Ensure DB already has that rate (or run `pnpm db:test` twice). 2) Run `pnpm db:test`. |
| Expected | Suite passes every run; uses unique timestamps/suffixes or cleanup. |
| Actual | 1 failed / 8 passed on QA re-run. Constraint itself works. |
| Recommended fix | Use unique `effectiveAt` (e.g. include `Date.now()`), or `upsert`/`deleteMany` cleanup in `beforeAll`/`afterAll` scoped to test tags. Make suite hermetic. |

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

### NOT READY

Rationale: required acceptance criterion for a green automated financial invariant suite fails on re-run (**HIGH**), and a **CRITICAL** secret-management defect exists in `packages/database/.env.example`. Per gate rules, the phase cannot proceed until both are resolved and re-verified.

### Re-verification checklist (minimum)

1. Replace/rotate credentials; confirm `.env.example` files are placeholders only.
2. Fix FX test isolation; `pnpm db:test` → 9/9 green twice in a row.
3. Confirm Prisma DB scripts work from documented root `.env` alone (or update docs + tooling).
4. Author real `docs/roadmap/phase-02.md` (and ideally `master-prompt.md`).
5. Re-run: `prisma validate`, `migrate status`, `db:generate`, `typecheck`, `lint`, `build`, `db:seed`, `db:test`.
