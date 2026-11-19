# phase-02.md — Database & Prisma

> **MISSING SPECIFICATION**
>
> This file did not exist when Phase 2 QA ran (2026-11-19).
> Author the official Phase 2 requirements here.
>
> Temporary reconstruction used for that audit (from the Phase 2 implementation prompt only — not an official doc):
>
> - Entities: users, sessions, settings, clients, projects, maintenance agreements, billing cycles, client payments, payment allocations, subscriptions, renewals, expenses, categories, currencies, exchange rates, payment methods, notifications, scheduled events, email templates, email jobs, delivery attempts, audit logs
> - Invariants: ≤1 maintenance agreement per project; separate billing cycles; multi-obligation allocations; XOR project/cycle target; payment ownership; no over-allocation; historical FX rates; renewal → exactly one expense; auditable financial corrections; PostgreSQL constraints/triggers where Prisma is insufficient
> - Migrations + development seed; no unnecessary production sample business data
> - Acceptance: schema validates; migrations apply; FKs/uniqueness work; financial invariant automated tests; Prisma Client generates
>
> Replace this placeholder with the canonical specification and delete the reconstruction note.
