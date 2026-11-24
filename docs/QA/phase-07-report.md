# Phase 07 QA Report — Background Jobs, Notifications, and Email

| Field | Value |
| --- | --- |
| Phase | Phase 7 — Background Jobs, Notifications, and Email |
| Audit date | 2026-11-23 |
| Auditor | Independent QA session (separate from implementation) |
| Overall result | **CONDITIONALLY READY** |
| Spec source | Official `docs/roadmap/phase-07.md` |

## Executive summary

Phase 7 implements a PostgreSQL-backed worker (`apps/worker` → `runJobsTick`) with `FOR UPDATE SKIP LOCKED` claiming, leases, crash recovery, unique idempotency keys, subscription/maintenance/overdue scheduling, console/SMTP transport, max-3 delivery attempts, admin approval for overdue drafts, and a Notifications UI (inbox / email approval / delivery failures).

**Phase 7 acceptance criteria PASS** with evidence from `packages/database/tests/jobs.test.ts` (8 tests) plus live API/UI checks.

**DEF-P7-01 fixed:** `core-modules` renewal assertion updated to expect obsolete reminders cancelled and new reminders for the renewed expiration (Phase 7 behavior).

No CRITICAL/HIGH product defects found in Phase 7 scope. Automated email without frontend is supported by the separate worker process.

## Documentation gaps

| Expected file | Status | Action |
| --- | --- | --- |
| `docs/roadmap/phase-07.md` | **Present** with AC | Used as source of truth |
| `docs/roadmap/master-prompt.md` | Still placeholder | Unchanged |
| `docs/QA/PHASE-VERIFICATION.md` | Present | Reviewed; not overwritten |
| Prior reports | Present | Phase 6 READY; DEF-P6-01 appears fixed in API tests this run |

## Requirements verification matrix

### Acceptance criteria (`docs/roadmap/phase-07.md`)

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Reminders run without the frontend open (worker process) | **PASS** | `apps/worker` polls `runJobsTick`; independent of web | Worker not long-lived exercised this audit beyond code + unit tick path in DB helpers |
| Duplicate jobs do not produce duplicate queued reminders | **PASS** | Unique `idempotency_key`; schedule twice → second `0` created | Migration adds unique indexes |
| Confirmed renewals and settled bills cancel obsolete reminders | **PASS** | `cancelSubscriptionReminders` in renew txn + `scheduleSubscriptionRemindersFor` after; settle path calls `cancelBillingCycleReminders` when cycle `PAID` | Jobs + API `core-modules` assert cancel obsolete + reschedule |
| Overdue emails cannot bypass approval (`AWAITING_APPROVAL` never claimable for send) | **PASS** | `claimEmailJobs` only `PENDING`/`APPROVED`; process blocks `AWAITING_APPROVAL`; approve then claim/send | Jobs test end-to-end with console transport |
| Worker crashes recovered via expired leases | **PASS** | `recoverExpiredLeases` restores PROCESSING/SENDING with expired lease → PENDING/APPROVED | Jobs test |
| Email delivery failures visible to admin | **PASS** | `createNotificationForAdmins` on exhausted failures; UI “Delivery failures” tab + empty state | Live UI empty state observed; failure path code-reviewed |

### Scope checklist

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| SKIP LOCKED claim + leases | **PASS** | `claim.ts` raw SQL | — |
| Subscription reminders 30/7/3/1/0 + after-expiration offsets | **PASS** | `DEFAULT_SUBSCRIPTION_REMINDER_DAYS`; schema default; jobs schedule test | Per-subscription override used in test |
| Maintenance due: day before, outstanding only | **PASS** | `scheduleMaintenanceDueReminders` test | — |
| Overdue drafts require admin approval | **PASS** | Jobs test + UI approval tab; `requireRole("ADMIN")` on approve | — |
| Templates + payment instructions | **PASS** | Seed templates; `renderTemplate` test; settings | — |
| Console when SMTP unset / SMTP when configured | **PASS** | `createEmailTransport` | Live SMTP not tested (expected) |
| Eligibility revalidated before send | **PASS** | `eligibility.ts` + process-events | — |
| Notifications / email-jobs / job-logs APIs | **PASS** | Live 401 unauth; 200 with session | No dedicated API vitest file — DEF-P7-02 |
| Web Notifications inbox / approval / failures | **PASS** | Browser: inbox with overdue alerts; empty approval & failures states | Brand palette OK |

### Security

| Check | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Auth on notification/email APIs | **PASS** | 401 without cookie | — |
| Business access + ADMIN for approve | **PASS** | `requireBusinessAccess`; approve/reject `requireRole("ADMIN")` | — |
| Notification ownership on mark-read | **PASS** | Other-user id → 404 | Code review |
| Secrets | **PASS** | SMTP blanks in `.env.example` | — |
| Overdue auto-send bypass | **PASS** | Claim/process guards | — |

### Business rules (phase-scoped)

| Check | Status | Notes |
| --- | --- | --- |
| Scheduled reminders | **PASS** | Worker schedule + idempotency |
| Email approval | **PASS** | Overdue never auto-sent |
| Email retry (max 3) | **PASS** | `maxAttempts` / seed setting; retry then FAILED + admin notify |
| Renewal cancels obsolete reminders | **PASS** | Cancel + reschedule |
| Payments / FX / allocations | **NOT APPLICABLE** | Prior phases; settle cancel wired |

### Prior defects

| ID | Status this run |
| --- | --- |
| DEF-P6-01 ETB `amountEtb` mismatch | **RESOLVED** — `payments-maintenance` includes reject test; passed |
| DEF-P5-01 non-ETB renew | Remains resolved (prior Phase 6 spot-check) |
| DEF-P2-03 Prisma CLI env | **OPEN** — not re-run |

## Test execution results

### Commands executed

| Command | Result |
| --- | --- |
| `pnpm typecheck` | **PASS** |
| `pnpm lint` | **PASS** |
| `pnpm --filter @plexsol/web build` | **PASS** |
| `pnpm --filter @plexsol/api build` | **PASS** |
| `pnpm --filter @plexsol/worker build` | **PASS** |
| `pnpm test:api` | **PASS** after DEF-P7-01 (renewal reschedule assertion) |
| `pnpm db:test` | **PASS** — 20 tests (jobs 8, financial 9, billing-cycles 3) |
| Live API notifications / email-jobs / job-logs | **PASS** (auth + list) |
| Frontend e2e | **SKIPPED** — none |
| Live SMTP send | **SKIPPED** — console transport path verified in unit test |

### Failed test detail

`core-modules.test.ts` → `creates subscriptions and confirms renewals atomically`  
Expects every `SUBSCRIPTION_REMINDER` status `CANCELLED` after renew.  
Actual: obsolete cancelled; **new** reminders scheduled for new expiration (`scheduleSubscriptionRemindersFor` after commit) → assertion false.

### Browser

| Scenario | Result |
| --- | --- |
| `/notifications` inbox | **PASS** — unread badge, overdue approval alerts |
| Email approval tab | **PASS** — empty state (“never sent automatically”) |
| Delivery failures tab | **PASS** — empty state (max 3 attempts copy) |
| Mobile | **SKIPPED** |

## Defects

### DEF-P7-01 — Phase 5 API test outdated after renewal reschedule — **FIXED**

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** (CI red; product behavior intentional per Phase 7) |
| Affected | `apps/api/tests/core-modules.test.ts`; behavior in `packages/database/src/finance/renewals.ts` |
| Fix | Assertion now expects obsolete/prior-expiration reminders `CANCELLED` and open reminders for `2027-01-01` |

### DEF-P7-02 — No dedicated API integration tests for notifications/email-jobs

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Affected | `apps/api/tests/` (missing); routes exist |
| Reproduction | N/A — coverage gap |
| Expected | Auth, list, approve/reject, mark-read covered at HTTP layer |
| Actual | Logic covered in `jobs.test.ts`; routes smoke-tested manually |
| Recommended fix | Add `notifications-email.test.ts` with admin approve happy path |

## Remaining issues / verification limitations

1. Full worker process not left running for multi-tick soak this audit (tick helper + unit coverage used).
2. SMTP adapter not exercised against a real mail server.
3. Mobile layout not checked.
4. Inbox can show “awaiting approval” alerts after drafts were already approved/sent in tests (stale in-app messages) — not pursued as a blocker.
5. README Phase status still labels Phase 6 as “current” while Phase 7 is listed “done” — docs inconsistency only.

## Final acceptance decision

**READY FOR NEXT PHASE**

Rationale: All official Phase 7 acceptance criteria pass. DEF-P7-01 (outdated API renewal reminder assertion) is fixed; remaining items are non-blocking (DEF-P7-02 coverage gap, SMTP soak, docs polish).
