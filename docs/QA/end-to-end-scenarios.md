# End-to-End Scenario Results — Final System Audit

| Field | Value |
| --- | --- |
| Audit date | 2026-11-24 |
| Git commit (HEAD) | `daf91b3d256f2096c9c9eb37957b7642d009c0e1` |
| Working tree | Dirty — Phases 6–8 largely uncommitted |
| Probe scripts | `docs/QA/_e2e-scenarios.mjs`, `docs/QA/_e2e-s7-s8.mjs` |
| Database | Isolated Neon development DB (tagged `e2e*` rows cleaned up) |

## Summary

| Scenario | Result | Evidence |
| --- | --- | --- |
| 1 Fully prepaid development project | **PASS** | Allocated 10000; no maintenance agreement; status COMPLETED |
| 2 Project followed by maintenance | **PASS** | Project allocated 8000; cycle PAID at 1200 after partial+remainder |
| 3 One payment covering multiple obligations | **PASS** | One receipt amountEtb 6500; 3 allocations; income row count 1 |
| 4 Subscription renewal and expense consistency | **PASS** | 6 reminders scheduled; obsolete cancelled; 1 expense; open reminders for new expiration |
| 5 Maintenance reminder and overdue approval | **PASS** | Due reminder created; draft AWAITING_APPROVAL not claimable; approved then SENT via console transport |
| 6 Failed email delivery and worker recovery | **PASS** | 2 temp failures + recovery path; SENT with attemptCount 3; transportCalls 3; no duplicateRisk in this probe |
| 7 Exchange-rate change over time | **PASS** | USD 10 @ rate 50 → amountEtb 500 remains after later rate 60 exists |
| 8 Financial rollback and concurrency | **PASS** | Parallel allocate: 1 success + 1 failure; allocated exactly 1000 |

Overall scenario score: **8 / 8 PASS** (isolated helper/API-level probes).

## Scenario detail

### Scenario 1 — Fully prepaid development project

Steps executed via Prisma + finance helpers:

1. Create client / project (agreedPrice 10000 ETB).
2. Advance payment 3000 → allocate to project.
3. Remaining payment 7000 → allocate to project.
4. Mark project COMPLETED.
5. Assert no maintenance agreement auto-created.

Result: **PASS** — `{"allocated":"10000","hasMaintenance":false,"status":"COMPLETED"}`

### Scenario 2 — Project followed by maintenance

1. Pay project in full (8000).
2. Create ACTIVE maintenance agreement (1200 monthly).
3. Generate cycles (`createdCycles: 3`).
4. Partial 500 + remaining 700 to first cycle.

Result: **PASS** — cycle `PAID` / allocated 1200; project allocated remains 8000 (balances separate).

### Scenario 3 — One payment covering multiple obligations

1. Two projects + one maintenance cycle for same client.
2. Single receipt 6500 allocated 3000 / 2500 / 1000.

Result: **PASS** — receipt counted once (`incomeRows: 1`, `amountEtb: 6500`, `allocCount: 3`).

### Scenario 4 — Subscription renewal and expense consistency

1. Create subscription with reminder offsets `[30,7,3,1,0]` (+ after-expiration defaults → 6 events).
2. Confirm renewal to 2027-12-15.
3. Verify obsolete cancelled and new open reminders keyed to new expiration.
4. Exactly one linked expense.

Result: **PASS**

### Scenario 5 — Maintenance payment reminder and overdue approval

1. Active agreement + billing cycle with due 2026-11-20.
2. `scheduleMaintenanceDueReminders(asOf=2026-11-19)` → 1 due event.
3. `scheduleOverduePaymentDrafts` + `processScheduledEvent` → email job `AWAITING_APPROVAL`.
4. `claimEmailJobs` does not claim draft.
5. Admin `approveEmailJob` → claim → console send → `SENT`.

Result: **PASS**

Note: In-app admin notification for the draft remained visible in UI after probe cleanup of jobs/cycles (**DEF-FS-10**).

### Scenario 6 — Failed email delivery and worker recovery

1. Create PENDING email job `maxAttempts=3`.
2. Two temporary transport failures requeue as PENDING.
3. Simulate expired lease while SENDING → `recoverExpiredLeases`.
4. Third attempt succeeds.

Result: **PASS** for retry ceiling and lease recovery in this controlled probe.

Residual risk (**DEF-FS-03**): if SMTP succeeds and the process crashes before status=`SENT`, lease recovery can re-claim and send again — no provider-level idempotency key is recorded on success before the DB update.

### Scenario 7 — Exchange-rate change over time

1. Create USD→ETB rate 50 (Jan) and 60 (Jun).
2. Record USD payment using rate 50.
3. Assert stored `amountEtb` remains 500 after rate 60 exists.

Result: **PASS**

Limitation: application has **no HTTP API to create rates** (**DEF-FS-02**); rates were inserted via Prisma for the probe (same path as seed/tests).

### Scenario 8 — Financial rollback and concurrency

1. Payment 1000 against project obligation 1000.
2. Two concurrent `allocatePaymentBatch` calls for full amount.

Result: **PASS** — one fulfilled, one rejected; final allocated 1000.

## Browser workflows

Authenticated UI smoke (localhost `:5174`):

| Surface | Result |
| --- | --- |
| Login | PASS |
| Dashboard KPIs (Nov 2026) | PASS — matches report totals |
| Subscriptions list | PASS (heavy test-data clutter) |
| Maintenance agreements | PASS |
| Notifications inbox / approval tabs | PASS (stale S5 alerts present) |
| Reports page | Loaded (slow; prior DEF-P8-01) |
| Payments / full Playwright suite | Not fully re-click-tested this run |

No Playwright project suite exists (**DEF-FS-09**).
