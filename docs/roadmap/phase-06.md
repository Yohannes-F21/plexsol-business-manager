# phase-06.md — Payments & Maintenance Billing

## Scope

- Client payment receipts with historical ETB exchange-rate snapshots
- Flexible allocations from one receipt across project development balances and multiple maintenance billing cycles
- Partial payments and unapplied balances
- Maintenance agreements with monthly/yearly frequency, explicit activation dates, and separate billing-cycle rows
- Month-end activation clamping (29/30/31)
- Outstanding balances per cycle and per client
- Atomic allocation transactions; concurrency-safe overpay prevention (app checks + PostgreSQL triggers)

## Explicit non-goals

- Do not auto-activate maintenance from project delivery
- Automated email delivery / reminder workers (later phase)

## Acceptance criteria

- A single receipt can settle multiple obligations
- Income is never counted twice (receipt is income; allocations apply it)
- Partial balances calculate correctly
- Concurrent allocation attempts cannot overpay obligations
- Billing-cycle generation is idempotent
- Automated tests cover partial and cross-currency payments
