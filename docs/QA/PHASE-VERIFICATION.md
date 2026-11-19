# Phase Verification Procedure

Reusable independent QA process for **Plexsol Business Manager**.

## Purpose

Verify whether a requested development phase is genuinely complete and safe to proceed with. QA runs in a session separate from implementation and does not trust developer claims without evidence.

## Required documentation (source of truth)

```text
docs/
├── roadmap/
│   ├── master-prompt.md
│   ├── phase-01.md
│   ├── phase-02.md
│   └── …
└── QA/
    ├── PHASE-VERIFICATION.md   ← this file
    ├── phase-01-report.md
    ├── phase-02-report.md
    └── …
```

Before auditing:

1. Read `docs/roadmap/master-prompt.md`.
2. Read the current phase file under `docs/roadmap/`.
3. Read this procedure.
4. Review prior `docs/QA/phase-XX-report.md` files.
5. Inspect source code and the Git working tree.

If a required doc is missing: do **not** invent requirements; report the gap; use available evidence cautiously; mark affected items **BLOCKED**.

If `docs/` is missing: create the directory structure, report missing specifications, and do not invent original phase requirements.

## Audit rules

- Start **read-only**. Do not fix implementation defects during the initial audit.
- Verify functionality, not merely code existence.
- Use isolated development/test data. Never run destructive tests against production.
- Do not fabricate test results.
- Do not silently change business requirements.
- Distinguish verified, unverified, and blocked requirements.

## Checklist workflow

1. **Requirements extraction** — build an acceptance checklist from the phase spec.
2. **Code inspection** — frontend, backend, database, worker, shared packages as applicable.
3. **Automated verification** — typecheck, lint, builds, Prisma validate/migrate, unit/integration/e2e tests that exist.
4. **Functional verification** — success paths, invalid inputs, edge cases, persistence, failure modes.
5. **Business rules** — only those in scope for the phase (subscriptions, renewals, allocations, FX, reminders, email approval/retry, etc.).
6. **Security** — auth, sessions, ownership, validation, secrets, financial authorization, DB integrity (as applicable).
7. **Visual** — for frontend phases: logo, orange/white/charcoal palette, approved dashboard reference, desktop/mobile, a11y.
8. **Report** — write/update `docs/QA/phase-XX-report.md`.

## Status definitions

| Status | Meaning |
| --- | --- |
| PASS | Verified with evidence |
| FAIL | Incomplete or broken |
| BLOCKED | Could not verify (missing deps/docs/env) |
| NOT APPLICABLE | Outside current phase scope |

## Severity

| Severity | Examples |
| --- | --- |
| CRITICAL | Security breach, data loss, financial corruption, major outage |
| HIGH | Major required functionality broken |
| MEDIUM | Significant incorrect behavior or usability issue |
| LOW | Minor visual or maintainability issue |

Every defect must include: description, severity, affected file(s), reproduction steps, expected vs actual, recommended fix.

## Final acceptance decision

Choose exactly one:

1. **READY FOR NEXT PHASE**
2. **CONDITIONALLY READY**
3. **NOT READY**

A phase cannot be **READY FOR NEXT PHASE** if any required acceptance criterion fails or any critical/high-severity defect remains.

## Report maintenance

- Update the phase report after every verification run.
- Preserve previous findings; record whether each was resolved or remains open.
- Do not overwrite existing QA docs without reviewing them first.
