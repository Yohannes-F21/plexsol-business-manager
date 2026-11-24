# phase-07.md — Background Jobs, Notifications, and Email

## Scope

- PostgreSQL-backed job processor running as `apps/worker` (separate from Express)
- Atomic job claiming (`FOR UPDATE SKIP LOCKED`), worker leases, crash recovery
- Idempotency keys, scheduled execution, retries (max 3 delivery attempts), execution logs
- Subscription reminders: defaults 30 / 7 / 3 / 1 / 0 days, plus configurable after-expiration offsets; per-subscription overrides
- Maintenance due reminder: one automatic professional email the day before due date when outstanding balance exists
- Overdue emails: drafts requiring administrator approval — never auto-sent
- Reusable email templates, payment instructions setting, in-app notifications, delivery logs
- Replaceable email transport (`console` when SMTP unset, SMTP adapter when configured)
- Eligibility revalidated immediately before enqueue/send
- Renewals and settled billing cycles cancel obsolete reminders

## Explicit non-goals

- Auto-activating maintenance agreements from project delivery
- Marketing / bulk campaigns
- SMS or push channels

## Acceptance criteria

- Reminders run without the frontend open (worker process)
- Duplicate jobs do not produce duplicate queued reminders (unique idempotency keys)
- Confirmed renewals and settled bills cancel obsolete reminders
- Overdue emails cannot bypass approval (`AWAITING_APPROVAL` is never claimable for send)
- Worker crashes can be recovered via expired leases
- Email delivery failures are visible to the administrator (Notifications UI + delivery attempts)

## Key modules

- `packages/database/src/jobs/*` — claim, schedule, process, approve, transport, tick
- `apps/worker` — polls `runJobsTick`
- `GET/POST /api/notifications`, `/api/email-jobs`, `/api/job-logs`
- Web: Notifications inbox, email approval, delivery failures
